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

  // Password Visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password state
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setAuthLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setResetSuccess('Recovery link sent! Please check your email inbox.');
      setForgotEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch reset request.');
    } finally {
      setAuthLoading(false);
    }
  };

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

          {resetSuccess && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                color: 'var(--success)',
                border: '1px solid rgba(34, 197, 94, 0.15)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '20px',
              }}
            >
              ✅ {resetSuccess}
            </div>
          )}

          {mode === 'login' ? (
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
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode('forgot');
                      setError('');
                      setResetSuccess('');
                    }}
                    style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}
                  >
                    Forgot Key?
                  </a>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="form-input-control"
                    style={{ paddingRight: '44px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
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
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-field-group">
                <label className="form-label-text">Registered Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="editor@njlrii.com"
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
                {authLoading ? 'Sending Recovery Link...' : '📨 Send Recovery Link'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <a
                  href="#login"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode('login');
                    setError('');
                    setResetSuccess('');
                  }}
                  style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'bold', textDecoration: 'none' }}
                >
                  ← Back to Sign In
                </a>
              </div>
            </form>
          )}
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
