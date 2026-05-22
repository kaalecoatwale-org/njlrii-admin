'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { PageLoader } from '@/components/PageLoader';
import { supabase } from '@/lib/supabase';

interface Author {
  name: string;
  designation: string;
  affiliation?: string;
}

interface Issue {
  id: string;
  volume_id: string;
  number: number;
  year: number;
  volumes?: {
    number: number;
    year: string;
  };
}

export default function EditPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const paperId = resolvedParams.id;
  
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Database states
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [issueId, setIssueId] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [authors, setAuthors] = useState<Author[]>([
    { name: '', designation: '', affiliation: '' },
  ]);

  // Cloudinary PDF Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [showManualInputUrl, setShowManualInputUrl] = useState(false);

  // Actions Status
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Handle direct PDF upload to Cloudinary organized by volume and issue
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'pdf') {
        setUploadError('Invalid file type! Only PDF files (.pdf) are permitted.');
        setUploadSuccess(false);
        setUploadedFileName(null);
        setPdfUrl('');
        return;
      }
      
      setUploadError('');
      setIsUploading(true);
      setUploadSuccess(false);
      setUploadedFileName(file.name);
      
      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dcxge1q5q';
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'njlrii_manuscripts';
        
        // Resolve volume & issue path
        const selectedIssue = issues.find(iss => iss.id.toString() === issueId.toString());
        const volNum = selectedIssue && selectedIssue.volumes ? selectedIssue.volumes.number : null;
        const issNum = selectedIssue ? selectedIssue.number : null;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        
        if (volNum && issNum) {
          const cleanSlug = slug.trim() || file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9-_]/g, '_');
          const folderPath = `njlrii/papers/volume_${volNum}/issue_${issNum}`;
          formData.append('public_id', `${folderPath}/${cleanSlug}`);
          formData.append('asset_folder', folderPath);
        } else {
          const cleanName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9-_]/g, '_');
          formData.append('public_id', `njlrii/unsorted/${cleanName}`);
          formData.append('asset_folder', 'njlrii/unsorted');
        }
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to upload manuscript to Cloudinary.');
        }
        
        if (data.secure_url) {
          setPdfUrl(data.secure_url);
          setUploadSuccess(true);
          setUploadError('');
        } else {
          throw new Error('Could not retrieve secure URL from Cloudinary response.');
        }
      } catch (err: any) {
        console.error('Cloudinary upload error:', err);
        setUploadError(err.message || 'An error occurred while uploading. Please try again.');
        setUploadSuccess(false);
        setUploadedFileName(null);
        setPdfUrl('');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Guard routes
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push('/');
    }
  }, [user, profile, loading, router]);

  // Load Issues and existing paper details
  useEffect(() => {
    if (!user || !paperId) return;

    const loadData = async () => {
      setDbLoading(true);
      setError('');
      try {
        // 1. Fetch releases issues
        const { data: issData, error: issError } = await supabase
          .from('issues')
          .select('*, volumes(number, year)')
          .order('id', { ascending: false });

        if (issError) throw issError;
        setIssues((issData as any) || []);

        // 2. Fetch paper details
        const { data: papData, error: papError } = await supabase
          .from('papers')
          .select('*')
          .eq('id', paperId)
          .single();

        if (papError) throw papError;

        if (papData) {
          setTitle(papData.title || '');
          setSlug(papData.slug || '');
          setIssueId(papData.issue_id ? papData.issue_id.toString() : '');
          const existingPdfUrl = papData.pdf_url || '';
          setPdfUrl(existingPdfUrl);
          if (existingPdfUrl) {
            setUploadSuccess(true);
            try {
              const decoded = decodeURIComponent(existingPdfUrl);
              const filename = decoded.split('/').pop()?.split('?')[0] || 'existing_manuscript.pdf';
              setUploadedFileName(filename);
            } catch (e) {
              setUploadedFileName('existing_manuscript.pdf');
            }
          }
          setAbstract(papData.abstract || '');
          setKeywordsInput(papData.keywords ? papData.keywords.join(', ') : '');
          setAuthors(papData.author_metadata || [{ name: '', designation: '', affiliation: '' }]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve paper record.');
      } finally {
        setDbLoading(false);
      }
    };

    loadData();
  }, [user, paperId]);

  if (loading || (user && !profile)) return <PageLoader message="Loading manuscript editor..." />;
  if (!user || !profile) return null;

  // Role permissions
  const isEditorial = ['super_admin', 'editor', 'student_editor'].includes(profile.role);
  if (!isEditorial) return <div style={{ padding: '24px' }}>Access denied.</div>;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Don't auto-update slug on edit unless user explicitly wants to, to preserve existing index routing SEO
  };

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

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);

    const targetIssueId = issueId.trim();
    if (!targetIssueId) {
      setError('Please select a valid release issue.');
      setActionLoading(false);
      return;
    }

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const cleanAuthors = authors.filter((a) => a.name.trim() !== '');
    if (cleanAuthors.length === 0) {
      setError('Please provide at least one author in the registry.');
      setActionLoading(false);
      return;
    }

    if (!pdfUrl || !pdfUrl.trim()) {
      setError('Please provide or upload a valid manuscript document PDF.');
      setActionLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('papers')
        .update({
          issue_id: targetIssueId,
          title,
          abstract,
          keywords,
          pdf_url: pdfUrl,
          slug,
          author_metadata: cleanAuthors,
        })
        .eq('id', paperId);

      if (updateError) throw updateError;

      router.push('/papers');
    } catch (err: any) {
      setError(err.message || 'Failed to update paper record.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardShell pageTitle="Edit Manuscript" currentRoute="/papers">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Alerts */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="admin-card">
          <div className="card-header-block">
            <h2 className="card-heading-title">✏️ Edit Research Manuscript</h2>
          </div>

          <div className="card-body-content">
            {dbLoading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                Retrieving manuscript data from Supabase...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form-grid-layout">
                
                {/* Title */}
                <div className="form-field-group col-span-12">
                  <label className="form-label-text">Manuscript Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. The Specific Relief (Amendment) Act"
                    className="form-input-control"
                    required
                  />
                </div>

                {/* URL Slug */}
                <div className="form-field-group col-span-6">
                  <label className="form-label-text">URL Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="slug-format-url-friendly"
                    className="form-input-control"
                    required
                  />
                </div>

                {/* Release Issue dropdown */}
                <div className="form-field-group col-span-6">
                  <label className="form-label-text">Assign to Issue Release</label>
                  <select
                    value={issueId}
                    onChange={(e) => setIssueId(e.target.value)}
                    className="form-input-control"
                    required
                  >
                    <option value="">Select Release Issue...</option>
                    {issues.map((iss) => (
                      <option key={iss.id} value={iss.id}>
                        Volume {iss.volumes?.number} Issue {iss.number} ({iss.year})
                      </option>
                    ))}
                  </select>
                </div>

                {/* PDF Document Upload / Storage URL */}
                <div className="form-field-group col-span-12">
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                    .animate-spin {
                      animation: spin 1s linear infinite;
                    }
                  `}</style>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label-text">
                      {showManualInputUrl ? 'Document PDF Storage URL' : 'Document PDF Storage File (Cloudinary Secure Vault)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualInputUrl(!showManualInputUrl);
                        setUploadError('');
                      }}
                      style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      {showManualInputUrl ? '⚡ Switch to Drag-and-Drop Uploader' : '🔗 Or paste storage URL manually'}
                    </button>
                  </div>

                  {uploadError && (
                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', fontSize: '12px', fontWeight: '500', marginTop: '4px' }}>
                      ⚠️ {uploadError}
                    </div>
                  )}

                  {showManualInputUrl ? (
                    <input
                      type="url"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      placeholder="e.g. https://res.cloudinary.com/dcxge1q5q/raw/upload/v1/njlrii_manuscripts/paper.pdf"
                      className="form-input-control"
                      required
                    />
                  ) : (
                    <div style={{ marginTop: '4px' }}>
                      {isUploading ? (
                        <div className="drag-upload-container" style={{ cursor: 'wait', borderStyle: 'solid', borderColor: 'var(--primary)', animation: 'badgePulse 2s infinite', padding: '24px' }}>
                          <div className="upload-icon-circle" style={{ color: 'var(--primary)' }}>
                            <span className="animate-spin" style={{ display: 'inline-block', fontSize: '20px' }}>⏳</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                            Saving manuscript securely to Cloudinary vault...
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Please wait while we verify document integrity and establish hosting parameters.
                          </span>
                        </div>
                      ) : uploadSuccess && pdfUrl ? (
                        <div className="drag-upload-container" style={{ borderStyle: 'solid', borderColor: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.02)', padding: '24px' }}>
                          <div className="upload-icon-circle" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>✓</span>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>
                            {uploadedFileName || 'Manuscript PDF'} Uploaded Successfully!
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)', fontWeight: 'bold', textDecoration: 'underline' }}>
                              View Uploaded Document ↗
                            </a>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadSuccess(false);
                                setUploadedFileName(null);
                                setPdfUrl('');
                              }}
                              style={{ color: 'var(--error)', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              Replace File
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label htmlFor="pdf-file-upload" className="drag-upload-container" style={{ padding: '24px' }}>
                          <div className="upload-icon-circle">
                            <span style={{ fontSize: '20px' }}>📁</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                            Drag and drop your manuscript PDF here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>click to browse</span>
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Strict format rule: Only PDF documents (.pdf) are permitted.
                          </span>
                          {(() => {
                            const selected = issues.find(iss => iss.id.toString() === issueId.toString());
                            const path = selected && selected.volumes
                              ? `njlrii/papers/volume_${selected.volumes.number}/issue_${selected.number}`
                              : null;
                            return (
                              <div style={{ marginTop: '8px', padding: '4px 10px', backgroundColor: path ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)', color: path ? 'var(--success)' : 'var(--warning)', borderRadius: '4px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {path ? (
                                  <>📂 Cloudinary Destination: <code style={{ fontFamily: 'monospace', marginLeft: '2px' }}>{path}</code></>
                                ) : (
                                  <>💡 Tip: Assign an Issue Release above first to organize this PDF in its volume folder.</>
                                )}
                              </div>
                            );
                          })()}
                          <input
                            type="file"
                            id="pdf-file-upload"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>


                {/* Authors Registry */}
                <div className="form-field-group col-span-12" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <label className="form-label-text">Academic Author Registry</label>
                    <button type="button" onClick={addAuthorField} className="btn-action outline" style={{ padding: '6px 12px', cursor: 'pointer' }}>
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
                          position: 'relative',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div className="form-field-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label className="form-label-text" style={{ fontSize: '10px' }}>Full Name</label>
                          <input
                            type="text"
                            value={author.name}
                            onChange={(e) => updateAuthorField(index, 'name', e.target.value)}
                            placeholder="e.g. Dr. Aarav Patel"
                            className="form-input-control"
                            required
                          />
                        </div>

                        <div className="form-field-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label className="form-label-text" style={{ fontSize: '10px' }}>Designation / Job Title</label>
                          <input
                            type="text"
                            value={author.designation}
                            onChange={(e) => updateAuthorField(index, 'designation', e.target.value)}
                            placeholder="e.g. Associate Professor of Law"
                            className="form-input-control"
                            required
                          />
                        </div>

                        <div className="form-field-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label className="form-label-text" style={{ fontSize: '10px' }}>Institutional Affiliation</label>
                          <input
                            type="text"
                            value={author.affiliation || ''}
                            onChange={(e) => updateAuthorField(index, 'affiliation', e.target.value)}
                            placeholder="e.g. National Law University, Delhi"
                            className="form-input-control"
                          />
                        </div>

                        {authors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAuthorField(index)}
                            className="btn-action danger"
                            style={{ padding: '12px 14px', cursor: 'pointer' }}
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
                    placeholder="Provide the complete academic abstract summary here..."
                    className="form-input-control"
                    style={{ minHeight: '160px', resize: 'vertical' }}
                    required
                  />
                </div>

                {/* Keywords input */}
                <div className="form-field-group col-span-12">
                  <label className="form-label-text">Keywords (Comma separated)</label>
                  <input
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="e.g. Constitutional Law, Specific Relief, Citation, Bluebook"
                    className="form-input-control"
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Separate keywords with commas. These help index academic search queries.
                  </span>
                </div>

                {/* Form CTAs */}
                <div className="form-field-group col-span-12" style={{ display: 'flex', justifyContent: 'flex-end', flexDirection: 'row', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                  <button type="button" className="btn-action outline" onClick={() => router.push('/papers')} style={{ cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-action primary" disabled={actionLoading || isUploading} style={{ cursor: 'pointer' }}>
                    {actionLoading ? 'Updating Record...' : isUploading ? 'Uploading PDF...' : '💾 Save Publication Record'}
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
