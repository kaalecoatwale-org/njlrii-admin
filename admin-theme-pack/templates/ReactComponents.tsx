'use client';

import React, { useState } from 'react';

/** ==========================================================================
 *  NJLRII SUBDOMAIN ADMIN PANEL - COMPONENT TEMPLATES
 *  ISSN: 2582-8665 | Double-Blind Peer-Reviewed Academic Identity
 *  ========================================================================== */

/**
 * Interface Mappings
 */
export interface Author {
  name: string;
  designation: string;
  affiliation?: string;
}

export interface Volume {
  id: number;
  number: number;
  year: number;
}

export interface Issue {
  id: number;
  volume_id: number;
  number: number;
  year: number;
  title?: string;
}

export interface Paper {
  id: number;
  issue_id: number;
  title: string;
  abstract: string;
  keywords: string[];
  pdf_url: string;
  doi?: string;
  slug: string;
  author_metadata: Author[];
  cover_image?: string;
  published_at?: string;
  created_at: string;
}

export interface Post {
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
  published_at: string;
}


/** ==========================================================================
 *  1. TEMPLATE: PREMIUM DASHBOARD SHELL LAYOUT
 *  ========================================================================== */
export function DashboardShell({
  children,
  pageTitle = 'Dashboard',
  currentRoute = '/papers'
}: {
  children: React.ReactNode;
  pageTitle?: string;
  currentRoute?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { label: 'Overview', route: '/overview', icon: '📈' },
    { label: 'Volumes', route: '/volumes', icon: '📚' },
    { label: 'Issues & Releases', route: '/issues', icon: '🔖' },
    { label: 'Research Papers', route: '/papers', icon: '📝' },
    { label: 'News & Announcements', route: '/blog', icon: '📰' },
    { label: 'System Settings', route: '/settings', icon: '⚙️' },
  ];

  return (
    <div className="admin-layout-wrapper">
      {/* Sidebar - Classic Deep Slate Drawer */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-branding">
          <div className="sidebar-logo">
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
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>NJLRII SUBDOMAIN ADMIN</div>
          <div style={{ opacity: 0.5 }}>Logged in as Editor</div>
          <div style={{ marginTop: '8px', color: '#ff3b5e' }}>
            <a href="/logout">Sign Out →</a>
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
              style={{ display: 'none', fontSize: '20px', padding: '8px' }}
              className="mobile-toggle-btn"
            >
              ☰
            </button>
            <h1 className="navbar-page-title">{pageTitle}</h1>
          </div>

          <div className="navbar-user-actions">
            <a href="https://www.njlrii.com" target="_blank" rel="noopener noreferrer" className="btn-action outline">
              👁️ View Live Website
            </a>

            <div className="navbar-profile-badge">
              <div className="profile-avatar">E</div>
              <div className="profile-details">
                <span className="profile-name">Editorial Board</span>
                <span className="profile-role">Admin Administrator</span>
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


/** ==========================================================================
 *  2. TEMPLATE: SLEEK DATA TABLE FOR PAPERS LISTING
 *  ========================================================================== */
export function PapersDataTable({
  papers = [],
  volumes = [],
  onEdit,
  onDelete
}: {
  papers: Paper[];
  volumes: Volume[];
  onEdit: (paper: Paper) => void;
  onDelete: (id: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedVolume, setSelectedVolume] = useState('');

  // Filter Logic
  const filteredPapers = papers.filter((paper) => {
    const matchesSearch = paper.title.toLowerCase().includes(search.toLowerCase()) ||
      paper.author_metadata.some(a => a.name.toLowerCase().includes(search.toLowerCase()));

    // Customize volume matching logic based on your custom state needs
    return matchesSearch;
  });

  return (
    <div className="admin-card">
      {/* Card Header & Query Controls */}
      <div className="card-header-block" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <h2 className="card-heading-title">Published Research Index</h2>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search title, keywords, authors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input-control"
            style={{ width: '260px' }}
          />

          <select
            value={selectedVolume}
            onChange={(e) => setSelectedVolume(e.target.value)}
            className="form-input-control"
            style={{ width: '160px' }}
          >
            <option value="">All Volumes</option>
            {volumes.map(vol => (
              <option key={vol.id} value={vol.id}>Volume {vol.number} ({vol.year})</option>
            ))}
          </select>

          <a href="/papers/new" className="btn-action primary">
            ➕ Publish New Manuscript
          </a>
        </div>
      </div>

      {/* Table Container */}
      <div className="card-body-content" style={{ padding: 0 }}>
        <div className="table-responsive-wrapper">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Manuscript Details</th>
                <th>Authors</th>
                <th>Releases</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPapers.length > 0 ? (
                filteredPapers.map((paper) => (
                  <tr key={paper.id}>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>#{paper.id}</td>
                    <td>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
                        {paper.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="status-pill-badge success">
                          <span className="status-pulse-dot" />
                          Open Access
                        </span>
                        {paper.doi && (
                          <span style={{ fontFamily: 'JetBrains Mono' }}>DOI: {paper.doi}</span>
                        )}
                        <span>Slug: /{paper.slug}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {paper.author_metadata.map((author, index) => (
                          <div key={index} style={{ fontSize: '12px' }}>
                            <strong>{author.name}</strong>
                            <span style={{ color: '#64748b', fontSize: '11px' }}> ({author.affiliation || 'Independent'})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="status-pill-badge info">
                        Vol {paper.issue_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => onEdit(paper)}
                          className="action-icon-button edit"
                          title="Edit manuscript details"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDelete(paper.id)}
                          className="action-icon-button delete"
                          title="Delete manuscript record"
                        >
                          🗑️
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
      </div>
    </div>
  );
}


/** ==========================================================================
 *  3. TEMPLATE: MULTI-AUTHOR SUBMISSION FORM
 *  ========================================================================== */
export function SubmissionForm({
  volumes = [],
  issues = [],
  initialData = null,
  onSave
}: {
  volumes: Volume[];
  issues: Issue[];
  initialData?: Paper | null;
  onSave: (data: Partial<Paper>) => void;
}) {
  // Core Fields State
  const [title, setTitle] = useState(initialData?.title || '');
  const [abstract, setAbstract] = useState(initialData?.abstract || '');
  const [keywordsInput, setKeywordsInput] = useState(initialData?.keywords.join(', ') || '');
  const [pdfUrl, setPdfUrl] = useState(initialData?.pdf_url || '');
  const [doi, setDoi] = useState(initialData?.doi || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [issueId, setIssueId] = useState(initialData?.issue_id || '');

  // JSONB Authors state
  const [authors, setAuthors] = useState<Author[]>(
    initialData?.author_metadata || [{ name: '', designation: '', affiliation: '' }]
  );

  // Auto Generate Slug from Title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialData) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // remove special chars
        .replace(/\s+/g, '-')          // replace spaces with hyphens
        .replace(/-+/g, '-');         // remove duplicates
      setSlug(generatedSlug);
    }
  };

  // Add/Remove Dynamic Author Inputs
  const addAuthorField = () => {
    setAuthors([...authors, { name: '', designation: '', affiliation: '' }]);
  };

  const removeAuthorField = (idx: number) => {
    if (authors.length === 1) return;
    setAuthors(authors.filter((_, i) => i !== idx));
  };

  const updateAuthorField = (idx: number, field: keyof Author, value: string) => {
    const updated = [...authors];
    updated[idx] = { ...updated[idx], [field]: value };
    setAuthors(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse keywords into array
    const keywords = keywordsInput
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    onSave({
      title,
      abstract,
      keywords,
      pdf_url: pdfUrl,
      doi: doi || undefined,
      slug,
      issue_id: Number(issueId),
      author_metadata: authors.filter(a => a.name.trim() !== '')
    });
  };

  return (
    <div className="admin-card">
      <div className="card-header-block">
        <h2 className="card-heading-title">
          {initialData ? '✏️ Edit Research Manuscript' : '📝 Publish Research Manuscript'}
        </h2>
      </div>

      <div className="card-body-content">
        <form onSubmit={handleSubmit} className="form-grid-layout">

          {/* Main Title */}
          <div className="form-field-group col-span-12">
            <label className="form-label-text">Manuscript Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. The Specific Relief (Amendment) Act, 2018: A Critical Appraisal"
              className="form-input-control"
              required
            />
          </div>

          {/* URL Slug & DOI */}
          <div className="form-field-group col-span-6">
            <label className="form-label-text">URL Slug (Auto-generated)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug-format-url-friendly"
              className="form-input-control"
              required
            />
          </div>

          <div className="form-field-group col-span-6">
            <label className="form-label-text">Digital Object Identifier (DOI) - Optional</label>
            <input
              type="text"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="e.g. 10.1000/xyz123"
              className="form-input-control"
            />
          </div>

          {/* Volume / Issue Dropdowns */}
          <div className="form-field-group col-span-6">
            <label className="form-label-text">Assign to Issue</label>
            <select
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              className="form-input-control"
              required
            >
              <option value="">Select Release Issue...</option>
              {issues.map(iss => (
                <option key={iss.id} value={iss.id}>
                  Volume {iss.volume_id} Issue {iss.number} ({iss.year})
                </option>
              ))}
            </select>
          </div>

          {/* PDF Storage link */}
          <div className="form-field-group col-span-6">
            <label className="form-label-text">Supabase PDF Storage Document URL</label>
            <input
              type="url"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="e.g. https://xxxx.supabase.co/storage/v1/object/public/papers/vol-1/paper.pdf"
              className="form-input-control"
              required
            />
          </div>

          {/* Dynamic JSONB Authors Listing */}
          <div className="form-field-group col-span-12" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label className="form-label-text">Academic Author Registry</label>
              <button type="button" onClick={addAuthorField} className="btn-action outline" style={{ padding: '6px 12px' }}>
                ➕ Add Author
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authors.map((author, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-end',
                    padding: '16px',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '8px',
                    position: 'relative'
                  }}
                >
                  <div className="form-field-group" style={{ flex: 1 }}>
                    <label className="form-label-text" style={{ fontSize: '10px' }}>Full Name</label>
                    <input
                      type="text"
                      value={author.name}
                      onChange={(e) => updateAuthorField(index, 'name', e.target.value)}
                      placeholder="Dr. Shashi Tharoor"
                      className="form-input-control"
                      required
                    />
                  </div>

                  <div className="form-field-group" style={{ flex: 1 }}>
                    <label className="form-label-text" style={{ fontSize: '10px' }}>Designation / Job Title</label>
                    <input
                      type="text"
                      value={author.designation}
                      onChange={(e) => updateAuthorField(index, 'designation', e.target.value)}
                      placeholder="e.g. Senior Lecturer"
                      className="form-input-control"
                      required
                    />
                  </div>

                  <div className="form-field-group" style={{ flex: 1 }}>
                    <label className="form-label-text" style={{ fontSize: '10px' }}>Institutional Affiliation</label>
                    <input
                      type="text"
                      value={author.affiliation || ''}
                      onChange={(e) => updateAuthorField(index, 'affiliation', e.target.value)}
                      placeholder="e.g. Faculty of Law, DU"
                      className="form-input-control"
                    />
                  </div>

                  {authors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAuthorField(index)}
                      className="btn-action danger"
                      style={{ padding: '12px 14px' }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Abstract Textarea */}
          <div className="form-field-group col-span-12" style={{ marginTop: '16px' }}>
            <label className="form-label-text">Manuscript Abstract Summary</label>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Provide the complete scholarly abstract here..."
              className="form-input-control"
              style={{ minHeight: '160px', resize: 'vertical' }}
              required
            />
          </div>

          {/* Keywords */}
          <div className="form-field-group col-span-12">
            <label className="form-label-text">Keywords (Comma separated)</label>
            <input
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="e.g. Constitutional Law, Specific Relief, High Court, Bluebook"
              className="form-input-control"
              required
            />
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Separate keywords with commas. These help index search queries.
            </span>
          </div>

          {/* Submission CTAs */}
          <div className="form-field-group col-span-12" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            <a href="/papers" className="btn-action outline">
              Cancel
            </a>
            <button type="submit" className="btn-action primary">
              💾 Save Publication Record
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}


/** ==========================================================================
 *  4. TEMPLATE: MINIMALIST BRANDED LOGIN PANEL
 *  ========================================================================== */
export function LoginScreen({
  onLogin
}: {
  onLogin: (email: string, pass: string) => Promise<boolean>
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('Invalid username or unauthorized editorial credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failure. Database offline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface)',
        padding: '24px'
      }}
    >
      <div
        className="admin-card fade-in-up"
        style={{
          maxWidth: '420px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          borderTop: '5px solid var(--primary)'
        }}
      >
        <div className="card-body-content" style={{ padding: '40px' }}>

          {/* Logo Center */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.02em' }}>
              NJLRII<span style={{ color: 'var(--primary)' }}>.</span>
            </h1>
            <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'var(--muted)', letterSpacing: '0.12em', marginTop: '6px' }}>
              ISSN 2582-8665 | ADMIN BOARD
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                color: 'var(--error)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '20px'
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div className="form-field-group">
              <label className="form-label-text">Editorial Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@njlrii.com"
                className="form-input-control"
                required
              />
            </div>

            <div className="form-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label-text">Security Keycode</label>
                <a href="mailto:info@njlrii.com" style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>
                  Forgot Key?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input-control"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-action primary"
              style={{ width: '100%', padding: '14px', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Authenticating Credentials...' : '🔐 Sign In to Console'}
            </button>

          </form>

        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            padding: '16px 40px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--muted)',
            borderTop: '1px solid var(--border)'
          }}
        >
          Protected Double-Blind Peer-Review Portal.
        </div>
      </div>
    </div>
  );
}
