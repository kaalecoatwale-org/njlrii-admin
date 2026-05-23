'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabase';

type Role = 'super_admin' | 'editor' | 'student_editor' | 'reviewer' | 'author';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

const ROLES: { value: Role; label: string; color: string }[] = [
  { value: 'super_admin', label: 'Editor-in-Chief', color: '#ff3b5e' },
  { value: 'editor', label: 'Associate Editor', color: '#7c3aed' },
  { value: 'student_editor', label: 'Student Editor', color: '#0891b2' },
  { value: 'reviewer', label: 'Peer Reviewer', color: '#d97706' },
  { value: 'author', label: 'Author', color: '#059669' },
];

const getRoleConfig = (role: Role) => ROLES.find(r => r.value === role) || ROLES[4];

export default function UsersPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('author');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; role: Role; fullName: string } | null>(null);

  // Update role state
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auth guard
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  const loadUsers = async () => {
    setDbLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers((data as UserProfile[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadUsers();
  }, [user]);

  // Filter logic
  useEffect(() => {
    let result = [...users];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }
    setFilteredUsers(result);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [users, searchQuery, roleFilter]);

  // Pagination logic - calculate paginated users
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading || (user && !profile)) return <PageLoader message="Loading user directory..." />;
  if (!user || !profile) return null;

  // Only super_admin can access
  if (profile.role !== 'super_admin') {
    return (
      <DashboardShell pageTitle="User Management" currentRoute="/users">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '300px', gap: '12px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px' }}>🔒</div>
          <h2 style={{ margin: 0 }}>Access Restricted</h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Only the Editor-in-Chief (super_admin) can manage user accounts.</p>
          <button className="btn-action outline" onClick={() => router.push('/overview')}>
            ← Return to Dashboard
          </button>
        </div>
      </DashboardShell>
    );
  }

  // Update user role — calls the secure server-side API route
  // (never mutates directly via the anon client, which has no server-side authz)
  const handleRoleChange = async (targetUserId: string, newRole: Role) => {
    setUpdatingUserId(targetUserId);
    setError('');
    setSuccess('');
    try {
      // Get the current session token to authenticate the server request
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) throw new Error('Authentication session not found. Please log in again.');

      const response = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update role.');

      setSuccess(`Role updated successfully to "${getRoleConfig(newRole).label}".`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInvitePassword(pass);
  };

  // Directly register a new user in Supabase auth and profiles via server-side API
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setError('');
    setSuccess('');
    setCreatedCredentials(null);

    if (!inviteEmail.trim()) {
      setError('Please provide a valid email address.');
      setInviteLoading(false);
      return;
    }

    if (invitePassword.length < 12) {
      setError('Password must be at least 12 characters long for security.');
      setInviteLoading(false);
      return;
    }

    try {
      // 1. Get the current user's session token for verification
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (!token) {
        throw new Error('Authentication session not found. Please log in again.');
      }

      // 2. Call the server API route to register the new user directly
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          password: invitePassword,
          fullName: inviteFullName,
          role: inviteRole
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to register the new user account.');
      }

      // 3. On success, store the details to display the success card
      setCreatedCredentials({
        email: inviteEmail.trim(),
        password: invitePassword,
        role: inviteRole,
        fullName: inviteFullName.trim()
      });

      setSuccess(`Account for ${inviteEmail} was successfully created and activated!`);
      
      // Clear inputs
      setInviteEmail('');
      setInviteFullName('');
      setInvitePassword('');
      setInviteRole('author');

      // Reload directory list
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to process provisioning request.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Stats by role
  const roleStats = ROLES.map(r => ({
    ...r,
    count: users.filter(u => u.role === r.value).length,
  }));

  return (
    <DashboardShell pageTitle="User Management" currentRoute="/users">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Status Alerts */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '14px 16px', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
            ✅ {success}
          </div>
        )}

        {/* Role Distribution Stats */}
        <div className="metrics-grid">
          {roleStats.map(r => (
            <div
              key={r.value}
              className="metric-card"
              onClick={() => setRoleFilter(roleFilter === r.value ? 'all' : r.value)}
              style={{ cursor: 'pointer', borderTop: roleFilter === r.value ? `3px solid ${r.color}` : '3px solid transparent', transition: 'border-color 0.2s' }}
            >
              <div className="metric-value" style={{ color: r.color }}>{r.count}</div>
              <div className="metric-label">{r.label}s</div>
            </div>
          ))}
        </div>

        <div className="split-grid-users">

          {/* Left: User Directory Table */}
          <div className="admin-card">
            <div className="card-header-block" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <h2 className="card-heading-title">👥 Registered Users ({filteredUsers.length})</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input-control"
                  style={{ maxWidth: '240px' }}
                />
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value as Role | 'all')}
                  className="form-input-control"
                  style={{ maxWidth: '180px' }}
                >
                  <option value="all">All Roles</option>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card-body-content" style={{ padding: 0 }}>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Current Role</th>
                      <th>Member Since</th>
                      <th style={{ width: '200px' }}>Change Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                          Loading user directory...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                          No users found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map(u => {
                        const roleConfig = getRoleConfig(u.role);
                        const isCurrentUser = u.id === user.id;
                        const isUpdating = updatingUserId === u.id;

                        return (
                          <tr key={u.id} style={{ backgroundColor: isCurrentUser ? 'rgba(255, 59, 94, 0.02)' : undefined }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '50%',
                                  backgroundColor: roleConfig.color + '22',
                                  border: `2px solid ${roleConfig.color}44`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 'bold', fontSize: '14px', color: roleConfig.color,
                                  flexShrink: 0
                                }}>
                                  {(u.full_name || u.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-dark)' }}>
                                    {u.full_name || '(No name set)'}
                                    {isCurrentUser && (
                                      <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: '4px' }}>You</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className="status-pill-badge"
                                style={{
                                  backgroundColor: roleConfig.color + '15',
                                  color: roleConfig.color,
                                  border: `1px solid ${roleConfig.color}30`,
                                  fontWeight: 'bold'
                                }}
                              >
                                {roleConfig.label}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td>
                              <select
                                value={u.role}
                                disabled={isUpdating}
                                onChange={e => handleRoleChange(u.id, e.target.value as Role)}
                                className="form-input-control"
                                style={{ fontSize: '12px', padding: '6px 10px', opacity: isUpdating ? 0.6 : 1 }}
                              >
                                {ROLES.map(r => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                              {isUpdating && (
                                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Saving...</div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <Pagination
                currentPage={currentPage}
                totalCount={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                isLoading={dbLoading}
              />
            </div>
          </div>

          {/* Right: Invite + Info Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Invite Panel */}
            <div className="admin-card">
              <div className="card-header-block">
                <h2 className="card-heading-title">👤 Create New User</h2>
              </div>
              <div className="card-body-content">
                {createdCredentials && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(34, 197, 94, 0.04)',
                    border: '1px solid rgba(34, 197, 94, 0.15)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <strong style={{ color: 'var(--success)', fontSize: '13px' }}>📋 Account Credentials Generated</strong>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-dark)' }}>
                      <div><strong>Full Name:</strong> {createdCredentials.fullName || '(No name set)'}</div>
                      <div><strong>Email:</strong> {createdCredentials.email}</div>
                      <div><strong>Password:</strong> <span style={{ fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{createdCredentials.password}</span></div>
                      <div><strong>Assigned Role:</strong> {getRoleConfig(createdCredentials.role).label}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-action outline"
                      onClick={() => {
                        const txt = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
                        navigator.clipboard.writeText(txt);
                        alert('Credentials copied to clipboard!');
                      }}
                      style={{ padding: '8px', fontSize: '11px', alignSelf: 'flex-start', color: 'var(--success)', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                    >
                      📋 Copy Credentials to Clipboard
                    </button>
                  </div>
                )}

                <form onSubmit={handleInviteUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-field-group">
                    <label className="form-label-text">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="e.g. reviewer@lawschool.ac.in"
                      className="form-input-control"
                      required
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">Full Name (Optional)</label>
                    <input
                      type="text"
                      value={inviteFullName}
                      onChange={e => setInviteFullName(e.target.value)}
                      placeholder="e.g. Dr. Priya Sharma"
                      className="form-input-control"
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Initial Password</span>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        🎲 Generate Random
                      </button>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={invitePassword}
                        onChange={e => setInvitePassword(e.target.value)}
                        placeholder="Min 12 characters"
                        className="form-input-control"
                        style={{ paddingRight: '44px' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
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

                  <div className="form-field-group">
                    <label className="form-label-text">Intended Role</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as Role)}
                      className="form-input-control"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn-action primary"
                    style={{ width: '100%' }}
                    disabled={inviteLoading}
                  >
                    {inviteLoading ? 'Creating User...' : '👤 Create Active User Account'}
                  </button>
                </form>
              </div>
            </div>

            {/* Role Legend Card */}
            <div className="admin-card">
              <div className="card-header-block">
                <h2 className="card-heading-title">🔑 Role Permissions Guide</h2>
              </div>
              <div className="card-body-content" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ROLES.map(r => (
                    <div key={r.value} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        backgroundColor: r.color, flexShrink: 0, marginTop: '4px'
                      }} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-dark)' }}>{r.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
                          {r.value === 'super_admin' && 'Full system access. Manage all users, content, and manuscript decisions.'}
                          {r.value === 'editor' && 'Assign reviewers, track manuscripts, publish accepted papers.'}
                          {r.value === 'student_editor' && 'CMS access for volumes, issues, and blog posts. Cannot manage reviews.'}
                          {r.value === 'reviewer' && 'View assigned manuscripts and submit evaluation scorecards.'}
                          {r.value === 'author' && 'Submit manuscripts and view review feedback on their submissions.'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
