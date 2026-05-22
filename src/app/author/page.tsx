'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface CoAuthor {
  name: string;
  affiliation: string;
}

export default function SubmitPaperPage() {
  // Navigation / Tabs state: 'guidelines' or 'submit'
  const [activeTab, setActiveTab] = useState<'guidelines' | 'submit'>('guidelines');

  // Form states
  const [authorCount, setAuthorCount] = useState<number>(1);
  const [primaryName, setPrimaryName] = useState('');
  const [primaryAffiliation, setPrimaryAffiliation] = useState('');
  const [primaryCourse, setPrimaryCourse] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([
    { name: '', affiliation: '' },
    { name: '', affiliation: '' },
    { name: '', affiliation: '' },
    { name: '', affiliation: '' },
    { name: '', affiliation: '' },
  ]);

  const [submissionType, setSubmissionType] = useState('Research Paper');
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [abstract, setAbstract] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  
  // File upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'link' | 'upload'>('upload');
  const [isFileUploading, setIsFileUploading] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedTrackingId, setGeneratedTrackingId] = useState('');

  // Handle co-author fields updating dynamically
  const handleCoAuthorChange = (index: number, field: keyof CoAuthor, value: string) => {
    const updated = [...coAuthors];
    const existing = updated[index] || { name: '', affiliation: '' };
    updated[index] = {
      name: field === 'name' ? value : (existing.name || ''),
      affiliation: field === 'affiliation' ? value : (existing.affiliation || '')
    };
    setCoAuthors(updated);
  };

  // Handle local file upload styling/validation
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'doc' && extension !== 'docx') {
        setError('Invalid file type! Kindly upload .doc or .docx files only.');
        setUploadedFileName(null);
        setFileUrl('');
        return;
      }
      setError('');
      setUploadedFileName(file.name);
      setIsFileUploading(true);

      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dcxge1q5q';
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'njlrii_manuscripts';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to upload manuscript to Cloudinary.');
        }

        if (data.secure_url) {
          setFileUrl(data.secure_url);
          setError('');
        } else {
          throw new Error('Could not retrieve secure URL from Cloudinary response.');
        }
      } catch (err: any) {
        console.error('Cloudinary upload error:', err);
        setError(err.message || 'An error occurred while uploading the manuscript. Please try again.');
        setUploadedFileName(null);
        setFileUrl('');
      } finally {
        setIsFileUploading(false);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate fields
    if (!primaryName.trim()) { setError('First Author Name is required.'); setLoading(false); return; }
    if (!primaryEmail.trim() || !primaryEmail.includes('@')) { setError('A valid First Author Email is required.'); setLoading(false); return; }
    if (!primaryPhone.trim()) { setError('First Author Phone is required.'); setLoading(false); return; }
    if (!primaryAffiliation.trim()) { setError('First Author Affiliation is required.'); setLoading(false); return; }
    if (!primaryCourse.trim()) { setError('First Author Course Details are required.'); setLoading(false); return; }
    if (!title.trim()) { setError('Manuscript Title is required.'); setLoading(false); return; }
    if (!abstract.trim()) { setError('Manuscript Abstract is required.'); setLoading(false); return; }
    if (!fileUrl.trim()) { setError('Please upload your manuscript file or provide a shareable document link.'); setLoading(false); return; }

    // Slice co-authors array to match selected count
    const activeCoAuthors = coAuthors.slice(0, authorCount - 1).filter(co => co.name.trim() !== '');

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author_name: primaryName,
          author_email: primaryEmail,
          author_phone: primaryPhone,
          author_affiliation: `${primaryAffiliation} (${primaryCourse})`,
          co_authors: activeCoAuthors,
          title,
          abstract,
          keywords,
          manuscript_pdf_url: fileUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit paper.');
      }

      setGeneratedTrackingId(result.tracking_id);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Submission failed. Please check your network or try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPrimaryName('');
    setPrimaryAffiliation('');
    setPrimaryCourse('');
    setPrimaryEmail('');
    setPrimaryPhone('');
    setCoAuthors([
      { name: '', affiliation: '' },
      { name: '', affiliation: '' },
      { name: '', affiliation: '' },
      { name: '', affiliation: '' },
      { name: '', affiliation: '' },
    ]);
    setTitle('');
    setAbstract('');
    setKeywords('');
    setFileUrl('');
    setUploadedFileName(null);
    setSuccess(false);
    setError('');
  };

  return (
    <div style={{ backgroundColor: '#fcfdfd', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* 1. Header Navigation Bar */}
      <header className="no-print" style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
        zIndex: 1000,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '76px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo Branding */}
          <Link href="/author" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              letterSpacing: '0.02em',
              color: 'var(--foreground)'
            }}>
              NJLRII<span style={{ color: 'var(--primary)' }}>.</span>
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--primary)',
              marginTop: '1px'
            }}>
              ISSN: 2582-8665 (ONLINE)
            </span>
          </Link>

          {/* Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a href="/" className="nav-menu-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)' }}>Home</a>
            <a href="#" className="nav-menu-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--muted)' }}>About ▾</a>
            <a href="#" className="nav-menu-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--muted)' }}>Information ▾</a>
            <a href="#" className="nav-menu-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--muted)' }}>Indexing</a>
            <a href="#" className="nav-menu-link" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--muted)' }}>Issues ▾</a>
            
            <button 
              onClick={() => setActiveTab('submit')}
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'white',
                backgroundColor: 'var(--primary)',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '30px',
                boxShadow: '0 4px 10px rgba(252, 4, 52, 0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                cursor: 'pointer'
              }}
            >
              Submit Paper Online
            </button>

            <Link href="/track" style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'white',
              backgroundColor: '#0f172a',
              padding: '10px 18px',
              borderRadius: '30px',
              boxShadow: 'var(--shadow-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}>
              Track Paper
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Main Portal Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'start' }}>
          
          {/* A. LEFT COLUMN - Dynamic Submission Form & Guidelines */}
          <div>
            {/* Header Title Section */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(252, 4, 52, 0.08)',
                  color: 'var(--primary)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Public Submissions Portal
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--success)', borderRadius: '50%' }}></span>
                  Volume VI Issue III (Rolling Active)
                </span>
              </div>
              <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', marginBottom: '24px' }}>
                {activeTab === 'guidelines' ? 'Call for Papers & Guidelines' : 'Submit Manuscript Online'}
              </h1>

              {/* Dynamic Sub-Tab Selector Toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.04)',
                padding: '6px',
                borderRadius: '30px',
                maxWidth: '440px',
                border: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('guidelines')}
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '10px 16px',
                    borderRadius: '24px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'guidelines' ? 'white' : 'transparent',
                    color: activeTab === 'guidelines' ? 'var(--primary)' : 'var(--muted)',
                    boxShadow: activeTab === 'guidelines' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  📑 Instructions & Tracks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('submit')}
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '10px 16px',
                    borderRadius: '24px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'submit' ? 'white' : 'transparent',
                    color: activeTab === 'submit' ? 'var(--primary)' : 'var(--muted)',
                    boxShadow: activeTab === 'submit' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  ✍️ Submit Manuscript
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: SUBMISSION GUIDELINES SECTION */}
            {/* ======================================================== */}
            {activeTab === 'guidelines' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                
                {/* Visual Stats bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                  backgroundColor: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ borderRight: '1px solid var(--border)', paddingRight: '8px' }}>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Official Registry</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginTop: '4px' }}>ISSN 2582-8665</strong>
                  </div>
                  <div style={{ borderRight: '1px solid var(--border)', paddingRight: '8px', paddingLeft: '8px' }}>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peer-Review Model</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginTop: '4px' }}>Double-Blind</strong>
                  </div>
                  <div style={{ borderRight: '1px solid var(--border)', paddingRight: '8px', paddingLeft: '8px' }}>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Publication Cycle</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginTop: '4px' }}>Quarterly</strong>
                  </div>
                  <div style={{ paddingLeft: '8px' }}>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Review Status</span>
                    <strong style={{ fontSize: '16px', color: 'var(--success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--success)', borderRadius: '50%' }}></span> Active Rolling
                    </strong>
                  </div>
                </div>

                {/* Section Title */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manuscript Tracks</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px' }}>Tracks & Word limits</h2>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
                    NJLRII invites legal manuscripts across five dedicated publication tracks. All submissions must follow strict word counts:
                  </p>
                </div>

                {/* Categories Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* Research Papers */}
                  <div className="admin-card" style={{ margin: 0, borderTop: '4px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px' }}>📖</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(252,4,52,0.06)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '12px' }}>
                          3,500 – 10,000 Words
                        </span>
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '8px' }}>Research Papers</h4>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        In-depth academic contributions demonstrating rigorous methodology, literature analysis, and original conclusions. A mandatory abstract (max 300 words) with at least 3 keywords is required.
                      </p>
                    </div>
                  </div>

                  {/* Long Articles */}
                  <div className="admin-card" style={{ margin: 0, borderTop: '4px solid #0f172a', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px' }}>📕</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(15,23,42,0.06)', color: '#0f172a', padding: '3px 8px', borderRadius: '12px' }}>
                          2,500 – 4,000 Words
                        </span>
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '8px' }}>Long Articles</h4>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        Systematic explorations of legal doctrines, jurisprudence evolution, or deep structural reform recommendations with substantial footnote citations.
                      </p>
                    </div>
                  </div>

                  {/* Short Articles */}
                  <div className="admin-card" style={{ margin: 0, borderTop: '4px solid #0f172a', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px' }}>📄</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(15,23,42,0.06)', color: '#0f172a', padding: '3px 8px', borderRadius: '12px' }}>
                          1,500 – 2,500 Words
                        </span>
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '8px' }}>Short Articles</h4>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        Concise analyses of contemporary legal issues, recent bills, or emerging regulatory frameworks. Must be completed with comprehensive scholarly footnotes.
                      </p>
                    </div>
                  </div>

                  {/* Case Comments */}
                  <div className="admin-card" style={{ margin: 0, borderTop: '4px solid #0f172a', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px' }}>⚖️</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(15,23,42,0.06)', color: '#0f172a', padding: '3px 8px', borderRadius: '12px' }}>
                          1,800 – 3,000 Words
                        </span>
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '8px' }}>Case Comments</h4>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        Critical analytical reviews of recent judgments passed by the Supreme Court of India, landmark High Court rulings, or global tribunals.
                      </p>
                    </div>
                  </div>

                  {/* Book Reviews */}
                  <div className="admin-card" style={{ margin: 0, borderTop: '4px solid #0f172a', display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '24px' }}>📚</span>
                          <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>Book Reviews</h4>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(15,23,42,0.06)', color: '#0f172a', padding: '3px 8px', borderRadius: '12px' }}>
                          1,500 – 3,600 Words
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        Scholarly audits of recently published legal literature, treatises, textbooks, or influential non-fiction monographs addressing policy domains.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Scope & Eligibility Panel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  
                  {/* Theme & Scope */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '28px',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span style={{ color: 'var(--primary)' }}>🧭</span> Themes & Scope
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '16px' }}>
                      NJLRII is a multidisciplinary forum. We believe every aspect of law is vital and therefore enforce <strong>no rigid theme limits</strong>. We welcome high-quality research intersecting law with other domains:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['Constitutional Law', 'Corporate & Commerce', 'Human Rights', 'Technology & AI Policy', 'Humanities & Sociology', 'Psychology & Crime', 'Public Policy'].map(tag => (
                        <span key={tag} style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(15,23,42,0.04)',
                          color: '#0f172a',
                          padding: '4px 10px',
                          borderRadius: '30px',
                          border: '1px solid var(--border)'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Author Eligibility */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '28px',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span style={{ color: 'var(--primary)' }}>🎓</span> Author Eligibility
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '14px' }}>
                      Our journal welcomes contributions from diverse academic levels and practices:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--foreground)' }}>
                      {['Law students pursuing 5-Year integrated LL.B. or 3-Year LL.B. courses.', 
                        'Postgraduate legal scholars pursuing LL.M. or Ph.D. programs.', 
                        'Distinguished legal educators, researchers, and academicians.', 
                        'Practicing advocates, judicial officers, and legal professionals.', 
                        'Interdisciplinary students in Arts, Commerce, or Social Sciences.'].map((rule, idx) => (
                        <li key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* Procedure For Acceptance */}
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scholarly Vetting</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px', marginBottom: '24px' }}>Procedure For Acceptance</h3>
                  
                  {/* Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '20px',
                      top: '10px',
                      bottom: '10px',
                      width: '2px',
                      backgroundColor: 'var(--border)',
                      zIndex: 1
                    }}></div>

                    {[
                      { step: 1, title: 'Initial Screening & Alignment Check', desc: 'Upon receipt, our internal Editorial Board screens the manuscript for general formatting alignment, plagiarism thresholds, and conformance with NJLRII guidelines.' },
                      { step: 2, title: 'Abstract Audit (Mandatory)', desc: 'For Research Papers and Articles, a mandatory abstract of up to 300 words including at least 3 keywords denoting the theme must be integrated. This is analyzed for clarity, scope, and indexable keywords.' },
                      { step: 3, title: 'Double-Blind Peer Review', desc: 'Submissions that clear the screening stage undergo a rigorous peer evaluation managed by our network of globally recognized scholars. Neither the author nor reviewers know each other\'s identities.' },
                      { step: 4, title: 'Author Amendments (If Requested)', desc: 'If the peer-reviewers recommend publication subject to revisions, the author is given exactly two weeks (14 days) to incorporate amendments and submit the final camera-ready manuscript.' }
                    ].map(node => (
                      <div key={node.step} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2 }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: node.step === 1 ? 'var(--primary)' : '#0f172a',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '14px',
                          flexShrink: 0
                        }}>
                          {node.step}
                        </div>
                        <div style={{
                          backgroundColor: 'rgba(15,23,42,0.02)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          width: '100%'
                        }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', marginBottom: '4px' }}>{node.title}</h4>
                          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.4' }}>{node.desc}</p>
                        </div>
                      </div>
                    ))}

                  </div>
                </div>

                {/* Certified perks */}
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Author Perks</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px', marginBottom: '20px' }}>Incentives & Scholar Recognition</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {[
                      { icon: '🏆', title: 'Certificate of Publication', desc: 'Each co-author receives an official certified Certificate of Publication displaying unique registration serials.' },
                      { icon: '🎗️', title: 'Meritorious Paper Awards', desc: 'The top three research papers in every issue receive cash tokens and a formal gift of recognition from the NJLRII family.' },
                      { icon: '📦', title: 'Physical Direct Delivery', desc: 'Hardcopy certificates and gifts are securely dispatched to the authors\' postal addresses via standard tracked shipping.' },
                      { icon: '⭐', title: 'Quarterly Spotlight', desc: 'Our Editorial Board shortlists and features the "Top 1 Article or Paper" on the journal homepage every quarter.' }
                    ].map((p, idx) => (
                      <div key={idx} style={{
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}>
                        <span style={{ fontSize: '24px' }}>{p.icon}</span>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', display: 'block' }}>{p.title}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '4px', lineHeight: '1.4' }}>{p.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct CTA card to switch tabs */}
                <div style={{
                  backgroundColor: '#0f172a',
                  color: 'white',
                  borderRadius: '16px',
                  padding: '36px',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-md)',
                  backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 90.1%)'
                }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(252, 4, 52, 0.15)',
                    color: 'var(--primary)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Critical Requirement
                  </span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '16px', marginBottom: '8px' }}>Ready to Submit Your Manuscript?</h3>
                  <p style={{ fontSize: '13.5px', color: '#94a3b8', maxWidth: '580px', margin: '0 auto 24px', lineHeight: '1.5' }}>
                    Ensure your document complies with all peer-review guidelines. NJLRII enforces a strict limit: <strong>only one submission per author is permitted per review cycle.</strong>
                  </p>
                  <button
                    onClick={() => setActiveTab('submit')}
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 700,
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '14px 32px',
                      borderRadius: '30px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(252, 4, 52, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🚀 Go To Submission Form
                  </button>
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: ACTIVE ONLINE MANUSCRIPT SUBMISSION FORM */}
            {/* ======================================================== */}
            {activeTab === 'submit' && (
              <div>
                
                {/* 🚨 Strict Warnings Panel */}
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid var(--primary)',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '32px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ 
                    fontSize: '13.5px', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.06em', 
                    color: 'var(--primary)', 
                    marginBottom: '14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span>🚨</span> Critical Scholarly Guidelines — Must Comply
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--foreground)', lineHeight: '1.5' }}>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '16px', lineHeight: 1 }}>📌</span>
                      <div>
                        <strong>Strict Traditional Footnote Rule:</strong> NJLRII strictly mandates standard, traditional footnotes (e.g. <strong>Bluebook 21st Edition</strong> or OSCOLA style guidelines). Submitting draft manuscripts containing <strong>endnotes</strong> leads to immediate, automated disqualification.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '16px', lineHeight: 1 }}>📌</span>
                      <div>
                        <strong>Double-Blind Anonymity Check:</strong> To protect impartial vetting, authors must <strong>NOT</strong> list their names, email addresses, university details, or any co-author identifications anywhere inside the uploaded Word document draft file.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '16px', lineHeight: 1 }}>📌</span>
                      <div>
                        <strong>MS Word Formats Only:</strong> Upload or link formatted Word files (<strong>.doc</strong> or <strong>.docx</strong>) only. Submitting manuscripts in PDF, TXT, or zip formats is strictly blocked and rejected.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '16px', lineHeight: 1 }}>📌</span>
                      <div>
                        <strong>No Registered Account Required:</strong> Submit your details and paper directly below. A unique alphanumeric tracking ID will be generated upon successful receipt, allowing you to monitor status at the <strong>Track Paper</strong> console.
                      </div>
                    </div>

                  </div>
                </div>

                {/* Error Notification Alert */}
                {error && (
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    color: 'var(--error)',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>⚠️</span> {error}
                  </div>
                )}

                {/* Interactive Submission Form */}
                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  
                  {/* Dynamic Authors Counter Card */}
                  <div className="admin-card" style={{ margin: 0 }}>
                    <div className="card-header-block" style={{ padding: '20px 24px' }}>
                      <h3 style={{ fontSize: '13.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👨‍💻 Author Density Settings</h3>
                    </div>
                    <div className="card-body-content" style={{ padding: '24px' }}>
                      <div className="form-field-group">
                        <label className="form-label-text">Select Total Number of Author(s)</label>
                        <select 
                          value={authorCount} 
                          onChange={(e) => setAuthorCount(Number(e.target.value))}
                          className="form-input-control"
                          style={{ height: '48px', cursor: 'pointer' }}
                        >
                          <option value={1}>Single Author (Only First Author)</option>
                          <option value={2}>Two Authors (First Author + One Co-Author)</option>
                          <option value={3}>Three Authors (First Author + Two Co-Authors)</option>
                          <option value={4}>Four Authors (First Author + Three Co-Authors)</option>
                          <option value={5}>Five Authors (First Author + Four Co-Authors)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CARD: First Author details */}
                  <div className="admin-card" style={{ margin: 0 }}>
                    <div className="card-header-block" style={{ padding: '20px 24px' }}>
                      <h3 style={{ fontSize: '13.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>👤 First Author Details (Primary Submitter)</h3>
                    </div>
                    <div className="card-body-content" style={{ padding: '24px' }}>
                      <div className="form-grid-layout">
                        
                        <div className="form-field-group col-span-6">
                          <label className="form-label-text">Full Name *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. Dr. Ayush Sharma"
                            value={primaryName}
                            onChange={(e) => setPrimaryName(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                        <div className="form-field-group col-span-6">
                          <label className="form-label-text">Institutional Affiliation *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. National Law University, Delhi"
                            value={primaryAffiliation}
                            onChange={(e) => setPrimaryAffiliation(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                        <div className="form-field-group col-span-12">
                          <label className="form-label-text">Academic Course Details * (Course - Year - Semester)</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. B.A. LL.B. (Hons.) - 3rd Year - 5th Semester (Write 'Faculty' or 'Practitioner' if not a student)"
                            value={primaryCourse}
                            onChange={(e) => setPrimaryCourse(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                        <div className="form-field-group col-span-6">
                          <label className="form-label-text">Email Address *</label>
                          <input 
                            type="email" 
                            required 
                            placeholder="e.g. ayush@nlu.edu"
                            value={primaryEmail}
                            onChange={(e) => setPrimaryEmail(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                        <div className="form-field-group col-span-6">
                          <label className="form-label-text">Phone Number *</label>
                          <input 
                            type="tel" 
                            required 
                            placeholder="e.g. +91 98765 43210"
                            value={primaryPhone}
                            onChange={(e) => setPrimaryPhone(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* CARDs: Co-Author Details (Dynamically Rendered) */}
                  {authorCount > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {Array.from({ length: authorCount - 1 }).map((_, idx) => (
                        <div key={idx} className="admin-card" style={{ margin: 0, animation: 'fadeIn 0.3s ease' }}>
                          <div className="card-header-block" style={{ padding: '16px 24px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👥 Co-Author #{idx + 1} Details</h3>
                          </div>
                          <div className="card-body-content" style={{ padding: '24px' }}>
                            <div className="form-grid-layout">
                              
                              <div className="form-field-group col-span-6">
                                <label className="form-label-text">Co-Author Name *</label>
                                <input 
                                  type="text" 
                                  required
                                  placeholder="e.g. Priyanshu Roy"
                                  value={coAuthors[idx]?.name || ''}
                                  onChange={(e) => handleCoAuthorChange(idx, 'name', e.target.value)}
                                  className="form-input-control"
                                />
                              </div>

                              <div className="form-field-group col-span-6">
                                <label className="form-label-text">Co-Author Affiliation & Course *</label>
                                <input 
                                  type="text" 
                                  required
                                  placeholder="e.g. Faculty of Law, AMU (LL.M - 1st Year)"
                                  value={coAuthors[idx]?.affiliation || ''}
                                  onChange={(e) => handleCoAuthorChange(idx, 'affiliation', e.target.value)}
                                  className="form-input-control"
                                />
                              </div>

                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CARD: Paper Details */}
                  <div className="admin-card" style={{ margin: 0 }}>
                    <div className="card-header-block" style={{ padding: '20px 24px' }}>
                      <h3 style={{ fontSize: '13.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>📝 Manuscript & Paper Registry Details</h3>
                    </div>
                    <div className="card-body-content" style={{ padding: '24px' }}>
                      <div className="form-grid-layout">
                        
                        <div className="form-field-group col-span-4">
                          <label className="form-label-text">Submission Track Type *</label>
                          <select
                            value={submissionType}
                            onChange={(e) => setSubmissionType(e.target.value)}
                            className="form-input-control"
                            style={{ height: '48px', cursor: 'pointer' }}
                          >
                            <option value="Research Paper">Research Paper (3,500 – 10,000 words)</option>
                            <option value="Long Article">Long Article (2,500 – 4,000 words)</option>
                            <option value="Short Article">Short Article (1,500 – 2,500 words)</option>
                            <option value="Case Comment">Case Comment (1,800 – 3,000 words)</option>
                            <option value="Book Review">Book Review (1,500 – 3,600 words)</option>
                          </select>
                        </div>

                        <div className="form-field-group col-span-8">
                          <label className="form-label-text">Title of the Article / Paper *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. Critical Analysis of Right to Privacy under Article 21 of the Indian Constitution"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="form-input-control"
                          />
                        </div>

                        <div className="form-field-group col-span-12">
                          <label className="form-label-text">Keywords * (Comma separated)</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. Constitutional Law, Right to Privacy, Article 21, Supreme Court, Digital Rights"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            className="form-input-control"
                          />
                          <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Provide at least 3 keywords separated by commas to aid indexing databases.</span>
                        </div>

                        <div className="form-field-group col-span-12">
                          <label className="form-label-text">Scholarly Abstract *</label>
                          <textarea 
                            required
                            placeholder="Provide the complete abstract introducing the research questions, core statutory analyses, methodology, and academic results (Max 300 words)..."
                            value={abstract}
                            onChange={(e) => setAbstract(e.target.value)}
                            className="form-input-control"
                            style={{ minHeight: '130px', resize: 'vertical' }}
                          />
                        </div>

                        {/* Premium File Upload Block */}
                        <div className="form-field-group col-span-12" style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <label className="form-label-text">Manuscript Draft Document File *</label>
                            
                            {/* Selector toggle */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => { if (!isFileUploading) { setUploadMethod('upload'); setFileUrl(''); setUploadedFileName(null); } }}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  border: uploadMethod === 'upload' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                                  backgroundColor: uploadMethod === 'upload' ? 'rgba(252,4,52,0.06)' : 'white',
                                  color: uploadMethod === 'upload' ? 'var(--primary)' : 'var(--muted)',
                                  cursor: isFileUploading ? 'not-allowed' : 'pointer',
                                  opacity: isFileUploading && uploadMethod !== 'upload' ? 0.5 : 1
                                }}
                              >
                                Upload Local File (.docx)
                              </button>
                              <button
                                type="button"
                                onClick={() => { if (!isFileUploading) { setUploadMethod('link'); setFileUrl(''); setUploadedFileName(null); } }}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  border: uploadMethod === 'link' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                                  backgroundColor: uploadMethod === 'link' ? 'rgba(252,4,52,0.06)' : 'white',
                                  color: uploadMethod === 'link' ? 'var(--primary)' : 'var(--muted)',
                                  cursor: isFileUploading ? 'not-allowed' : 'pointer',
                                  opacity: isFileUploading && uploadMethod !== 'link' ? 0.5 : 1
                                }}
                              >
                                Paste Cloud Link
                              </button>
                            </div>
                          </div>

                          {uploadMethod === 'upload' ? (
                            <div className="drag-upload-container" style={{ position: 'relative', cursor: isFileUploading ? 'not-allowed' : 'pointer' }}>
                              <input 
                                key="file-uploader"
                                type="file" 
                                accept=".doc,.docx"
                                onChange={handleLocalFileSelect}
                                disabled={isFileUploading}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0,
                                  cursor: isFileUploading ? 'not-allowed' : 'pointer',
                                  zIndex: 10
                                }}
                              />
                              {isFileUploading ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '12px'
                                }}>
                                  <div className="animate-spin" style={{
                                    width: '36px',
                                    height: '36px',
                                    border: '3px solid rgba(252,4,52,0.1)',
                                    borderTop: '3px solid var(--primary)',
                                    borderRadius: '50%',
                                    marginBottom: '12px'
                                  }} />
                                  <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                                    Saving manuscript securely to Cloudinary...
                                  </strong>
                                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                    Please keep this browser window open.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontSize: '24px' }}>📥</div>
                                  <div>
                                    <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                                      {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Choose Word draft or drag & drop here'}
                                    </strong>
                                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                      Accepts formatted MS Word documents (.doc, .docx) up to 25MB.
                                    </p>
                                  </div>
                                  {uploadedFileName && (
                                    <div style={{
                                      fontSize: '11px',
                                      color: 'var(--success)',
                                      fontWeight: 'bold',
                                      backgroundColor: 'rgba(16,185,129,0.08)',
                                      padding: '4px 12px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(16,185,129,0.15)',
                                      marginTop: '8px'
                                    }}>
                                      ✓ Valid Word Draft Saved on Cloudinary
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <div>
                              <input 
                                key="url-link-input"
                                type="url" 
                                placeholder="e.g. Paste shareable Google Drive, OneDrive, or Dropbox link to your Word draft..."
                                value={fileUrl}
                                onChange={(e) => setFileUrl(e.target.value)}
                                className="form-input-control"
                                style={{ height: '48px' }}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                                Ensure file permission settings on your Cloud link are set to "Anyone with the link can view/edit".
                              </span>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Submit Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="submit"
                      disabled={loading || isFileUploading}
                      className="btn-action primary"
                      style={{
                        padding: '16px 36px',
                        fontSize: '14px',
                        borderRadius: '30px',
                        cursor: (loading || isFileUploading) ? 'not-allowed' : 'pointer',
                        width: '100%',
                        maxWidth: '320px',
                        opacity: (loading || isFileUploading) ? 0.7 : 1,
                      }}
                    >
                      {loading ? '⏳ Vetting & Submitting...' : isFileUploading ? '⏳ Uploading Manuscript...' : '💾 Submit Paper Online'}
                    </button>
                  </div>

                </form>
              </div>
            )}

          </div>

          {/* B. RIGHT COLUMN - Branded Info Sidebar */}
          <aside className="no-print">
            {/* Quick Track Redirect Card */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--foreground)', marginBottom: '8px' }}>Already Submitted?</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Track the formatting, plagiarism and peer-review milestones of your registered paper in real-time.
              </p>
              <Link href="/track" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                textTransform: 'uppercase',
                padding: '12px 16px',
                borderRadius: '30px',
                boxShadow: '0 4px 10px rgba(252, 4, 52, 0.2)'
              }}>
                🔍 Track Manuscript Progress
              </Link>
            </div>

            {/* Indexing Highlights Card */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px 24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              {/* Card Title */}
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--foreground)' }}>Journal Highlights</h3>
                <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>METRICS & ARCHIVES</span>
              </div>

              {/* Bulleted Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', filter: 'grayscale(0.2)' }}>📈</span>
                  <div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--foreground)', display: 'block' }}>Impact Factor 7.010</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>High scholastic reach and citation frequency metric benchmarks.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', filter: 'grayscale(0.2)' }}>🗄️</span>
                  <div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--foreground)', display: 'block' }}>Top Databases Indexing</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>Archived in HeinOnline, Manupatra, Google Scholar, ROAD, and more.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', filter: 'grayscale(0.2)' }}>🆔</span>
                  <div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--foreground)', display: 'block' }}>Unique DOI Allocation</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>Every accepted research article receives a unique digital identifier registry.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', filter: 'grayscale(0.2)' }}>🎓</span>
                  <div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--foreground)', display: 'block' }}>Separate E-Certificates</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>Distinct official publishing certificates issued to all co-authors independently.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '18px', filter: 'grayscale(0.2)' }}>🤝</span>
                  <div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--foreground)', display: 'block' }}>Double-Blind Peer Review</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>Rigorous evaluation from academic experts to protect intellectual impartiality.</span>
                  </div>
                </div>

              </div>

              {/* Harvard Stanford Seal Label */}
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '20px',
                marginTop: '4px',
                textAlign: 'center'
              }}>
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--foreground)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'block'
                }}>
                  Harvard, Stanford & 331+ Libraries
                </span>
                <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>Indexed and digitally preserved in legal catalogs globally.</span>
              </div>
            </div>
          </aside>

        </div>
      </div>

      {/* 3. PRINTABLE SUCCESS RECEIPT MODAL OVERLAY */}
      {success && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 10000,
          animation: 'fadeIn 0.25s ease'
        }}>
          <div 
            id="printable-receipt-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              padding: '40px',
              boxShadow: 'var(--shadow-lg)',
              borderTop: '8px solid var(--primary)',
              position: 'relative'
            }}
          >
            {/* Modal Logo Heading */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '36px' }}>🏆</span>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--foreground)', marginTop: '12px' }}>
                Manuscript Submission Complete!
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                National Journal for Legal Research and Innovative Ideas
              </p>
            </div>

            {/* Generated Tracking ID Banner */}
            <div style={{
              backgroundColor: 'rgba(252, 4, 52, 0.05)',
              border: '1.5px dashed var(--primary)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '28px'
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)'
              }}>
                Unique Manuscript Tracking ID
              </span>
              <h1 style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '32px',
                fontWeight: 800,
                color: 'var(--primary)',
                letterSpacing: '0.04em',
                margin: '4px 0 0 0'
              }}>
                {generatedTrackingId}
              </h1>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '6px' }}>
                Copy and save this ID. It is required to track your editorial timeline status!
              </span>
            </div>

            {/* Submission metadata table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>First Author</span>
                <strong style={{ color: 'var(--foreground)' }}>{primaryName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Track Type</span>
                <strong style={{ color: 'var(--foreground)' }}>{submissionType}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Manuscript Title</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 'bold', maxWidth: '300px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Registered Email</span>
                <strong style={{ color: 'var(--foreground)' }}>{primaryEmail}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--muted)' }}>Milestone Checks</span>
                <strong style={{ color: 'var(--warning)' }}>Pending Screening Vetting</strong>
              </div>
            </div>

            {/* Modal Buttons (Includes Print button) */}
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#0f172a',
                    color: 'white',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 700,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🖨️ Print Receipt
                </button>

                <Link
                  href="/track"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 700,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    padding: '12px 16px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(252, 4, 52, 0.2)'
                  }}
                >
                  🔍 Track Live Status
                </Link>
              </div>

              <button
                onClick={resetForm}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--muted)',
                  border: '1.5px solid var(--border)',
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  padding: '10px 16px',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                Submit Another Paper
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Styled Printable rules */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          header, aside, form, .no-print, nav {
            display: none !important;
          }
          #printable-receipt-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .nav-menu-link {
          transition: color 0.15s ease;
        }
        .nav-menu-link:hover {
          color: var(--primary) !important;
        }
      `}</style>

    </div>
  );
}
