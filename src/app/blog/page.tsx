'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabase';

interface Paper {
  id: number;
  title: string;
}

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  type: 'News' | 'Announcement' | 'Call for Papers';
  cover_image?: string;
  related_paper_id?: number;
  seo_metadata: {
    metaTitle: string;
    metaDescription: string;
  };
  published_at?: string;
  created_at: string;
}

export default function BlogPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // State Management
  const [posts, setPosts] = useState<Post[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [type, setType] = useState<'News' | 'Announcement' | 'Call for Papers'>('News');
  const [editorContent, setEditorContent] = useState('');
  const [relatedPaperId, setRelatedPaperId] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Ref for the contentEditable element
  const editorRef = useRef<HTMLDivElement>(null);

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Load posts and papers
  const loadData = async () => {
    setDbLoading(true);
    try {
      // 1. Fetch papers for dropdown
      const { data: papData, error: papError } = await supabase
        .from('papers')
        .select('id, title')
        .order('id', { ascending: false });

      if (papError) throw papError;
      setPapers(papData || []);

      // 2. Fetch posts with pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: pstData, count, error: pstError } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, to);

      if (pstError) throw pstError;
      setPosts(pstData || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to sync articles library.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentPage]);

  // Sync editorState to contentEditable element
  useEffect(() => {
    if (editorRef.current && editingId === null && editorContent === '') {
      editorRef.current.innerHTML = '';
    }
  }, [editorContent, editingId]);

  if (loading || (user && !profile)) return <PageLoader message="Loading news & announcements..." />;
  if (!user || !profile) return null;

  // Role permissions
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) return <div style={{ padding: '24px' }}>Access denied.</div>;

  // Slug generator
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingId) {
      const generatedSlug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setSlug(generatedSlug);
    }
  };

  // WYSIWYG Format Actions
  const handleFormat = (command: string, value: string = '') => {
    if (typeof window === 'undefined') return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML);
    }
  };

  const handleLink = () => {
    const url = window.prompt('Enter link URL:');
    if (url) {
      handleFormat('createLink', url);
    }
  };

  // Form Submit Handler (Save or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    const relatedPaperVal = relatedPaperId ? parseInt(relatedPaperId) : null;
    const finalContent = editorRef.current ? editorRef.current.innerHTML : editorContent;

    if (!finalContent || finalContent === '<br>' || finalContent.trim() === '') {
      setError('Article content cannot be empty. Write something in the editor.');
      setActionLoading(false);
      return;
    }

    try {
      const postPayload = {
        title,
        slug,
        excerpt,
        content: finalContent,
        type,
        related_paper_id: relatedPaperVal,
        author: profile.full_name || 'NJLRII Editor',
        seo_metadata: {
          metaTitle: seoTitle || title,
          metaDescription: seoDesc || excerpt,
        },
        published_at: new Date().toISOString(),
      };

      if (editingId) {
        // Edit Operation
        const { error: editError } = await supabase
          .from('posts')
          .update(postPayload)
          .eq('id', editingId);

        if (editError) throw editError;
        setSuccess(`Successfully updated post: "${title}".`);
        setEditingId(null);
      } else {
        // Create Operation
        const { error: createError } = await supabase
          .from('posts')
          .insert(postPayload);

        if (createError) throw createError;
        setSuccess(`Successfully published post: "${title}".`);
      }

      // Reset fields
      setTitle('');
      setSlug('');
      setExcerpt('');
      setEditorContent('');
      setRelatedPaperId('');
      setSeoTitle('');
      setSeoDesc('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Action
  const handleDelete = async (id: number, t: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete this post: "${t}"?`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      const { error: delError } = await supabase.from('posts').delete().eq('id', id);
      if (delError) throw delError;
      setSuccess(`Successfully deleted post.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete post.');
    }
  };

  // Edit Trigger
  const startEdit = (post: Post) => {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setType(post.type);
    setRelatedPaperId(post.related_paper_id ? post.related_paper_id.toString() : '');
    setSeoTitle(post.seo_metadata?.metaTitle || '');
    setSeoDesc(post.seo_metadata?.metaDescription || '');
    setEditorContent(post.content);
    
    // Set Editor innerHTML
    if (editorRef.current) {
      editorRef.current.innerHTML = post.content;
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setExcerpt('');
    setEditorContent('');
    setRelatedPaperId('');
    setSeoTitle('');
    setSeoDesc('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const getTypeBadgeClass = (t: string) => {
    switch (t) {
      case 'Call for Papers': return 'status-pill-badge error';
      case 'News': return 'status-pill-badge success';
      default: return 'status-pill-badge info';
    }
  };

  return (
    <DashboardShell pageTitle="News & Announcements" currentRoute="/blog">
      <div className="form-grid-layout" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
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

        <div className="split-grid-wysiwyg">
          
          {/* Left Column: Rich Text Form Panel */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">{editingId ? '✏️ Edit Article' : '➕ Write Post / Announcement'}</h2>
            </div>
            <div className="card-body-content">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div className="form-field-group">
                  <label className="form-label-text">Article Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Call for Papers - Vol. 5 Issue 2"
                    className="form-input-control"
                    required
                  />
                </div>

                <div className="form-grid-layout" style={{ gap: '16px' }}>
                  <div className="col-span-6 form-field-group">
                    <label className="form-label-text">Slug (URL friendly)</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="url-format-friendly"
                      className="form-input-control"
                      required
                    />
                  </div>

                  <div className="col-span-6 form-field-group">
                    <label className="form-label-text">Announcements Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="form-input-control"
                      required
                    >
                      <option value="News">News Feed</option>
                      <option value="Announcement">Board Announcement</option>
                      <option value="Call for Papers">Call for Papers</option>
                    </select>
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Excerpt (Quick Feed Summary)</label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Short description displayed on search results feed..."
                    className="form-input-control"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    required
                  />
                </div>

                {/* Rich Text Editor Block */}
                <div className="form-field-group">
                  <label className="form-label-text">Article Content (Rich-Text Editor)</label>
                  
                  {/* WYSIWYG Toolbar */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      gap: '4px', 
                      padding: '8px', 
                      backgroundColor: 'var(--surface)', 
                      border: '1.5px solid var(--border)', 
                      borderBottom: 'none',
                      borderRadius: '8px 8px 0 0',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button type="button" onClick={() => handleFormat('bold')} style={{ padding: '4px 8px', fontWeight: 'bold', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Bold">B</button>
                    <button type="button" onClick={() => handleFormat('italic')} style={{ padding: '4px 8px', fontStyle: 'italic', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Italic">I</button>
                    <button type="button" onClick={() => handleFormat('underline')} style={{ padding: '4px 8px', textDecoration: 'underline', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Underline">U</button>
                    <span style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
                    <button type="button" onClick={() => handleFormat('formatBlock', '<h3>')} style={{ padding: '4px 8px', fontWeight: 'bold', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Subheading H3">H3</button>
                    <button type="button" onClick={() => handleFormat('formatBlock', '<p>')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Paragraph Text">P</button>
                    <span style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
                    <button type="button" onClick={() => handleFormat('insertUnorderedList')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Bullet List">• List</button>
                    <button type="button" onClick={() => handleFormat('insertOrderedList')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Numbered List">1. List</button>
                    <span style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
                    <button type="button" onClick={handleLink} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Add Anchor Link">🔗 Link</button>
                    <button type="button" onClick={() => handleFormat('unlink')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }} title="Remove Link">unlink</button>
                  </div>

                  {/* ContentEditable Viewport */}
                  <div
                    ref={editorRef}
                    contentEditable={true}
                    onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                    style={{
                      minHeight: '220px',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid var(--border)',
                      borderRadius: '0 0 8px 8px',
                      padding: '16px',
                      outline: 'none',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      overflowY: 'auto'
                    }}
                    className="form-input-control"
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-label-text">Link Related Research Paper (Optional)</label>
                  <select
                    value={relatedPaperId}
                    onChange={(e) => setRelatedPaperId(e.target.value)}
                    className="form-input-control"
                  >
                    <option value="">Choose article reference...</option>
                    {papers.map(pap => (
                      <option key={pap.id} value={pap.id}>#{pap.id} - {pap.title}</option>
                    ))}
                  </select>
                </div>

                {/* SEO Metadata Card Row */}
                <div style={{ padding: '16px', border: '1.5px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <label className="form-label-text" style={{ color: 'var(--muted)' }}>🔍 Search Engine SEO Metadata (JSONB)</label>
                  
                  <div className="form-field-group">
                    <label className="form-label-text" style={{ fontSize: '9px' }}>Meta Title</label>
                    <input
                      type="text"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder="Default matches article title..."
                      className="form-input-control"
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text" style={{ fontSize: '9px' }}>Meta Description</label>
                    <input
                      type="text"
                      value={seoDesc}
                      onChange={(e) => setSeoDesc(e.target.value)}
                      placeholder="Default matches quick excerpt..."
                      className="form-input-control"
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {editingId && (
                    <button type="button" className="btn-action outline" style={{ flex: 1 }} onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-action primary" style={{ flex: 2 }} disabled={actionLoading}>
                    {actionLoading ? 'Publishing...' : editingId ? 'Update Post' : 'Publish Article'}
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Right Column: Listing Feeds */}
          <div className="admin-card">
            <div className="card-header-block">
              <h2 className="card-heading-title">Announcements Index</h2>
            </div>
            <div className="card-body-content" style={{ padding: 0 }}>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Article Details</th>
                      <th>Type</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                          Retrieving board logs from database...
                        </td>
                      </tr>
                    ) : posts.length > 0 ? (
                      posts.map((post) => (
                        <tr key={post.id}>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>#{post.id}</td>
                          <td>
                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{post.title}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '8px' }}>
                              <span>By: {post.author}</span>
                              <span>Slug: /{post.slug}</span>
                            </div>
                          </td>
                          <td>
                            <span className={getTypeBadgeClass(post.type)}>
                              {post.type}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => startEdit(post)} className="action-icon-button edit" title="Edit post">
                                ✏️
                              </button>
                              <button onClick={() => handleDelete(post.id, post.title)} className="action-icon-button delete" title="Delete post">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                          No published notices or calls for papers. Use the left panel to write your first entry.
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
    </DashboardShell>
  );
}
