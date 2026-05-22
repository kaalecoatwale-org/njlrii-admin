'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/PageLoader';

export default function OverviewPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Metrics states
  const [stats, setStats] = useState({
    volumesCount: 0,
    issuesCount: 0,
    papersCount: 0,
    postsCount: 0,
    manuscriptsCount: 0,
  });
  const [dbLoading, setDbLoading] = useState(true);

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Fetch live stats
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setDbLoading(true);
      try {
        const [
          { count: volCount },
          { count: issCount },
          { count: papCount },
          { count: pstCount },
          { count: manuCount }
        ] = await Promise.all([
          supabase.from('volumes').select('*', { count: 'exact', head: true }),
          supabase.from('issues').select('*', { count: 'exact', head: true }),
          supabase.from('papers').select('*', { count: 'exact', head: true }),
          supabase.from('posts').select('*', { count: 'exact', head: true }),
          supabase.from('manuscripts').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          volumesCount: volCount || 0,
          issuesCount: issCount || 0,
          papersCount: papCount || 0,
          postsCount: pstCount || 0,
          manuscriptsCount: manuCount || 0,
        });
      } catch (err) {
        console.error('Failed to load database counts:', err);
      } finally {
        setDbLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading || (user && !profile)) {
    return <PageLoader message="Loading dashboard overview..." />;
  }

  if (!user || !profile) {
    return null; // Let the layout effect trigger navigation
  }

  // Double check authorization
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--surface)', minHeight: '100vh' }}>
        <h2>Unauthorized</h2>
        <p>Access restricted to editorial team profiles.</p>
        <button className="btn-action primary" style={{ marginTop: '16px' }} onClick={() => router.push('/')}>
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <DashboardShell pageTitle="Console Overview" currentRoute="/overview">
      <div className="metrics-grid-layout">
        {/* Volumes metric */}
        <div className="metric-card-box" onClick={() => router.push('/volumes')} style={{ cursor: 'pointer' }}>
          <div className="metric-info">
            <span className="metric-label">Total Volumes</span>
            <span className="metric-value">{dbLoading ? '...' : stats.volumesCount}</span>
          </div>
          <div className="metric-icon-frame">📚</div>
        </div>

        {/* Issues metric */}
        <div className="metric-card-box" onClick={() => router.push('/issues')} style={{ cursor: 'pointer' }}>
          <div className="metric-info">
            <span className="metric-label">Active Issues</span>
            <span className="metric-value">{dbLoading ? '...' : stats.issuesCount}</span>
          </div>
          <div className="metric-icon-frame">🔖</div>
        </div>

        {/* Papers metric */}
        <div className="metric-card-box" onClick={() => router.push('/papers')} style={{ cursor: 'pointer' }}>
          <div className="metric-info">
            <span className="metric-label">Published Papers</span>
            <span className="metric-value">{dbLoading ? '...' : stats.papersCount}</span>
          </div>
          <div className="metric-icon-frame">📝</div>
        </div>

        {/* Manuscripts metric */}
        <div className="metric-card-box" onClick={() => router.push('/tracker')} style={{ cursor: 'pointer' }}>
          <div className="metric-info">
            <span className="metric-label">Active Tracker</span>
            <span className="metric-value">{dbLoading ? '...' : stats.manuscriptsCount}</span>
          </div>
          <div className="metric-icon-frame">🗳️</div>
        </div>

        {/* Announcements metric */}
        <div className="metric-card-box" onClick={() => router.push('/blog')} style={{ cursor: 'pointer' }}>
          <div className="metric-info">
            <span className="metric-label">News & Announcements</span>
            <span className="metric-value">{dbLoading ? '...' : stats.postsCount}</span>
          </div>
          <div className="metric-icon-frame">📰</div>
        </div>
      </div>

      {/* Quick Launchpad Card */}
      <div className="admin-card">
        <div className="card-header-block">
          <h2 className="card-heading-title">⚡ Editorial Quick Launchpad</h2>
        </div>
        <div className="card-body-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <button 
            className="btn-action primary" 
            style={{ width: '100%', height: '54px' }} 
            onClick={() => router.push('/papers/new')}
          >
            📝 Publish Research Paper
          </button>
          
          <button 
            className="btn-action secondary" 
            style={{ width: '100%', height: '54px' }} 
            onClick={() => router.push('/blog')}
          >
            📰 Create Post / Announcement
          </button>

          <button 
            className="btn-action outline" 
            style={{ width: '100%', height: '54px', fontWeight: 'bold' }} 
            onClick={() => router.push('/tracker')}
          >
            🗳️ Coordinate Manuscript Reviews
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
