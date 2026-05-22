'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabase';
import { revalidateLiveSite } from '@/lib/revalidate';

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
  title?: string;
  created_at?: string;
  volumes?: Volume; // Joined table data
}

export default function IssuesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // State Management
  const [issues, setIssues] = useState<Issue[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [formData, setFormData] = useState({
    volume_id: '',
    number: '',
    year: new Date().getFullYear().toString(),
    title: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Deletion Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'BLOCK' | 'CONFIRM' | null;
    id: string;
    number: number;
    papersCount: number;
  }>({
    isOpen: false,
    type: null,
    id: '',
    number: 0,
    papersCount: 0
  });

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Load parent volumes & active issues
  const loadData = async () => {
    setDbLoading(true);
    try {
      // 1. Fetch volumes for selector
      const { data: volData, error: volError } = await supabase
        .from('volumes')
        .select('*')
        .order('number', { ascending: false });

      if (volError) throw volError;
      setVolumes(volData || []);

      // 2. Fetch issues with volume details join and pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: issData, count, error: issError } = await supabase
        .from('issues')
        .select('*, volumes(number, year)', { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, to);

      if (issError) throw issError;
      setIssues((issData as any) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to sync resources from database.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentPage]);

  if (loading || (user && !profile)) return <PageLoader message="Loading issues & releases..." />;
  if (!user || !profile) return null;

  // Role permissions
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) return <div style={{ padding: '24px' }}>Access denied.</div>;

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    const parentVolId = formData.volume_id.trim();
    const issNumber = parseInt(formData.number);
    const issYear = parseInt(formData.year);

    if (!parentVolId || isNaN(issNumber) || isNaN(issYear)) {
      setError('Please verify Volume selection, Issue number, and Calendar year are valid.');
      setActionLoading(false);
      return;
    }

    try {
      if (editingId) {
        // Edit Operation
        const { error: editError } = await supabase
          .from('issues')
          .update({
            volume_id: parentVolId,
            number: issNumber,
            year: issYear,
            title: formData.title || null,
          })
          .eq('id', editingId);

        if (editError) throw editError;
        setSuccess(`Successfully updated Issue ${issNumber}.`);
        setEditingId(null);
      } else {
        // Create Operation
        const { error: createError } = await supabase
          .from('issues')
          .insert({
            id: `${parentVolId}-issue-${issNumber}`,
            volume_id: parentVolId,
            number: issNumber,
            year: issYear,
            title: formData.title || null,
          });

        if (createError) throw createError;
        setSuccess(`Successfully registered Issue ${issNumber}.`);
      }

      setFormData({
        volume_id: '',
        number: '',
        year: new Date().getFullYear().toString(),
        title: '',
      });
      await loadData();
      revalidateLiveSite(); // Flush live site cache immediately
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Deletion Check & Open Dialog Modal
  const triggerDeleteCheck = async (id: string, num: number) => {
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      // Query relation to papers
      const { count, error: countError } = await supabase
        .from('papers')
        .select('*', { count: 'exact', head: true })
        .eq('issue_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        setDeleteModal({
          isOpen: true,
          type: 'BLOCK',
          id,
          number: num,
          papersCount: count
        });
      } else {
        setDeleteModal({
          isOpen: true,
          type: 'CONFIRM',
          id,
          number: num,
          papersCount: 0
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check issue relations.');
    } finally {
      setActionLoading(false);
    }
  };

  // Perform Final Database Deletion on Modal Confirm
  const confirmDelete = async () => {
    const { id, number } = deleteModal;
    setDeleteModal(prev => ({ ...prev, isOpen: false }));
    setActionLoading(true);

    try {
      const { error: delError } = await supabase.from('issues').delete().eq('id', id);
      if (delError) throw delError;
      setSuccess(`Successfully deleted Issue ${number}.`);
      await loadData();
      revalidateLiveSite(); // Flush live site cache immediately
    } catch (err: any) {
      setError(err.message || 'Failed to delete issue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Trigger
  const startEdit = (iss: Issue) => {
    setEditingId(iss.id);
    setFormData({
      volume_id: iss.volume_id.toString(),
      number: iss.number.toString(),
      year: iss.year.toString(),
      title: iss.title || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      volume_id: '',
      number: '',
      year: new Date().getFullYear().toString(),
      title: '',
    });
  };

  return (
    <DashboardShell pageTitle="Issues & Releases" currentRoute="/issues">
      <div className="form-grid-layout" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Alerts */}
        {error && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError('')} style={{ color: 'var(--error)', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        )}
        {success && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <span>✅ {success}</span>
            <button type="button" onClick={() => setSuccess('')} style={{ color: 'var(--success)', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        )}

        <div className="split-grid-editorial">
          
          {/* Left Column: Form Card */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">{editingId ? '✏️ Edit Issue Release' : '➕ Register Issue Release'}</h2>
            </div>
            <div className="card-body-content">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div className="form-field-group">
                  <label className="form-label-text">Select Parent Volume</label>
                  <select
                    value={formData.volume_id}
                    onChange={(e) => setFormData({ ...formData, volume_id: e.target.value })}
                    className="form-input-control"
                    required
                  >
                    <option value="">Choose Volume...</option>
                    {volumes.map(vol => (
                      <option key={vol.id} value={vol.id}>Volume {vol.number} ({vol.year})</option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Issue Sequence (Quarterly)</label>
                  <input
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="e.g. 1 (Issue 1)"
                    className="form-input-control"
                    required
                    min="1"
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Issue Calendar Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 2026"
                    className="form-input-control"
                    required
                    min="2000"
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Release Title (Optional)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Special Intellectual Property Issue"
                    className="form-input-control"
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {editingId && (
                    <button type="button" className="btn-action outline" style={{ flex: 1 }} onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-action primary" style={{ flex: 2 }} disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : editingId ? 'Update Issue' : 'Save Issue'}
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Right Column: Listing Table */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">Scheduled Releases</h2>
            </div>
            <div className="card-body-content" style={{ padding: 0 }}>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>ID</th>
                      <th>Issue Details</th>
                      <th>Linked Volume</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                          Retrieving issues and volume links...
                        </td>
                      </tr>
                    ) : issues.length > 0 ? (
                      issues.map((iss) => {
                        const isCurrentlyEditing = editingId === iss.id;
                        return (
                          <tr key={iss.id} style={isCurrentlyEditing ? { backgroundColor: 'rgba(252, 4, 52, 0.04)', borderLeft: '3px solid var(--primary)' } : {}}>
                            <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>#{iss.id}</td>
                            <td>
                              <div style={{ fontWeight: 'bold' }}>Issue {iss.number} ({iss.year})</div>
                              {iss.title && (
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{iss.title}</div>
                              )}
                            </td>
                            <td>
                              {iss.volumes ? (
                                <span className="status-pill-badge info">Vol {iss.volumes.number}</span>
                              ) : (
                                <span className="status-pill-badge error">Orphaned</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => startEdit(iss)} className="action-icon-button edit" title="Edit issue" style={isCurrentlyEditing ? { borderColor: 'var(--primary)', color: 'var(--primary)', backgroundColor: 'rgba(252, 4, 52, 0.05)' } : {}}>
                                  ✏️
                                </button>
                                <button onClick={() => triggerDeleteCheck(iss.id, iss.number)} className="action-icon-button delete" title="Delete issue">
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                          No scheduled issues found. Use the left panel to schedule your first quarterly release.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                isLoading={dbLoading}
              />
            </div>
          </div>

        </div>

      </div>

      {/* Custom Deletion Modal Overlay */}
      {deleteModal.isOpen && (
        <div className="confirm-modal-overlay" style={{ animation: 'modalFadeIn 0.2s ease-out forwards' }}>
          <div className="confirm-modal-card">
            <div className={`confirm-modal-header ${deleteModal.type === 'BLOCK' ? 'warning' : 'danger'}`}>
              <span style={{ fontSize: '20px' }}>{deleteModal.type === 'BLOCK' ? '🚫' : '⚠️'}</span>
              <h3 className="confirm-modal-title">
                {deleteModal.type === 'BLOCK' ? 'Deletion Blocked' : 'Confirm Issue Deletion'}
              </h3>
            </div>
            <div className="confirm-modal-body">
              {deleteModal.type === 'BLOCK' ? (
                <>
                  <p>
                    The system has prevented the deletion of <strong>Issue {deleteModal.number}</strong> to preserve live site relational integrity.
                  </p>
                  <div className="confirm-modal-block-box">
                    This issue sequence is currently linked to <strong>{deleteModal.papersCount} published research paper(s)</strong>.
                    Deleting it would orphan these papers and cause layout breakages or missing tables for readers on the public site.
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    To proceed, please go to the <strong>Research Papers Index</strong>, then delete or reassign all published papers associated with this issue.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You are about to permanently delete <strong>Issue {deleteModal.number}</strong> from the academic scheduled releases catalog.
                  </p>
                  <div className="confirm-modal-warning-box">
                    ⚠️ <strong>CRITICAL WARNING:</strong> This action is completely irreversible. Any papers index references and dynamic release feeds on the public live site will lose their parent issue immediately.
                  </div>
                  <p style={{ fontWeight: '500' }}>Are you sure you want to proceed with this administrative deletion?</p>
                </>
              )}
            </div>
            <div className="confirm-modal-footer">
              {deleteModal.type === 'BLOCK' ? (
                <button 
                  type="button" 
                  className="btn-action primary" 
                  onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Close Dialog
                </button>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn-action outline" 
                    onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn-action primary" 
                    style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)', color: '#ffffff' }}
                    onClick={confirmDelete}
                  >
                    Yes, Delete Issue
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
