'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';
import { revalidateLiveSite } from '@/lib/revalidate';

interface Volume {
  id: string;
  number: number;
  year: string;
  created_at?: string;
}

export default function VolumesPage() {
  const { user, profile, loading } = { ...useAuth() };
  const router = useRouter();

  // State Management
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [formData, setFormData] = useState({ number: '', year: new Date().getFullYear().toString() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Deletion Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'BLOCK' | 'CONFIRM' | null;
    id: string;
    number: number;
    issuesCount: number;
  }>({
    isOpen: false,
    type: null,
    id: '',
    number: 0,
    issuesCount: 0
  });

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Load Volumes
  const loadVolumes = async () => {
    setDbLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('volumes')
        .select('*')
        .order('number', { ascending: false });

      if (dbError) throw dbError;
      setVolumes(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch volumes.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadVolumes();
    }
  }, [user]);

  if (loading || (user && !profile)) return <PageLoader message="Loading volumes..." />;
  if (!user || !profile) return null;

  // Role permissions
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) return <div style={{ padding: '24px' }}>Access denied.</div>;

  // Helper to parse Roman numerals or Integers to support Roman inputs
  const parseVolumeNumber = (val: string): number => {
    const parsed = parseInt(val);
    if (!isNaN(parsed)) return parsed;

    const roman = val.toUpperCase().trim();
    if (!roman) return NaN;

    const romanMap: { [key: string]: number } = {
      I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
    };
    
    if (!/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman)) {
      return NaN;
    }

    let result = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]];
      if (!current) return NaN;
      if (next && current < next) {
        result += next - current;
        i++;
      } else {
        result += current;
      }
    }
    return result;
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    const volNumber = parseVolumeNumber(formData.number);
    const volYear = formData.year.trim();

    if (isNaN(volNumber) || !volYear) {
      setError('Please provide a valid Volume Number (integer or Roman numeral) and Calendar Year.');
      setActionLoading(false);
      return;
    }

    try {
      if (editingId) {
        // Edit Operation
        const { error: editError } = await supabase
          .from('volumes')
          .update({ number: volNumber, year: volYear })
          .eq('id', editingId);

        if (editError) throw editError;
        setSuccess(`Successfully updated Volume ${volNumber}.`);
        setEditingId(null);
      } else {
        // Create Operation
        const { error: createError } = await supabase
          .from('volumes')
          .insert({
            id: `vol-${volNumber}`,
            number: volNumber,
            year: volYear
          });

        if (createError) throw createError;
        setSuccess(`Successfully created Volume ${volNumber}.`);
      }

      setFormData({ number: '', year: new Date().getFullYear().toString() });
      await loadVolumes();
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
      // Query relation to issues
      const { count, error: countError } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('volume_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        setDeleteModal({
          isOpen: true,
          type: 'BLOCK',
          id,
          number: num,
          issuesCount: count
        });
      } else {
        setDeleteModal({
          isOpen: true,
          type: 'CONFIRM',
          id,
          number: num,
          issuesCount: 0
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check volume relations.');
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
      const { error: delError } = await supabase.from('volumes').delete().eq('id', id);
      if (delError) throw delError;
      setSuccess(`Successfully deleted Volume ${number}.`);
      await loadVolumes();
      revalidateLiveSite(); // Flush live site cache immediately
    } catch (err: any) {
      setError(err.message || 'Failed to delete volume.');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Trigger
  const startEdit = (vol: Volume) => {
    setEditingId(vol.id);
    setFormData({ number: vol.number.toString(), year: vol.year.toString() });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ number: '', year: new Date().getFullYear().toString() });
  };

  return (
    <DashboardShell pageTitle="Academic Volumes Manager" currentRoute="/volumes">
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
          
          {/* Left Column: Form Panel */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">{editingId ? '✏️ Edit Volume' : '➕ Register Volume'}</h2>
            </div>
            <div className="card-body-content">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div className="form-field-group">
                  <label className="form-label-text">Volume Number (Roman or Int)</label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="e.g. 5 or VII"
                    className="form-input-control"
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Volume Calendar Year</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 2026-27 or 2026"
                    className="form-input-control"
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {editingId && (
                    <button type="button" className="btn-action outline" style={{ flex: 1 }} onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-action primary" style={{ flex: 2 }} disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : editingId ? 'Update Volume' : 'Save Volume'}
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Right Column: Listing Grid */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">Registered Volumes</h2>
            </div>
            <div className="card-body-content" style={{ padding: 0 }}>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>ID</th>
                      <th>Volume Designation</th>
                      <th>Calendar Year</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                          Retrieving volumes from academic database...
                        </td>
                      </tr>
                    ) : volumes.length > 0 ? (
                      volumes.map((vol) => {
                        const isCurrentlyEditing = editingId === vol.id;
                        return (
                          <tr key={vol.id} style={isCurrentlyEditing ? { backgroundColor: 'rgba(252, 4, 52, 0.04)', borderLeft: '3px solid var(--primary)' } : {}}>
                            <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>#{vol.id}</td>
                            <td>
                              <strong>Volume {vol.number}</strong>
                            </td>
                            <td>{vol.year}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => startEdit(vol)} className="action-icon-button edit" title="Edit volume" style={isCurrentlyEditing ? { borderColor: 'var(--primary)', color: 'var(--primary)', backgroundColor: 'rgba(252, 4, 52, 0.05)' } : {}}>
                                  ✏️
                                </button>
                                <button onClick={() => triggerDeleteCheck(vol.id, vol.number)} className="action-icon-button delete" title="Delete volume">
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
                          No volumes created yet. Use the left panel to register your first volume.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                {deleteModal.type === 'BLOCK' ? 'Deletion Blocked' : 'Confirm Volume Deletion'}
              </h3>
            </div>
            <div className="confirm-modal-body">
              {deleteModal.type === 'BLOCK' ? (
                <>
                  <p>
                    The system has prevented the deletion of <strong>Volume {deleteModal.number}</strong> to preserve live site relational integrity.
                  </p>
                  <div className="confirm-modal-block-box">
                    This volume is currently linked to <strong>{deleteModal.issuesCount} active issue release(s)</strong>.
                    Deleting it would orphan these releases and break dynamic filters/archives on the public website.
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    To proceed, please go to the <strong>Issues & Releases</strong> page, then delete or reassign all issues associated with this volume.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You are about to permanently delete <strong>Volume {deleteModal.number}</strong> from the academic repository catalog index.
                  </p>
                  <div className="confirm-modal-warning-box">
                    ⚠️ <strong>CRITICAL WARNING:</strong> This action is completely irreversible. Any issues and navigation menus referencing this volume on the public live site will lose their parent volume relationship immediately.
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
                    Yes, Delete Volume
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
