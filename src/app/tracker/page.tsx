'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabase';

interface Manuscript {
  id: number;
  primary_author_id: string | null;
  title: string;
  abstract: string;
  keywords: string[];
  manuscript_pdf_url: string;
  status: 'submitted' | 'under_review' | 'revision' | 'accepted' | 'rejected';
  assigned_editor_id: string | null;
  created_at: string;
  
  // New columns
  author_name?: string;
  author_email?: string;
  author_phone?: string;
  author_affiliation?: string;
  tracking_id?: string;
  co_authors?: any[];
  
  step1_status: 'pending' | 'revision' | 'passed' | 'failed';
  step1_feedback?: string;
  step2_status: 'pending' | 'revision' | 'passed' | 'failed';
  step2_feedback?: string;
  step3_status: 'pending' | 'revision' | 'passed' | 'failed';
  step3_feedback?: string;
  step4_status: 'pending' | 'revision' | 'passed' | 'failed';
  step4_feedback?: string;
  step5_status: 'pending' | 'revision' | 'passed' | 'failed';
  step5_feedback?: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'editor' | 'student_editor' | 'reviewer' | 'author';
  created_at: string;
}

interface ReviewerAssignment {
  id: number;
  manuscript_id: number;
  reviewer_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  assigned_at: string;
  completed_at: string | null;
}

interface PeerReview {
  id: number;
  assignment_id: number;
  score_originality: number;
  score_structure: number;
  score_citation: number;
  comments_for_author: string;
  comments_for_editor: string;
  submitted_at: string;
}

interface Issue {
  id: number;
  volume_id: number;
  number: number;
  year: number;
  volumes?: {
    number: number;
    year: number;
  };
}

export default function TrackerPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Core database state
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'submitted' | 'under_review' | 'revision' | 'accepted' | 'rejected'>('all');
  const [expandedManuscriptId, setExpandedManuscriptId] = useState<number | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<{ [key: string]: string }>({});
  const [draftStatus, setDraftStatus] = useState<{ [key: string]: 'pending' | 'passed' | 'revision' | 'failed' }>({});
  
  // Publication Modal State
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);
  const [publishIssueId, setPublishIssueId] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [publishAuthors, setPublishAuthors] = useState<{ name: string; designation: string; affiliation: string }[]>([
    { name: '', designation: '', affiliation: '' }
  ]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // File download tracking state & fetch-based download helper to preserve original/readable filenames
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = async (url: string, trackingId: string, authorName: string, title: string, manuscriptId: number) => {
    if (!url) return;
    setDownloadingId(manuscriptId);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      
      let extension = 'docx';
      if (url.includes('.')) {
        const parts = url.split('.');
        const ext = parts[parts.length - 1].toLowerCase().split('?')[0];
        if (['doc', 'docx', 'pdf'].includes(ext)) {
          extension = ext;
        }
      }
      
      // Construct a clean, highly structured filename for the editorial board
      // e.g. [IJLMH-F8G2K]_Ayush_Sharma_-_Critical_Analysis.docx
      const cleanAuthor = (authorName || 'Author').trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const cleanTitle = (title || 'Manuscript').trim().replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 40).replace(/\s+/g, '_');
      const filename = `[${trackingId || 'MANUSCRIPT'}]_${cleanAuthor}_-_${cleanTitle}.${extension}`;

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Fetch Data
  const loadTrackerData = async () => {
    if (!user) return;
    setDbLoading(true);
    setError('');
    try {
      // 1. Fetch Manuscripts
      const { data: manuscriptsData, error: manError } = await supabase
        .from('manuscripts')
        .select('*')
        .order('created_at', { ascending: false });
      if (manError) throw manError;

      // 2. Fetch User Profiles
      const { data: profilesData, error: profError } = await supabase
        .from('user_profiles')
        .select('*');
      if (profError) throw profError;

      // 3. Fetch Issues & Volumes
      const { data: issuesData, error: issError } = await supabase
        .from('issues')
        .select('*, volumes(number, year)')
        .order('id', { ascending: false });
      if (issError) throw issError;

      setManuscripts((manuscriptsData as any) || []);
      setProfiles((profilesData as any) || []);
      setIssues((issuesData as any) || []);
    } catch (err: any) {
      console.error('Error fetching tracker data:', err);
      setError(err.message || 'Failed to load tracking data database components.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTrackerData();
    }
  }, [user]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  if (loading || (user && !profile)) return <PageLoader message="Loading manuscript tracker..." />;
  if (!user || !profile) return null;

  // Role validation: Editor group
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) {
    return <div style={{ padding: '24px', textAlign: 'center', fontWeight: 'bold' }}>Access Denied. Editorial access only.</div>;
  }

  // Lookups
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // Decision Handler
  const handleUpdateStatus = async (manuscriptId: number, status: Manuscript['status']) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const { error: patchError } = await supabase
        .from('manuscripts')
        .update({ status })
        .eq('id', manuscriptId);

      if (patchError) throw patchError;

      setSuccess(`Manuscript status successfully updated to "${status.toUpperCase()}".`);
      await loadTrackerData();
    } catch (err: any) {
      setError(err.message || 'Failed to update manuscript status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Milestone Status Handler
  const handleUpdateMilestoneStatus = async (
    manuscriptId: number,
    stepNumber: 1 | 2 | 3 | 4 | 5,
    stepStatus: 'pending' | 'revision' | 'passed' | 'failed',
    stepFeedback: string
  ) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const currentManuscript = manuscripts.find(m => m.id === manuscriptId);
      if (!currentManuscript) throw new Error('Manuscript not found.');

      const step1 = stepNumber === 1 ? stepStatus : currentManuscript.step1_status;
      const step2 = stepNumber === 2 ? stepStatus : currentManuscript.step2_status;
      const step3 = stepNumber === 3 ? stepStatus : currentManuscript.step3_status;
      const step4 = stepNumber === 4 ? stepStatus : currentManuscript.step4_status;
      const step5 = stepNumber === 5 ? stepStatus : currentManuscript.step5_status;

      let globalStatus: Manuscript['status'] = 'under_review';
      if (step1 === 'failed' || step2 === 'failed' || step3 === 'failed' || step4 === 'failed' || step5 === 'failed') {
        globalStatus = 'rejected';
      } else if (step1 === 'revision' || step2 === 'revision' || step3 === 'revision' || step4 === 'revision' || step5 === 'revision') {
        globalStatus = 'revision';
      } else if (step1 === 'passed' && step2 === 'passed' && step3 === 'passed' && step4 === 'passed' && step5 === 'passed') {
        globalStatus = 'accepted';
      } else {
        globalStatus = 'under_review';
      }

      const updateData: any = {
        status: globalStatus,
        [`step${stepNumber}_status`]: stepStatus,
        [`step${stepNumber}_feedback`]: stepFeedback
      };

      const { error: patchError } = await supabase
        .from('manuscripts')
        .update(updateData)
        .eq('id', manuscriptId);

      if (patchError) throw patchError;

      const draftKey = `${manuscriptId}_${stepNumber}`;
      setDraftStatus(prev => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setDraftFeedback(prev => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });

      setSuccess(`Step ${stepNumber} milestone status successfully updated to "${stepStatus.toUpperCase()}".`);
      await loadTrackerData();

      // Dispatch automated milestone email notification
      if (['passed', 'revision', 'failed'].includes(stepStatus) && currentManuscript.author_email) {
        try {
          const sessionData = await supabase.auth.getSession();
          const token = sessionData.data.session?.access_token;
          if (token) {
            const stepTitles: Record<number, string> = {
              1: 'Step 1: Document Style & Formatting Check',
              2: 'Step 2: Plagiarism & AI Detection Check',
              3: 'Step 3: Peer Quality Review Check',
              4: 'Step 4: Editorial Board Approval Check',
              5: 'Step 5: APC Payment & Final Branding Check'
            };

            await fetch('/api/emails/send-milestone', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient_email: currentManuscript.author_email,
                author_name: currentManuscript.author_name || 'Author',
                title: currentManuscript.title,
                tracking_id: currentManuscript.tracking_id,
                step_num: stepNumber,
                step_title: stepTitles[stepNumber] || `Step ${stepNumber}`,
                step_status: stepStatus,
                feedback: stepFeedback
              })
            });
          }
        } catch (emailErr) {
          console.error('[EMAIL ERROR] Failed to send milestone notification:', emailErr);
        }
      }
    } catch (err: any) {
      console.error('Error updating milestone:', err);
      setError(err.message || 'Failed to update milestone status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Publish Modal
  const openPublishModal = (manuscript: Manuscript) => {
    setSelectedManuscript(manuscript);
    setPublishIssueId('');
    
    // Auto-generate slug
    const generatedSlug = manuscript.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setPublishSlug(generatedSlug);

    // Initial authors mapping (using flat fields first, falling back to profilesMap if needed)
    const authorName = manuscript.author_name || profilesMap.get(manuscript.primary_author_id || '')?.full_name || 'Author Name';
    const authorAffiliation = manuscript.author_affiliation || 'Institutional Affiliation';

    setPublishAuthors([
      {
        name: authorName,
        designation: 'Author',
        affiliation: authorAffiliation
      }
    ]);

    setPublishModalOpen(true);
  };

  // Publish Paper
  const handlePublishPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedManuscript) return;

    const issueNum = parseInt(publishIssueId);
    if (isNaN(issueNum)) {
      setError('Please select a valid release issue.');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Insert into papers
      const { error: pubError } = await supabase
        .from('papers')
        .insert({
          issue_id: issueNum,
          title: selectedManuscript.title,
          abstract: selectedManuscript.abstract,
          keywords: selectedManuscript.keywords,
          pdf_url: selectedManuscript.manuscript_pdf_url,
          slug: publishSlug,
          author_metadata: publishAuthors.filter(a => a.name.trim() !== ''),
          published_at: new Date().toISOString()
        });

      if (pubError) throw pubError;

      // 2. Set manuscript status to 'accepted'
      const { error: manError } = await supabase
        .from('manuscripts')
        .update({ status: 'accepted' })
        .eq('id', selectedManuscript.id);

      if (manError) throw manError;

      setSuccess(`Paper successfully accepted and published inside dynamic Issue #${issueNum}!`);
      setPublishModalOpen(false);
      setSelectedManuscript(null);
      await loadTrackerData();

      // Dispatch automated publication email notification
      if (selectedManuscript.author_email) {
        try {
          const sessionData = await supabase.auth.getSession();
          const token = sessionData.data.session?.access_token;
          if (token) {
            const matchedIssue = issues.find(i => i.id === issueNum);
            const volNum = matchedIssue?.volumes?.number || 'VI';
            const issNum = matchedIssue?.number || 'III';
            const year = matchedIssue?.year || new Date().getFullYear();

            await fetch('/api/emails/send-publish', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                recipient_email: selectedManuscript.author_email,
                author_name: selectedManuscript.author_name || 'Author',
                title: selectedManuscript.title,
                tracking_id: selectedManuscript.tracking_id,
                vol_number: String(volNum),
                iss_number: String(issNum),
                year: String(year),
                article_url: `${window.location.origin}/issues/paper/${publishSlug}`,
                certificate_url: `${window.location.origin}/certificates/download?id=${selectedManuscript.id}`
              })
            });
          }
        } catch (emailErr) {
          console.error('[EMAIL ERROR] Failed to send publication notification:', emailErr);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish manuscript.');
    } finally {
      setActionLoading(false);
    }
  };

  // Dynamic filter lists
  const filteredManuscripts = manuscripts.filter(m => {
    const authorProfile = profilesMap.get(m.primary_author_id || '');
    const authorName = m.author_name || authorProfile?.full_name || '';
    const authorEmail = m.author_email || authorProfile?.email || '';
    const trackingId = m.tracking_id || '';
    
    const matchesSearch = 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
      authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      authorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trackingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTab = activeTab === 'all' || m.status === activeTab;

    return matchesSearch && matchesTab;
  });

  // Pagination logic - calculate paginated manuscripts
  const paginatedManuscripts = filteredManuscripts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <DashboardShell pageTitle="Manuscripts Tracker" currentRoute="/tracker">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Status Alerts */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ✅ {success}
          </div>
        )}

        {/* Dense Overview Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-icon">🗳️</span>
            <div className="metric-value">{manuscripts.length}</div>
            <div className="metric-label">Total Submissions</div>
          </div>
          <div className="metric-card">
            <span className="metric-icon">📥</span>
            <div className="metric-value">{manuscripts.filter(m => m.status === 'submitted').length}</div>
            <div className="metric-label">New / Unassigned</div>
          </div>
          <div className="metric-card">
            <span className="metric-icon">🔬</span>
            <div className="metric-value">{manuscripts.filter(m => m.status === 'under_review').length}</div>
            <div className="metric-label">Under Peer Review</div>
          </div>
          <div className="metric-card">
            <span className="metric-icon">📜</span>
            <div className="metric-value">{manuscripts.filter(m => m.status === 'accepted').length}</div>
            <div className="metric-label">Accepted</div>
          </div>
        </div>

        {/* Query Controls Grid */}
        <div className="admin-card">
          <div className="card-header-block" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <h2 className="card-heading-title">Peer Review Coordinator</h2>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
              <input
                type="text"
                placeholder="Search manuscripts by title, author, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input-control"
                style={{ maxWidth: '360px', width: '100%' }}
              />
            </div>
          </div>

          {/* Navigation Category Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', padding: '0 24px' }}>
            {(['all', 'submitted', 'under_review', 'revision', 'accepted', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '14px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {tab.replace('_', ' ').toUpperCase()} ({manuscripts.filter(m => tab === 'all' || m.status === tab).length})
              </button>
            ))}
          </div>

          {/* Table Content */}
          <div className="card-body-content" style={{ padding: 0 }}>
            {dbLoading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                Loading collaborative repository databases...
              </div>
            ) : filteredManuscripts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                No academic manuscripts found matching your active filter constraints.
              </div>
            ) : (
              <>
                <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Manuscript Details</th>
                      <th>Primary Author</th>
                      <th>Status</th>
                      <th>Tracking ID</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedManuscripts.map((manuscript) => {
                      const authorProfile = profilesMap.get(manuscript.primary_author_id || '');
                      const authorName = manuscript.author_name || authorProfile?.full_name || 'Anonymous';
                      const authorEmail = manuscript.author_email || authorProfile?.email || '';
                      const isExpanded = expandedManuscriptId === manuscript.id;
                      const isRevised = !!(
                        (manuscript.step1_status === 'pending' && manuscript.step1_feedback) ||
                        (manuscript.step2_status === 'pending' && manuscript.step2_feedback) ||
                        (manuscript.step3_status === 'pending' && manuscript.step3_feedback) ||
                        (manuscript.step4_status === 'pending' && manuscript.step4_feedback) ||
                        (manuscript.step5_status === 'pending' && manuscript.step5_feedback)
                      );

                      // Status Badge Helper
                      const getStatusBadge = (status: Manuscript['status']) => {
                        switch (status) {
                          case 'submitted': return <span className="status-pill-badge info">Submitted</span>;
                          case 'under_review': return <span className="status-pill-badge warning"><span className="status-pulse-dot" />Reviewing</span>;
                          case 'revision': return <span className="status-pill-badge warning">Revision Needed</span>;
                          case 'accepted': return <span className="status-pill-badge success">Accepted</span>;
                          case 'rejected': return <span className="status-pill-badge danger">Rejected</span>;
                          default: return <span className="status-pill-badge">{status}</span>;
                        }
                      };

                      return (
                        <React.Fragment key={manuscript.id}>
                          <tr>
                            <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>#{manuscript.id}</td>
                            <td>
                              <div style={{ fontWeight: 'bold', color: 'var(--text-dark)', marginBottom: '4px' }}>
                                {manuscript.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDownload(
                                    manuscript.manuscript_pdf_url,
                                    manuscript.tracking_id || '',
                                    authorName,
                                    manuscript.title,
                                    manuscript.id
                                  )}
                                  disabled={downloadingId === manuscript.id}
                                  style={{ 
                                    background: isRevised ? 'rgba(34, 197, 94, 0.08)' : 'none', 
                                    border: isRevised ? '1.5px solid rgba(34, 197, 94, 0.25)' : 'none', 
                                    padding: isRevised ? '4px 10px' : 0, 
                                    borderRadius: isRevised ? '6px' : 0,
                                    color: isRevised ? 'var(--success)' : 'var(--primary)', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer', 
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: isRevised ? '6px' : '4px',
                                    opacity: downloadingId === manuscript.id ? 0.6 : 1,
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                >
                                  {downloadingId === manuscript.id ? '📥 Downloading...' : isRevised ? '🔄 Download Revised Manuscript (.docx)' : '📄 Download Manuscript Document (.docx)'}
                                </button>
                                <span>• Submitted: {new Date(manuscript.created_at).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{authorName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{authorEmail}</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                {getStatusBadge(manuscript.status)}
                                {isRevised && (
                                  <span className="status-pill-badge success" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                                    color: 'var(--success)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    <span className="status-pulse-dot" style={{ backgroundColor: 'var(--success)', width: '6px', height: '6px' }} />
                                    Revision Uploaded
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>
                              {manuscript.tracking_id || 'N/A'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => setExpandedManuscriptId(isExpanded ? null : manuscript.id)}
                                className="action-icon-button edit"
                                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', padding: '6px' }}
                              >
                                ▼
                              </button>
                            </td>
                          </tr>

                          {/* Expansion Row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} style={{ backgroundColor: 'var(--surface)', padding: '32px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                  
                                  {/* Left Column: Scholarly Metadata & Author Card */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    
                                    {/* Metadata Card */}
                                    <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>📝</span> Manuscript Scholarly Metadata
                                      </h4>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                          <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>Title</strong>
                                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-dark)', lineHeight: '1.4' }}>{manuscript.title}</span>
                                        </div>

                                        <div>
                                          <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>Abstract</strong>
                                          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-dark)', opacity: 0.9 }}>
                                            {manuscript.abstract}
                                          </p>
                                        </div>

                                        <div>
                                          <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>Keywords</strong>
                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {manuscript.keywords.map(k => (
                                              <span key={k} style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-dark)', fontWeight: '500' }}>
                                                #{k}
                                              </span>
                                            ))}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
                                          <button 
                                            type="button"
                                            onClick={() => handleDownload(
                                              manuscript.manuscript_pdf_url,
                                              manuscript.tracking_id || '',
                                              manuscript.author_name || 'Author',
                                              manuscript.title,
                                              manuscript.id
                                            )}
                                            disabled={downloadingId === manuscript.id}
                                            className="btn-action primary"
                                            style={{ 
                                              display: 'inline-flex', 
                                              alignItems: 'center', 
                                              gap: '8px', 
                                              padding: '10px 16px', 
                                              borderRadius: '8px', 
                                              fontSize: '12px', 
                                              fontWeight: 'bold', 
                                              border: 'none', 
                                              cursor: 'pointer', 
                                              opacity: downloadingId === manuscript.id ? 0.6 : 1,
                                              backgroundColor: isRevised ? 'var(--success)' : 'var(--primary)',
                                              boxShadow: isRevised ? '0 4px 6px -1px rgba(34, 197, 94, 0.2)' : 'none'
                                            }}
                                          >
                                            {downloadingId === manuscript.id ? '⏳ Downloading...' : isRevised ? '🔄 Download Revised Manuscript (.docx)' : '📥 Download Document (.docx)'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Author Registry Card */}
                                    <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>👥</span> Flat Author Registry
                                      </h4>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Primary Author */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                          <strong style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Author</strong>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                                            <div>
                                              <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Name</span>
                                              <strong style={{ color: 'var(--text-dark)' }}>{authorName}</strong>
                                            </div>
                                            <div>
                                              <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Email</span>
                                              <strong style={{ color: 'var(--text-dark)' }}>{authorEmail}</strong>
                                            </div>
                                            <div>
                                              <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Phone</span>
                                              <strong style={{ color: 'var(--text-dark)' }}>{manuscript.author_phone || 'N/A'}</strong>
                                            </div>
                                            <div>
                                              <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Affiliation</span>
                                              <strong style={{ color: 'var(--text-dark)' }}>{manuscript.author_affiliation || 'N/A'}</strong>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Co-Authors */}
                                        <div>
                                          {(() => {
                                            let parsedCoAuthors: any[] = [];
                                            try {
                                              if (manuscript.co_authors) {
                                                parsedCoAuthors = typeof manuscript.co_authors === 'string' 
                                                  ? JSON.parse(manuscript.co_authors) 
                                                  : manuscript.co_authors;
                                              }
                                            } catch (e) {
                                              console.error('Error parsing co-authors:', e);
                                            }

                                            return (
                                              <>
                                                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Co-Authors ({parsedCoAuthors.length})</strong>
                                                {parsedCoAuthors.length === 0 ? (
                                                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>
                                                    No co-authors registered for this submission.
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {parsedCoAuthors.map((co, index) => (
                                                      <div key={index} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        <div>
                                                          <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Name</span>
                                                          <strong style={{ color: 'var(--text-dark)' }}>{co.name}</strong>
                                                        </div>
                                                        <div>
                                                          <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Affiliation</span>
                                                          <strong style={{ color: 'var(--text-dark)' }}>{co.affiliation || 'N/A'}</strong>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>

                                      </div>
                                    </div>

                                  </div>

                                  {/* Right Column: 4-Step Editorial Screening Pipeline */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    
                                    <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                                        <div>
                                          <h4 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                                            ⚙️ Editorial Screening Timeline
                                          </h4>
                                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                                            Screen submission and record milestone updates. Global status shifts automatically.
                                          </p>
                                        </div>
                                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                                          ID: {manuscript.tracking_id || 'No Tracking ID'}
                                        </div>
                                      </div>

                                      {/* Stepper Steps */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                                        {(() => {
                                          const steps = [
                                            { num: 1, title: 'Step 1: Document Style & Formatting Check', desc: 'Verify .docx compliance, headers, and reference styles.' },
                                            { num: 2, title: 'Step 2: Plagiarism & AI Detection Check', desc: 'Check originality scores, detect AI generation.' },
                                            { num: 3, title: 'Step 3: Peer Quality Review Check', desc: 'Verify academic logic flow and co-team consensus.' },
                                            { num: 4, title: 'Step 4: Editorial Board Approval Check', desc: 'Log board director approval to authorize publication.' },
                                            { num: 5, title: 'Step 5: APC Payment & Final Branding Check', desc: 'Verify APC receipt, apply NJLRII standard branding, header/footer formatting, and compile the final publication-ready version.' }
                                          ];

                                          return steps.map((step, idx) => {
                                            const savedStatus = (manuscript as any)[`step${step.num}_status`] || 'pending';
                                            const draftKey = `${manuscript.id}_${step.num}`;
                                            const currentStatus = draftStatus[draftKey] !== undefined 
                                              ? draftStatus[draftKey] 
                                              : savedStatus;
                                            const savedFeedback = (manuscript as any)[`step${step.num}_feedback`] || '';
                                            const currentFeedback = draftFeedback[draftKey] !== undefined 
                                              ? draftFeedback[draftKey] 
                                              : savedFeedback;
                                            const hasChanges = currentStatus !== savedStatus || currentFeedback !== savedFeedback;

                                            let statusColor = 'var(--muted)';
                                            let statusBg = 'var(--surface)';
                                            let statusBorder = 'var(--border)';
                                            let badgeText = 'Pending';

                                            if (currentStatus === 'passed') {
                                              statusColor = 'var(--success)';
                                              statusBg = 'rgba(34, 197, 94, 0.08)';
                                              statusBorder = 'rgba(34, 197, 94, 0.2)';
                                              badgeText = 'Passed';
                                            } else if (currentStatus === 'revision') {
                                              statusColor = 'var(--warning)';
                                              statusBg = 'rgba(245, 158, 11, 0.08)';
                                              statusBorder = 'rgba(245, 158, 11, 0.2)';
                                              badgeText = 'Revision';
                                            } else if (currentStatus === 'failed') {
                                              statusColor = 'var(--error)';
                                              statusBg = 'rgba(239, 68, 68, 0.08)';
                                              statusBorder = 'rgba(239, 68, 68, 0.2)';
                                              badgeText = 'Failed';
                                            }

                                            return (
                                              <div key={step.num} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                                                {idx < steps.length - 1 && (
                                                  <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '-24px', width: '2px', backgroundColor: 'var(--border)', zIndex: 1 }} />
                                                )}
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: statusBg, border: `2px solid ${statusColor}`, color: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', zIndex: 2, flexShrink: 0 }}>
                                                  {step.num}
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div>
                                                      <h5 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-dark)' }}>{step.title}</h5>
                                                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>{step.desc}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      {currentStatus === 'pending' && savedFeedback && (
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', color: 'var(--success)', backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
                                                          Revision Submitted
                                                        </span>
                                                      )}
                                                      {hasChanges && (
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                          <span className="pulse-dot-amber" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)', display: 'inline-block' }} />
                                                          Unsaved Changes
                                                        </span>
                                                      )}
                                                      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusBorder}`, textTransform: 'uppercase' }}>
                                                        {badgeText}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Interactive Controls */}
                                                  <div style={{
                                                    backgroundColor: 'var(--surface)',
                                                    padding: '14px',
                                                    borderRadius: '8px',
                                                    border: hasChanges ? '1px solid rgba(252, 4, 52, 0.3)' : '1px solid var(--border)',
                                                    boxShadow: hasChanges ? '0 0 12px rgba(252, 4, 52, 0.08)' : 'none',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '10px',
                                                    transition: 'all 0.25s ease-in-out'
                                                  }}>
                                                    
                                                    {currentStatus === 'pending' && savedFeedback && (
                                                      <div style={{
                                                        padding: '10px 12px',
                                                        backgroundColor: 'rgba(34, 197, 94, 0.04)',
                                                        borderLeft: '3px solid var(--success)',
                                                        borderRadius: '4px',
                                                        fontSize: '11.5px',
                                                        color: 'var(--text-dark)',
                                                        marginBottom: '8px',
                                                        lineHeight: '1.4'
                                                      }}>
                                                        <strong>🔄 Author Resubmitted:</strong> A revised document has been uploaded for this step. Please download the revised manuscript file, verify the changes against your feedback below, and select the new status.
                                                      </div>
                                                    )}
                                                    
                                                    {/* Selector pills */}
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)' }}>Set Status:</span>
                                                      {(['pending', 'passed', 'revision', 'failed'] as const).map(st => {
                                                        let pillColor = 'var(--muted)';
                                                        let activeBg = 'var(--border)';
                                                        if (st === 'passed') { pillColor = 'var(--success)'; activeBg = 'rgba(34, 197, 94, 0.15)'; }
                                                        if (st === 'revision') { pillColor = 'var(--warning)'; activeBg = 'rgba(245, 158, 11, 0.15)'; }
                                                        if (st === 'failed') { pillColor = 'var(--error)'; activeBg = 'rgba(239, 68, 68, 0.15)'; }

                                                        const isActive = currentStatus === st;
                                                        return (
                                                          <button
                                                            key={st}
                                                            type="button"
                                                            onClick={() => setDraftStatus(prev => ({ ...prev, [draftKey]: st }))}
                                                            style={{
                                                              fontSize: '11px',
                                                              padding: '4px 10px',
                                                              borderRadius: '20px',
                                                              border: isActive ? `1.5px solid ${pillColor}` : '1px solid var(--border)',
                                                              backgroundColor: isActive ? activeBg : 'white',
                                                              color: isActive ? pillColor : 'var(--text-dark)',
                                                              fontWeight: isActive ? 'bold' : 'normal',
                                                              cursor: 'pointer',
                                                              transition: 'all 0.2s ease-in-out'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              if (!isActive) {
                                                                e.currentTarget.style.borderColor = pillColor;
                                                                e.currentTarget.style.backgroundColor = 'var(--surface)';
                                                              }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              if (!isActive) {
                                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                                e.currentTarget.style.backgroundColor = 'white';
                                                              }
                                                            }}
                                                          >
                                                            {st.toUpperCase()}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>

                                                    {/* Feedback Area */}
                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '4px' }}>Feedback to Author</label>
                                                      <textarea
                                                        value={currentFeedback}
                                                        onChange={(e) => setDraftFeedback({
                                                          ...draftFeedback,
                                                          [draftKey]: e.target.value
                                                        })}
                                                        placeholder={`Enter feedback details for Step ${step.num} here...`}
                                                        style={{
                                                          width: '100%',
                                                          minHeight: '60px',
                                                          padding: '8px 12px',
                                                          fontSize: '12px',
                                                          borderRadius: '6px',
                                                          border: '1px solid var(--border)',
                                                          fontFamily: 'inherit',
                                                          resize: 'vertical'
                                                        }}
                                                      />
                                                    </div>

                                                    {/* Save Button */}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleUpdateMilestoneStatus(manuscript.id, step.num as any, currentStatus, currentFeedback)}
                                                        disabled={actionLoading || !hasChanges}
                                                        className={hasChanges && !actionLoading ? 'pulse-primary-btn' : ''}
                                                        style={{
                                                          fontSize: '11px',
                                                          padding: '6px 12px',
                                                          backgroundColor: hasChanges 
                                                            ? 'var(--primary)' 
                                                            : 'transparent',
                                                          color: hasChanges 
                                                            ? 'white' 
                                                            : 'var(--muted)',
                                                          border: hasChanges 
                                                            ? 'none' 
                                                            : '1px solid var(--border)',
                                                          borderRadius: '6px',
                                                          cursor: (actionLoading || !hasChanges) ? 'not-allowed' : 'pointer',
                                                          fontWeight: 'bold',
                                                          display: 'inline-flex',
                                                          alignItems: 'center',
                                                          gap: '4px',
                                                          transition: 'all 0.25s ease-in-out',
                                                          opacity: actionLoading ? 0.7 : 1
                                                        }}
                                                      >
                                                        {actionLoading ? (
                                                          <>⏳ Saving Step {step.num}...</>
                                                        ) : hasChanges ? (
                                                          <>💾 Save Step {step.num} Changes</>
                                                        ) : (
                                                          <>✓ Step Saved</>
                                                        )}
                                                      </button>
                                                    </div>

                                                  </div>

                                                </div>

                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>

                                      {/* Accept & Publish Trigger Button */}
                                      {manuscript.step1_status === 'passed' &&
                                       manuscript.step2_status === 'passed' &&
                                       manuscript.step3_status === 'passed' &&
                                       manuscript.step4_status === 'passed' &&
                                       manuscript.step5_status === 'passed' && (
                                        <div style={{
                                          marginTop: '24px',
                                          padding: '20px',
                                          backgroundColor: 'rgba(34, 197, 94, 0.05)',
                                          border: '2px dashed var(--success)',
                                          borderRadius: '12px',
                                          textAlign: 'center',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          gap: '12px'
                                        }}>
                                          <div style={{ fontSize: '24px' }}>🎉</div>
                                          <div>
                                            <strong style={{ fontSize: '14px', color: 'var(--success)' }}>All screening milestones PASSED!</strong>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                                              This paper is completely screened and approved by the board. Finalize compilation to release it to the dynamic public archive issues.
                                            </p>
                                          </div>
                                          <button
                                            onClick={() => openPublishModal(manuscript)}
                                            className="btn-action primary"
                                            style={{
                                              padding: '12px 24px',
                                              fontSize: '13px',
                                              fontWeight: 'bold',
                                              borderRadius: '8px',
                                              boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.2)',
                                              cursor: 'pointer'
                                            }}
                                            disabled={actionLoading || manuscript.status === 'accepted'}
                                          >
                                            📜 Accept & Publish Manuscript
                                          </button>
                                        </div>
                                      )}

                                    </div>

                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <Pagination
                currentPage={currentPage}
                totalCount={filteredManuscripts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                isLoading={dbLoading}
              />
              </>
            )}
          </div>
        </div>

        {/* Elegant Publish Modal */}
        {publishModalOpen && selectedManuscript && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="admin-card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="card-header-block">
                <h2 className="card-heading-title">📜 Academic Registry Publishing Form</h2>
                <button 
                  onClick={() => setPublishModalOpen(false)} 
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
                >
                  ✕
                </button>
              </div>

              <div className="card-body-content">
                <form onSubmit={handlePublishPaper} className="form-grid-layout" style={{ gridGap: '16px' }}>
                  
                  <div className="form-field-group col-span-12">
                    <label className="form-label-text">Manuscript Title</label>
                    <input
                      type="text"
                      value={selectedManuscript.title}
                      disabled
                      className="form-input-control"
                      style={{ opacity: 0.8 }}
                    />
                  </div>

                  <div className="form-field-group col-span-6">
                    <label className="form-label-text">URL Slug</label>
                    <input
                      type="text"
                      value={publishSlug}
                      onChange={(e) => setPublishSlug(e.target.value)}
                      className="form-input-control"
                      required
                    />
                  </div>

                  <div className="form-field-group col-span-6">
                    <label className="form-label-text">Assign to Issue Release</label>
                    <select
                      value={publishIssueId}
                      onChange={(e) => setPublishIssueId(e.target.value)}
                      className="form-input-control"
                      required
                    >
                      <option value="">Select Release Issue...</option>
                      {issues.map(iss => (
                        <option key={iss.id} value={iss.id}>
                          Volume {iss.volumes?.number} Issue {iss.number} ({iss.year})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field-group col-span-12" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label className="form-label-text">Academic Author Registry</label>
                      <button
                        type="button"
                        onClick={() => setPublishAuthors([...publishAuthors, { name: '', designation: '', affiliation: '' }])}
                        className="btn-action outline"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        ➕ Add Author
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {publishAuthors.map((author, index) => (
                        <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--surface)', padding: '10px', borderRadius: '6px' }}>
                          <input
                            type="text"
                            placeholder="Name"
                            value={author.name}
                            onChange={(e) => {
                              const updated = [...publishAuthors];
                              updated[index].name = e.target.value;
                              setPublishAuthors(updated);
                            }}
                            className="form-input-control"
                            style={{ flex: 1 }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Designation"
                            value={author.designation}
                            onChange={(e) => {
                              const updated = [...publishAuthors];
                              updated[index].designation = e.target.value;
                              setPublishAuthors(updated);
                            }}
                            className="form-input-control"
                            style={{ flex: 1 }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Affiliation"
                            value={author.affiliation}
                            onChange={(e) => {
                              const updated = [...publishAuthors];
                              updated[index].affiliation = e.target.value;
                              setPublishAuthors(updated);
                            }}
                            className="form-input-control"
                            style={{ flex: 1 }}
                          />
                          {publishAuthors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPublishAuthors(publishAuthors.filter((_, i) => i !== index))}
                              className="btn-action danger"
                              style={{ padding: '8px 10px' }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-field-group col-span-12" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setPublishModalOpen(false)}
                      className="btn-action outline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-action primary"
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Compiling Record...' : '💾 Confirm Accept & Publish'}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
