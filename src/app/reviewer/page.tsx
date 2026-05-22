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
  title: string;
  abstract: string;
  keywords: string[];
  manuscript_pdf_url: string;
  status: string;
  created_at: string;
  tracking_id?: string;
}

interface ReviewerAssignment {
  id: number;
  manuscript_id: number;
  reviewer_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  assigned_at: string;
  completed_at: string | null;
  manuscripts?: Manuscript;
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

export default function ReviewerPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Core reviewer states
  const [assignments, setAssignments] = useState<ReviewerAssignment[]>([]);
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Evaluating Workspace States
  const [activeAssignment, setActiveAssignment] = useState<ReviewerAssignment | null>(null);
  const [scoreOriginality, setScoreOriginality] = useState<number>(7);
  const [scoreStructure, setScoreStructure] = useState<number>(7);
  const [scoreCitation, setScoreCitation] = useState<number>(7);
  const [commentsAuthor, setCommentsAuthor] = useState('');
  const [commentsEditor, setCommentsEditor] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // File download state & helper for Double-Blind Reviewer (preserving anonymity by omitting author name)
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = async (url: string, trackingId: string, title: string, manuscriptId: number) => {
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
      
      const cleanTitle = (title || 'Manuscript').trim().replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50).replace(/\s+/g, '_');
      const filename = `[${trackingId || 'REVIEW'}]_${cleanTitle}.${extension}`;

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

  // Load Reviewer Assignments & Submissions
  const loadReviewerData = async () => {
    if (!user) return;
    setDbLoading(true);
    setError('');
    try {
      // 1. Fetch reviewer assignments along with manuscript details
      const { data: assignmentsData, error: assError } = await supabase
        .from('reviewer_assignments')
        .select('*, manuscripts(*)')
        .eq('reviewer_id', user.id)
        .order('assigned_at', { ascending: false });

      if (assError) throw assError;

      // 2. Fetch completed reviews
      const assignmentIds = (assignmentsData || []).map(a => a.id);
      let reviewsData: PeerReview[] = [];
      if (assignmentIds.length > 0) {
        const { data, error: revError } = await supabase
          .from('peer_reviews')
          .select('*')
          .in('assignment_id', assignmentIds);
        
        if (revError) throw revError;
        reviewsData = data || [];
      }

      setAssignments((assignmentsData as any) || []);
      setReviews(reviewsData);
    } catch (err: any) {
      console.error('Error loading reviewer data:', err);
      setError(err.message || 'Failed to load assigned evaluations.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadReviewerData();
    }
  }, [user]);

  if (loading || (user && !profile)) return <PageLoader message="Loading reviewer board..." />;
  if (!user || !profile) return null;

  // Role verification: Reviewers
  const isReviewer = profile.role === 'reviewer' || profile.role === 'super_admin' || profile.role === 'editor';
  if (!isReviewer) {
    return <div style={{ padding: '24px', textAlign: 'center', fontWeight: 'bold' }}>Access Denied. Reviewers profile only.</div>;
  }

  // Handle Accept/Decline pending reviews
  const handleUpdateAssignmentStatus = async (assignmentId: number, status: 'accepted' | 'declined') => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const { error: patchError } = await supabase
        .from('reviewer_assignments')
        .update({ status })
        .eq('id', assignmentId);

      if (patchError) throw patchError;

      setSuccess(`Evaluation request successfully ${status}.`);
      await loadReviewerData();
    } catch (err: any) {
      setError(err.message || 'Failed to update request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Evaluation Form
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!activeAssignment) return;

    setActionLoading(true);
    try {
      // 1. Submit to peer_reviews
      const { error: insertError } = await supabase
        .from('peer_reviews')
        .insert({
          assignment_id: activeAssignment.id,
          score_originality: scoreOriginality,
          score_structure: scoreStructure,
          score_citation: scoreCitation,
          comments_for_author: commentsAuthor,
          comments_for_editor: commentsEditor
        });

      if (insertError) throw insertError;

      // 2. Update assignment status to completed
      const { error: updateError } = await supabase
        .from('reviewer_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', activeAssignment.id);

      if (updateError) throw updateError;

      setSuccess('Scholarly peer review evaluation registered successfully. Thank you for your review!');
      setActiveAssignment(null);
      // Reset form fields
      setScoreOriginality(7);
      setScoreStructure(7);
      setScoreCitation(7);
      setCommentsAuthor('');
      setCommentsEditor('');
      
      await loadReviewerData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingAssignments = assignments.filter(a => a.status === 'pending');
  const activeAssignments = assignments.filter(a => a.status === 'accepted');
  const completedAssignments = assignments.filter(a => a.status === 'completed');

  // Pagination for each section
  const paginatedPendingAssignments = pendingAssignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <DashboardShell pageTitle="Reviewer Board" currentRoute="/reviewer">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Status Messages */}
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

        {dbLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
            Loading your assigned academic manuscript registry...
          </div>
        ) : activeAssignment ? (
          
          /* Full Page Interactive Scorecard Workspace */
          <div className="admin-card">
            <div className="card-header-block" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <span className="status-pill-badge warning" style={{ marginBottom: '8px' }}>Evaluating Manuscript</span>
                <h2 className="card-heading-title" style={{ fontSize: '18px', marginTop: '4px' }}>
                  {activeAssignment.manuscripts?.title}
                </h2>
              </div>
              <button 
                onClick={() => setActiveAssignment(null)}
                className="btn-action outline"
                style={{ padding: '8px 14px' }}
              >
                ✕ Cancel Workspace
              </button>
            </div>

            <div className="card-body-content" style={{ padding: '24px' }}>
              <div className="form-grid-layout" style={{ gridGap: '32px' }}>
                
                {/* Left Panel: Manuscript abstract & resources */}
                <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold' }}>Scholarly Abstract</h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-dark)', opacity: 0.9 }}>
                      {activeAssignment.manuscripts?.abstract}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)' }}>Keywords</h4>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {activeAssignment.manuscripts?.keywords.map(k => (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--border)', borderRadius: '4px' }}>
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>📄 Evaluation Document</h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--muted)' }}>
                      Download the full complete manuscript manuscript with standard headers and footnotes for comprehensive validation.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownload(
                        activeAssignment.manuscripts?.manuscript_pdf_url || '',
                        activeAssignment.manuscripts?.tracking_id || '',
                        activeAssignment.manuscripts?.title || '',
                        activeAssignment.manuscripts?.id || 0
                      )}
                      disabled={downloadingId === activeAssignment.manuscripts?.id}
                      className="btn-action primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '12px', border: 'none', cursor: 'pointer', opacity: downloadingId === activeAssignment.manuscripts?.id ? 0.6 : 1 }}
                    >
                      {downloadingId === activeAssignment.manuscripts?.id ? '⏳ Downloading...' : '📥 Download Manuscript Document (.docx)'}
                    </button>
                  </div>
                </div>

                {/* Right Panel: Peer Evaluation Scorecard */}
                <div className="col-span-6 desktop-border-left" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
                  <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚖️ Peer Reviewer Scorecard
                    </h3>

                    {/* Originality Score */}
                    <div className="form-field-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label-text" style={{ fontWeight: 'bold' }}>1. Research Originality & Novelty</label>
                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: 'var(--primary)' }}>{scoreOriginality} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={scoreOriginality}
                        onChange={(e) => setScoreOriginality(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        Assess the paper's contribution to existing jurisprudence and scholarly literature.
                      </span>
                    </div>

                    {/* Structure Score */}
                    <div className="form-field-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label-text" style={{ fontWeight: 'bold' }}>2. Structuring & Legal Reasoning</label>
                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: 'var(--primary)' }}>{scoreStructure} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={scoreStructure}
                        onChange={(e) => setScoreStructure(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        Evaluate the formatting flow, grammatical structure, logical arguments and readability.
                      </span>
                    </div>

                    {/* Citation Score */}
                    <div className="form-field-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label-text" style={{ fontWeight: 'bold' }}>3. Academic Citation Rigor</label>
                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold', color: 'var(--primary)' }}>{scoreCitation} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={scoreCitation}
                        onChange={(e) => setScoreCitation(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        Rigorous verification of citations matching standard guides (e.g. Bluebook 21st Edition).
                      </span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)' }} />

                    {/* Feedback for Author */}
                    <div className="form-field-group">
                      <label className="form-label-text">Anonymous Feedback for the Author(s)</label>
                      <textarea
                        value={commentsAuthor}
                        onChange={(e) => setCommentsAuthor(e.target.value)}
                        placeholder="Provide concrete scholarly advice for structural or research improvements. This is shared with the author."
                        className="form-input-control"
                        style={{ minHeight: '110px', resize: 'vertical' }}
                        required
                      />
                    </div>

                    {/* Confidential Feedback for Editor */}
                    <div className="form-field-group">
                      <label className="form-label-text">Confidential Comments for the Editorial Board</label>
                      <textarea
                        value={commentsEditor}
                        onChange={(e) => setCommentsEditor(e.target.value)}
                        placeholder="Confidential justifications for acceptance or rejection. Only visible to editors."
                        className="form-input-control"
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        required
                      />
                    </div>

                    {/* Submit CTA */}
                    <button
                      type="submit"
                      className="btn-action primary"
                      style={{ padding: '14px', width: '100%', justifyContent: 'center', fontWeight: 'bold', marginTop: '12px' }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Saving Review Record...' : '💾 Submit Evaluation Scorecard'}
                    </button>

                  </form>
                </div>

              </div>
            </div>
          </div>

        ) : (
          
          /* Regular Dashboard View */
          <>
            {/* 1. Pending Assignment Invites */}
            <div className="admin-card">
              <div className="card-header-block">
                <h2 className="card-heading-title">📥 Peer Review Invitations ({pendingAssignments.length})</h2>
              </div>
              <div className="card-body-content" style={{ padding: 0 }}>
                {pendingAssignments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No new evaluation invites currently pending your response.
                  </div>
                ) : (
                  <div className="table-responsive-wrapper">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>Title / Abstract Snippet</th>
                          <th style={{ width: '150px' }}>Received Date</th>
                          <th style={{ width: '220px', textAlign: 'center' }}>Respond</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPendingAssignments.map(asg => (
                          <tr key={asg.id}>
                            <td>
                              <div style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>{asg.manuscripts?.title}</div>
                              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--muted)', lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {asg.manuscripts?.abstract}
                              </p>
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              {new Date(asg.assigned_at).toLocaleDateString()}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleUpdateAssignmentStatus(asg.id, 'accepted')}
                                  className="btn-action primary"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  disabled={actionLoading}
                                >
                                  Accept Review
                                </button>
                                <button
                                  onClick={() => handleUpdateAssignmentStatus(asg.id, 'declined')}
                                  className="btn-action danger"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  disabled={actionLoading}
                                >
                                  Decline
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination for Pending Assignments */}
                <Pagination
                  currentPage={currentPage}
                  totalCount={pendingAssignments.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  isLoading={dbLoading}
                />
              </div>
            </div>

            {/* 2. Active Evaluations Queue */}
            <div className="admin-card">
              <div className="card-header-block">
                <h2 className="card-heading-title">🔬 Active Evaluation Workspace ({activeAssignments.length})</h2>
              </div>
              <div className="card-body-content" style={{ padding: 0 }}>
                {activeAssignments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    No active evaluation assignments. Accept an invitation above to begin.
                  </div>
                ) : (
                  <div className="table-responsive-wrapper">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th style={{ width: '150px' }}>Keywords</th>
                          <th style={{ width: '150px', textAlign: 'center' }}>Workspace</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeAssignments.map(asg => (
                          <tr key={asg.id}>
                            <td>
                              <strong style={{ color: 'var(--text-dark)' }}>{asg.manuscripts?.title}</strong>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {asg.manuscripts?.keywords.slice(0, 3).map(k => (
                                  <span key={k} style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: 'var(--border)', borderRadius: '4px' }}>
                                    #{k}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => setActiveAssignment(asg)}
                                className="btn-action primary"
                                style={{ padding: '8px 16px', fontSize: '12px' }}
                              >
                                ✍️ Enter Scorecard
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Completed Peer Review History */}
            <div className="admin-card">
              <div className="card-header-block">
                <h2 className="card-heading-title">📜 Completed Evaluation History ({completedAssignments.length})</h2>
              </div>
              <div className="card-body-content" style={{ padding: 0 }}>
                {completedAssignments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    You have not submitted any completed review scorecards yet.
                  </div>
                ) : (
                  <div className="table-responsive-wrapper">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>Manuscript Title</th>
                          <th style={{ width: '160px', textAlign: 'center' }}>Originality / Struct. / Cit.</th>
                          <th style={{ width: '140px' }}>Completed Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedAssignments.map(asg => {
                          const reviewData = reviews.find(r => r.assignment_id === asg.id);
                          return (
                            <tr key={asg.id}>
                              <td>
                                <span style={{ fontWeight: 600 }}>{asg.manuscripts?.title}</span>
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 'bold' }}>
                                {reviewData ? (
                                  <span style={{ color: 'var(--primary)' }}>
                                    {reviewData.score_originality} / {reviewData.score_structure} / {reviewData.score_citation}
                                  </span>
                                ) : (
                                  '--'
                                )}
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                {asg.completed_at ? new Date(asg.completed_at).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </DashboardShell>
  );
}
