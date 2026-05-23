'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function DashboardShell({
  children,
  pageTitle = 'Dashboard',
  currentRoute = '/overview',
}: {
  children: React.ReactNode;
  pageTitle?: string;
  currentRoute?: string;
}) {
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Change Password Modal States
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push('/');
  };

  const getNavigationItems = () => {
    const defaultItems = [
      { label: 'Overview', route: '/overview', icon: '📈' },
    ];

    if (!profile) return defaultItems;

    const role = profile.role;

    if (role === 'super_admin' || role === 'editor' || role === 'student_editor') {
      return [
        { label: 'Overview', route: '/overview', icon: '📈' },
        { label: 'Volumes', route: '/volumes', icon: '📚' },
        { label: 'Issues & Releases', route: '/issues', icon: '🔖' },
        { label: 'Research Papers', route: '/papers', icon: '📝' },
        { label: 'News & Announcements', route: '/blog', icon: '📰' },
        { label: 'Manuscripts Tracker', route: '/tracker', icon: '🗳️' },
        ...(role === 'super_admin' ? [{ label: 'User Management', route: '/users', icon: '👥' }] : []),
      ];
    } else if (role === 'reviewer') {
      return [
        { label: 'Review Dashboard', route: '/reviewer', icon: '🔬' },
      ];
    } else {
      return [
        { label: 'Author Console', route: '/author', icon: '🖋️' },
      ];
    }
  };

  const navigationItems = getNavigationItems();
  const avatarLetter = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'E';
  const displayRoleName = () => {
    switch (profile?.role) {
      case 'super_admin': return 'Editor-in-Chief';
      case 'editor': return 'Associate Editor';
      case 'student_editor': return 'Student Editor';
      case 'reviewer': return 'Peer Reviewer';
      case 'author': return 'Author Profile';
      default: return 'Editorial Staff';
    }
  };

  return (
    <div className="admin-layout-wrapper">
      {/* Sidebar - Classic Deep Slate Drawer */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-branding">
          <div className="sidebar-logo" onClick={() => router.push('/overview')} style={{ cursor: 'pointer' }}>
            NJLRII<span>.</span>
          </div>
          <div className="sidebar-issn">ISSN: 2582-8665</div>
        </div>

        <nav className="sidebar-nav-menu">
          {navigationItems.map((item) => (
            <a
              key={item.route}
              href={item.route}
              className={`sidebar-link ${currentRoute === item.route ? 'active-route' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.route);
                setMobileMenuOpen(false);
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>NJLRII SUBDOMAIN ADMIN</div>
          <div style={{ opacity: 0.8, fontWeight: 600 }}>{profile?.full_name || 'Guest'}</div>
          <div style={{ opacity: 0.5 }}>{displayRoleName()}</div>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <a
              href="#change-password"
              onClick={(e) => {
                e.preventDefault();
                setIsChangePasswordOpen(true);
              }}
              style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', display: 'block' }}
            >
              🔑 Change Password
            </a>
            <a href="/logout" onClick={handleSignOut} style={{ color: '#ff3b5e', fontWeight: 'bold', textDecoration: 'none', display: 'block' }}>
              Sign Out →
            </a>
          </div>
        </div>
      </aside>

      {/* Main Container Column */}
      <div className="admin-main-container">
        {/* Header Navigation */}
        <header className="admin-top-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Mobile Menu Trigger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ fontSize: '20px', padding: '8px', cursor: 'pointer' }}
              className="mobile-toggle-btn"
            >
              ☰
            </button>
            <h1 className="navbar-page-title">{pageTitle}</h1>
          </div>

          <div className="navbar-user-actions">
            <a href="https://www.njlrii.com" target="_blank" rel="noopener noreferrer" className="btn-action outline">
              <span className="desktop-only-text">👁️ View Live Website</span>
              <span className="mobile-only-text">👁️ Live</span>
            </a>

            <div className="navbar-profile-badge">
              <div className="profile-avatar">{avatarLetter}</div>
              <div className="profile-details">
                <span className="profile-name">{profile?.full_name || 'Editorial Staff'}</span>
                <span className="profile-role">{displayRoleName()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="admin-content-view fade-in-up">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Backdrop Click Close Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 95
          }}
        />
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '24px',
          }}
        >
          <div
            className="admin-card fade-in-up"
            style={{
              maxWidth: '400px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              borderTop: '5px solid var(--primary)',
              backgroundColor: '#ffffff',
            }}
          >
            <div className="card-body-content" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="card-heading-title" style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔑 Change Password
                </h2>
                <button
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                  }}
                >
                  ✕
                </button>
              </div>

              {passwordError && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px' }}>
                  ⚠️ {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px' }}>
                  ✅ {passwordSuccess}
                </div>
              )}

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  style={{ width: '100%', padding: '12px', marginTop: '8px' }}
                  disabled={passwordLoading}
                >
                  {passwordLoading ? 'Updating Password...' : '🔒 Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
