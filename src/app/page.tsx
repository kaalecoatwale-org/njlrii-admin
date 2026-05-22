'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 1. Role-based dynamic routing
  useEffect(() => {
    if (!loading && user && profile) {
      const role = profile.role;
      if (role === 'super_admin' || role === 'editor' || role === 'student_editor') {
        router.push('/overview');
      } else if (role === 'reviewer') {
        router.push('/reviewer');
      } else {
        router.push('/author');
      }
    }
  }, [user, profile, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid username or unauthorized editorial credentials.');
        setAuthLoading(false);
        return;
      }

      if (data.user) {
        // Redirect immediately based on JWT metadata — don't wait for context profile
        const role = data.user.user_metadata?.role || 'author';
        if (role === 'super_admin' || role === 'editor' || role === 'student_editor') {
          router.push('/overview');
        } else if (role === 'reviewer') {
          router.push('/reviewer');
        } else {
          // Default: go to overview, AuthContext profile state will handle further routing
          router.push('/author');
        }
        // Keep authLoading=true so the button stays in "Authenticating..." state during navigation
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Connection failure. Database offline.');
    }
    setAuthLoading(false);
  };

  // Branded Preloader
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '0.05em' }}>
            NJLRII<span>.</span>
          </h1>
          <p style={{ fontFamily: 'JetBrains Mono', color: 'var(--muted)', fontSize: '11px', marginTop: '6px', letterSpacing: '0.12em' }}>
            ISSN 2582-8665 | INITIALIZING SECURE SHELL...
          </p>
          <div
            style={{
              width: '80px',
              height: '3px',
              backgroundColor: 'var(--primary)',
              borderRadius: '2px',
              margin: '24px auto 0',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>
      </div>
    );
  }

  // Render Login Panel
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface)',
        padding: '24px',
      }}
    >
      <div
        className="admin-card fade-in-up"
        style={{
          maxWidth: '420px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          borderTop: '5px solid var(--primary)',
        }}
      >
        <div className="card-body-content" style={{ padding: '40px' }}>
          {/* Logo Center */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.02em' }}>
              NJLRII<span style={{ color: 'var(--primary)' }}>.</span>
            </h1>
            <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'var(--muted)', letterSpacing: '0.12em', marginTop: '6px' }}>
              ISSN 2582-8665 | ADMIN BOARD
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                color: 'var(--error)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '20px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-field-group">
              <label className="form-label-text">Editorial Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@njlrii.com"
                className="form-input-control"
                required
              />
            </div>

            <div className="form-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label-text">Security Keycode</label>
                <a href="mailto:info@njlrii.com" style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>
                  Forgot Key?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input-control"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-action primary"
              style={{ width: '100%', padding: '14px', marginTop: '8px' }}
              disabled={authLoading}
            >
              {authLoading ? 'Authenticating Credentials...' : '🔐 Sign In to Console'}
            </button>
          </form>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            padding: '16px 40px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--muted)',
            borderTop: '1px solid var(--border)',
          }}
        >
          Protected Collaborative Peer-Review Portal.
        </div>
      </div>
    </div>
  );
}
