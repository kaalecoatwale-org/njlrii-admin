'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'editor' | 'student_editor' | 'reviewer' | 'author';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

async function fetchProfileFromDB(authUser: User): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (!error && data) {
    return data as UserProfile;
  }

  // If not found, try to auto-create
  if (error?.code === 'PGRST116') {
    const fallbackRole = (authUser.user_metadata?.role as string) || 'author';
    const fullName = (authUser.user_metadata?.full_name as string) || '';

    const { data: newData, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: authUser.id,
        email: authUser.email || '',
        full_name: fullName,
        role: fallbackRole,
      })
      .select()
      .single();

    if (!insertError && newData) {
      return newData as UserProfile;
    }
    console.warn('Profile auto-create failed:', insertError?.message);
  } else {
    console.error('Profile fetch error:', error?.message);
  }

  // Fallback: construct from JWT metadata
  return {
    id: authUser.id,
    email: authUser.email || '',
    full_name: (authUser.user_metadata?.full_name as string) || null,
    role: ((authUser.user_metadata?.role as string) || 'author') as UserProfile['role'],
    created_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether the provider is still mounted before setting state
  const isMounted = useRef(true);
  // Track which user we last fetched a profile for (avoid duplicate fetches)
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;

    const setUserIfChanged = (nextUser: User | null) => {
      if (!isMounted.current) return;

      setUser((currentUser) => {
        if (currentUser?.id === nextUser?.id) {
          return currentUser;
        }

        return nextUser;
      });
    };

    const applyProfileForUser = async (authUser: User) => {
      const p = await fetchProfileFromDB(authUser);
      if (isMounted.current) {
        setProfile(p);
      }
    };

    // STEP 1: Get current session immediately (synchronous check)
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          setUserIfChanged(session.user);
          lastFetchedUserId.current = session.user.id;
          await applyProfileForUser(session.user);
        }

        if (isMounted.current) {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('getSession failed:', err);
        if (isMounted.current) {
          setLoading(false);
        }
      });

    // STEP 2: Listen for future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Skip events that fire before initial session check completes
        // (INITIAL_SESSION is handled by getSession above)
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          if (isMounted.current) {
            setUser(null);
            setProfile(null);
          }
          lastFetchedUserId.current = null;
          return;
        }

        if (session?.user) {
          setUserIfChanged(session.user);

          const shouldRefreshProfile =
            event === 'USER_UPDATED' || lastFetchedUserId.current !== session.user.id;

          if (shouldRefreshProfile) {
            lastFetchedUserId.current = session.user.id;
            setProfile(null);

            // Supabase can emit SIGNED_IN again when a tab regains focus.
            // Defer follow-up queries outside the auth callback to avoid deadlocks.
            setTimeout(() => {
              void applyProfileForUser(session.user);
            }, 0);
          }
        }
      }
    );

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfileFromDB(user);
      setProfile(p);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    lastFetchedUserId.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
