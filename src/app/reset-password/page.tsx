'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if session exists or was established by the recovery link
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setCheckingSession(false);
        } else {
          // Listen for a brief moment to see if the session gets set via the hash fragment parsing
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
              setCheckingSession(false);
              subscription.unsubscribe();
            }
          });

          // Fallback timeout: if no session is set within 2 seconds, redirect to login
          const timer = setTimeout(() => {
            subscription.unsubscribe();
            setCheckingSession(false);
            setError('No active password recovery session detected. Please request a new recovery link.');
          }, 2000);

          return () => {
            clearTimeout(timer);
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        setCheckingSession(false);
        setError('Error establishing recovery session.');
      }
    };

    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess('Your password has been successfully updated! Redirecting to login page...');
      setNewPassword('');
      setConfirmPassword('');

      // Sign out to clear the temporary recovery session so they log in cleanly
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update your password.');
      setLoading(false);
    }
  };

  if (checkingSession) {
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
            VERIFYING SECURE KEY RECOVERY SESSION...
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
              ISSN 2582-8665 | PASSWORD RECOVERY
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
                lineHeight: '1.5',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {success && (
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
                lineHeight: '1.5',
              }}
            >
              ✅ {success}
            </div>
          )}

          {!success && !error.includes('No active password recovery session') && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-field-group">
                <label className="form-label-text">New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    className="form-input-control"
                    style={{ paddingRight: '44px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
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
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-field-group">
                <label className="form-label-text">Confirm Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="form-input-control"
                    style={{ paddingRight: '44px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                    {showConfirmPassword ? (
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
                disabled={loading}
              >
                {loading ? 'Saving New Key...' : '🔒 Reset Account Password'}
              </button>
            </form>
          )}

          {(error.includes('No active password recovery session') || success) && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                onClick={() => router.push('/')}
                className="btn-action outline"
                style={{ width: '100%', padding: '12px' }}
              >
                ← Return to Login Screen
              </button>
            </div>
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
