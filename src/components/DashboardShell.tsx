'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

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
          <div style={{ marginTop: '12px', color: '#ff3b5e', fontWeight: 'bold' }}>
            <a href="/logout" onClick={handleSignOut}>Sign Out →</a>
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
    </div>
  );
}
