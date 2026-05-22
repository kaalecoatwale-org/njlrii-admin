'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';
import { revalidateLiveSite } from '@/lib/revalidate';

interface Author {
  name: string;
  designation: string;
  affiliation?: string;
}

interface Volume {
  id: string;
  number: number;
  year: string;
}

interface Issue {
  id: string;
  volume_id: string;
  number: number;
  year: number;
  volumes?: Volume;
}

interface Paper {
  id: number;
  issue_id: string;
  title: string;
  abstract: string;
  keywords: string[];
  pdf_url: string;
  slug: string;
  author_metadata: Author[];
  published_at?: string;
  created_at: string;
  issues?: Issue;
}

export default function PapersPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // State Management
  const [papers, setPapers] = useState<Paper[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deletion Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: number | null;
    title: string;
  }>({
    isOpen: false,
    id: null,
    title: ''
  });

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Load Issues list (once on mount)
  const loadIssues = async () => {
    try {
      const { data: issData, error: issError } = await supabase
        .from('issues')
        .select('*, volumes(number, year)')
        .order('id', { ascending: false });

      if (issError) throw issError;
      setIssues((issData as any) || []);
    } catch (err: any) {
      console.error('Failed to load issues registry list:', err.message);
    }
  };

  // Load Papers based on active pagination and filters
  const loadPapers = async () => {
    setDbLoading(true);
    setError('');
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('papers')
        .select('*, issues(*, volumes(*))', { count: 'exact' });

      // Apply issue filter
      if (selectedIssue) {
        query = query.eq('issue_id', selectedIssue);
      }

      // Apply search filter (Title and Slug server-side matches)
      if (search) {
        query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      const { data: papData, count, error: papError } = await query
        .order('id', { ascending: false })
        .range(from, to);

      if (papError) throw papError;
      setPapers((papData as any) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch published papers registry.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadIssues();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPapers();
    }
  }, [user, currentPage, selectedIssue, search]);

  if (loading || (user && !profile)) return <PageLoader message="Loading research papers..." />;
  if (!user || !profile) return null;

  // Role permissions check
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) return <div style={{ padding: '24px' }}>Access denied.</div>;

  // Copy ID to Clipboard Handler
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Trigger Custom Visual Confirmation Modal
  const triggerDeleteCheck = (id: number, title: string) => {
    setDeleteModal({
      isOpen: true,
      id,
      title
    });
  };

  // Perform actual Supabase deletion on modal accept
  const confirmDelete = async () => {
    const { id, title } = deleteModal;
    if (id === null) return;
    setDeleteModal({ isOpen: false, id: null, title: '' });
    setError('');
    setSuccess('');
    setDbLoading(true);

    try {
      const { error: delError } = await supabase
        .from('papers')
        .delete()
        .eq('id', id);

      if (delError) throw delError;
      setSuccess(`Successfully deleted research paper: "${title}"`);
      revalidateLiveSite(); // Flush live site cache immediately
      
      // Adjust current page if needed
      if (papers.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await loadPapers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete paper record.');
    } finally {
      setDbLoading(false);
    }
  };

  return (
    <DashboardShell pageTitle="Research Papers Index" currentRoute="/papers">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Alerts */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ✅ {success}
          </div>
        )}

        <div className="admin-card">
          {/* Card Header & Query Controls */}
          <div className="card-header-block" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <h2 className="card-heading-title">Published Research Index</h2>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search title, slug..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1); // Reset page on filter
                }}
                className="form-input-control filter-search-input"
              />

              <select
                value={selectedIssue}
                onChange={(e) => {
                  setSelectedIssue(e.target.value);
                  setCurrentPage(1); // Reset page on filter
                }}
                className="form-input-control filter-select-input"
              >
                <option value="">All Release Issues</option>
                {issues.map((iss) => (
                  <option key={iss.id} value={iss.id}>
                    Volume {iss.volumes?.number} Issue {iss.number} ({iss.year})
                  </option>
                ))}
              </select>

              <button 
                onClick={() => router.push('/papers/new')} 
                className="btn-action primary"
                style={{ cursor: 'pointer' }}
              >
                ➕ Publish New Paper
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="card-body-content" style={{ padding: 0 }}>
            <div className="table-responsive-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>ID</th>
                    <th>Manuscript Details</th>
                    <th>Authors Registry</th>
                    <th>Assigned Issue</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dbLoading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        Loading index records from academic library...
                      </td>
                    </tr>
                  ) : papers.length > 0 ? (
                    papers.map((paper) => (
                      <tr key={paper.id}>
                        {/* Interactive Ellipsis Monospace ID Chip */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div 
                            className="monospace-id-chip" 
                            onClick={() => handleCopyId(paper.id.toString())}
                            title="Click to copy full paper unique ID"
                          >
                            <span>#{paper.id}</span>
                            <span className="copy-id-icon">
                              {copiedId === paper.id.toString() ? '✅' : '📋'}
                            </span>
                          </div>
                        </td>

                        {/* Title, Badge & Horizontal PDF link */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14.5px', marginBottom: '6px', lineHeight: '1.4' }}>
                            {paper.title}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="status-pill-badge success">
                              <span className="status-pulse-dot" />
                              Open Access
                            </span>
                            <a 
                              href={paper.pdf_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="premium-pdf-badge"
                            >
                              📕 PDF ↗
                            </a>
                          </div>
                        </td>

                        {/* Beautifully Spaced Academic Authors Stack */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="author-stack-container">
                            {paper.author_metadata && paper.author_metadata.length > 0 ? (
                              paper.author_metadata.map((author, index) => (
                                <div key={index} className="author-stack-item">
                                  <span className="author-stack-name">{author.name}</span>
                                  <span className="author-stack-affiliation">
                                    {author.affiliation || 'Independent Scholar'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '12.5px', fontStyle: 'italic' }}>Anonymous Author</span>
                            )}
                          </div>
                        </td>

                        {/* Branded Issue Badge */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {paper.issues ? (
                            <span className="status-pill-badge info">
                              Vol {paper.issues.volumes?.number} Iss {paper.issues.number}
                            </span>
                          ) : (
                            <span className="status-pill-badge error">Orphaned</span>
                          )}
                        </td>

                        {/* Premium SVG Actions */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => router.push(`/papers/edit/${paper.id}`)}
                              className="action-icon-button edit"
                              title="Edit paper details"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => triggerDeleteCheck(paper.id, paper.title)}
                              className="action-icon-button delete"
                              title="Delete paper record"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        No published research papers found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Premium Paginated Navigation Footer Bar */}
            {!dbLoading && totalCount > 0 && (
              <div className="pagination-bar-wrapper">
                <div className="pagination-info-text">
                  Showing <span>{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</span> to{' '}
                  <span>{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
                  <span>{totalCount}</span> published papers
                </div>

                <div className="pagination-controls-flex">
                  {/* First Page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="pagination-btn-nav"
                    title="First Page"
                  >
                    «
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="pagination-btn-nav"
                    title="Previous Page"
                  >
                    ‹
                  </button>

                  {/* Numeric Direct-Jump Buttons with Dynamic Ellipses */}
                  {(() => {
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const pages = [];
                    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                      // Show boundaries and pages near current page
                      const shouldShow =
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - currentPage) <= 1;

                      if (shouldShow) {
                        pages.push(
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`pagination-btn-nav ${currentPage === pageNum ? 'active-page' : ''}`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else {
                        // Render ellipses gaps
                        if (
                          (pageNum === 2 && currentPage > 3) ||
                          (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                        ) {
                          pages.push(
                            <span 
                              key={`ellipse-${pageNum}`} 
                              style={{ color: 'var(--muted)', padding: '0 6px', fontWeight: '700', userSelect: 'none' }}
                            >
                              ...
                            </span>
                          );
                        }
                      }
                    }
                    return pages;
                  })()}

                  {/* Next Page */}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(totalCount / pageSize)))}
                    disabled={currentPage === Math.ceil(totalCount / pageSize)}
                    className="pagination-btn-nav"
                    title="Next Page"
                  >
                    ›
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                    disabled={currentPage === Math.ceil(totalCount / pageSize)}
                    className="pagination-btn-nav"
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Custom Deletion Modal Overlay */}
      {deleteModal.isOpen && (
        <div className="confirm-modal-overlay" style={{ animation: 'modalFadeIn 0.2s ease-out forwards' }}>
          <div className="confirm-modal-card">
            <div className="confirm-modal-header danger">
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <h3 className="confirm-modal-title">Confirm Paper Deletion</h3>
            </div>
            <div className="confirm-modal-body">
              <p>
                You are about to permanently delete the published research manuscript: <br />
                <strong>"{deleteModal.title}"</strong>
              </p>
              <div className="confirm-modal-warning-box">
                ⚠️ <strong>CRITICAL WARNING:</strong> This action is completely irreversible. The article, its PDF document indexing, metadata, and citation records will be permanently removed from the public website archives immediately.
              </div>
              <p style={{ fontWeight: '500' }}>Are you sure you want to proceed with this administrative deletion?</p>
            </div>
            <div className="confirm-modal-footer">
              <button 
                type="button" 
                className="btn-action outline" 
                onClick={() => setDeleteModal({ isOpen: false, id: null, title: '' })}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-action primary" 
                style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)', color: '#ffffff' }}
                onClick={confirmDelete}
              >
                Yes, Delete Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
