'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface ManuscriptData {
  id: number;
  title: string;
  abstract: string;
  keywords: string[];
  author_name: string;
  author_affiliation: string;
  co_authors: any[];
  status: 'submitted' | 'under_review' | 'revision' | 'accepted' | 'rejected';
  created_at: string;
  step1_status: 'pending' | 'revision' | 'passed' | 'failed';
  step1_feedback?: string;
  step2_status: 'pending' | 'revision' | 'passed' | 'failed';
  step2_feedback?: string;
  step3_status: 'pending' | 'revision' | 'passed' | 'failed';
  step3_feedback?: string;
  step4_status: 'pending' | 'revision' | 'passed' | 'failed';
  step4_feedback?: string;
}

export default function TrackPaperPage() {
  const [trackingInput, setTrackingInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manuscript, setManuscript] = useState<ManuscriptData | null>(null);

  const handleTrackQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setManuscript(null);

    if (!trackingInput.trim()) {
      setError('Please enter a valid tracking ID.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackingId: trackingInput.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch status.');
      }

      setManuscript(result.manuscript);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Tracking ID not found. Verify the ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to get global status display settings
  const getGlobalStatusMeta = (status: ManuscriptData['status']) => {
    switch (status) {
      case 'submitted':
        return { label: 'Received & Submitted', bg: 'rgba(59, 130, 246, 0.08)', color: 'var(--info)', border: 'rgba(59, 130, 246, 0.2)' };
      case 'under_review':
        return { label: 'Under Review Vetting', bg: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning)', border: 'rgba(245, 158, 11, 0.2)' };
      case 'revision':
        return { label: 'Revision Action Required', bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'accepted':
        return { label: 'Accepted', bg: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)', border: 'rgba(16, 185, 129, 0.2)' };
      case 'rejected':
        return { label: 'Rejected / Disqualified', bg: 'rgba(239, 68, 68, 0.08)', color: 'var(--error)', border: 'rgba(239, 68, 68, 0.2)' };
      default:
        return { label: status, bg: 'var(--surface)', color: 'var(--muted)', border: 'var(--border)' };
    }
  };

  return (
    <div style={{ backgroundColor: '#fcfdfd', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* 1. Cohesive Header Navigation */}
      <header style={{
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
            
            <Link href="/author" style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'white',
              backgroundColor: 'var(--primary)',
              padding: '10px 18px',
              borderRadius: '30px',
              boxShadow: '0 4px 10px rgba(252, 4, 52, 0.25)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}>
              Submit Paper Online
            </Link>

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

      {/* 2. Page Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px 80px' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '32px' }}>🔍</span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--foreground)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            Track Manuscript Status
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px', maxWidth: '480px', margin: '6px auto 0', lineHeight: '1.5' }}>
            Enter your unique registered tracking ID below to check the real-time formatting screening and peer-review evaluation checkpoints.
          </p>
        </div>

        {/* Query Input Card */}
        <div className="admin-card" style={{ padding: '32px', boxShadow: 'var(--shadow-md)', marginBottom: '40px' }}>
          <form onSubmit={handleTrackQuery} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Enter Manuscript Tracking ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. NJLRII-V6I3-3A4B5"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                className="form-input-control"
                style={{
                  height: '52px',
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-action primary"
              style={{
                height: '52px',
                padding: '0 32px',
                borderRadius: '8px',
                alignSelf: 'flex-end',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                flexShrink: 0
              }}
            >
              {loading ? 'Searching...' : 'Search Status'}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              color: 'var(--error)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* 3. DYNAMIC STATUS & PIPELINE TIMELINE */}
        {manuscript && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            
            {/* Header: Paper details summary */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '32px',
              marginBottom: '32px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Border accent */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: 'var(--primary)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
                    TRACKING RECORD LOADED SUCCESS
                  </span>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--foreground)', marginTop: '4px', lineHeight: '1.4' }}>
                    {manuscript.title}
                  </h2>
                </div>
                
                {/* Global Status badge */}
                {(() => {
                  const meta = getGlobalStatusMeta(manuscript.status);
                  return (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '6px 14px',
                      borderRadius: '30px',
                      backgroundColor: meta.bg,
                      color: meta.color,
                      border: `1.5px solid ${meta.border}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap'
                    }}>
                      {meta.label}
                    </span>
                  );
                })()}
              </div>

              {/* Author & submit info grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                borderTop: '1px solid var(--border)',
                paddingTop: '20px',
                fontSize: '13px'
              }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>First Author Name</span>
                  <strong style={{ color: 'var(--foreground)', marginTop: '2px', display: 'block' }}>{manuscript.author_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Affiliation Info</span>
                  <strong style={{ color: 'var(--foreground)', marginTop: '2px', display: 'block' }}>{manuscript.author_affiliation}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Date Registered</span>
                  <strong style={{ color: 'var(--foreground)', marginTop: '2px', display: 'block' }}>
                    {new Date(manuscript.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Stepper Pipeline Timeline Card */}
            <div className="admin-card" style={{ padding: '36px 32px' }}>
              <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚙️ Editorial Screening Timeline
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Live overview of validation steps. Discovered mistakes can be fixed by communicating via email.
                </p>
              </div>

              {/* Steps Vertical Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
                {(() => {
                  const steps = [
                    { num: 1, title: 'Step 1: Document Style & Formatting Check', desc: 'Checks MS Word compliance, footnotes, margins, and bibliography hygiene.' },
                    { num: 2, title: 'Step 2: Plagiarism & AI Detection Check', desc: 'Runs strict integrity checks. Limits similarity to original indices.' },
                    { num: 3, title: 'Step 3: Peer Quality Review Check', desc: 'Ensures scholarly arguments, depth of study, and structural credibility are validated.' },
                    { num: 4, title: 'Step 4: Editorial Board Approval Check', desc: 'Formal Board Director consensus to compile and allocate DOI issue releases.' }
                  ];

                  return steps.map((step, idx) => {
                    const currentStatus = (manuscript as any)[`step${step.num}_status`] || 'pending';
                    const feedbackText = (manuscript as any)[`step${step.num}_feedback`] || '';

                    // Styling based on status
                    let statusColor = 'var(--muted)';
                    let statusBg = 'var(--surface)';
                    let statusBorder = 'var(--border)';
                    let statusIcon = '⏳';
                    let badgeLabel = 'Pending Check';
                    let showFeedbackBox = false;

                    if (currentStatus === 'passed') {
                      statusColor = 'var(--success)';
                      statusBg = 'rgba(16, 185, 129, 0.08)';
                      statusBorder = 'rgba(16, 185, 129, 0.2)';
                      statusIcon = '✓';
                      badgeLabel = 'Verification Cleared';
                    } else if (currentStatus === 'revision') {
                      statusColor = 'var(--warning)';
                      statusBg = 'rgba(245, 158, 11, 0.08)';
                      statusBorder = 'rgba(245, 158, 11, 0.2)';
                      statusIcon = '⚠️';
                      badgeLabel = 'Revision Required';
                      showFeedbackBox = true;
                    } else if (currentStatus === 'failed') {
                      statusColor = 'var(--error)';
                      statusBg = 'rgba(239, 68, 68, 0.08)';
                      statusBorder = 'rgba(239, 68, 68, 0.2)';
                      statusIcon = '✕';
                      badgeLabel = 'Screening Disqualified';
                      showFeedbackBox = true;
                    }

                    // Also show feedback if it explicitly exists even if passed
                    if (feedbackText && feedbackText.trim().length > 0) {
                      showFeedbackBox = true;
                    }

                    return (
                      <div key={step.num} style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                        
                        {/* Vertical line connector */}
                        {idx < steps.length - 1 && (
                          <div style={{
                            position: 'absolute',
                            left: '21px',
                            top: '44px',
                            bottom: '-28px',
                            width: '2px',
                            backgroundColor: 'var(--border)',
                            zIndex: 1
                          }} />
                        )}

                        {/* Step Circle Node */}
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: statusBg,
                          border: `2px solid ${statusColor}`,
                          color: statusColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '16px',
                          zIndex: 2,
                          flexShrink: 0,
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          {statusIcon}
                        </div>

                        {/* Step body details */}
                        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: 'var(--foreground)' }}>
                                {step.title}
                              </h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>
                                {step.desc}
                              </p>
                            </div>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: '20px',
                              backgroundColor: statusBg,
                              color: statusColor,
                              border: `1.5px solid ${statusBorder}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}>
                              {badgeLabel}
                            </span>
                          </div>

                          {/* Actionable Editorial Dialogue Feedback Alert Box */}
                          {showFeedbackBox && (
                            <div style={{
                              backgroundColor: 'white',
                              border: `1.5px solid ${statusBorder}`,
                              borderLeft: `4px solid ${statusColor}`,
                              borderRadius: '8px',
                              padding: '14px 16px',
                              marginTop: '4px',
                              boxShadow: 'var(--shadow-sm)'
                            }}>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: statusColor,
                                letterSpacing: '0.04em',
                                display: 'block',
                                marginBottom: '4px'
                              }}>
                                💬 Board Vetting Comments & Action Required
                              </span>
                              <p style={{
                                margin: 0,
                                fontSize: '12.5px',
                                fontStyle: 'italic',
                                color: 'var(--foreground)',
                                opacity: 0.95,
                                lineHeight: '1.5'
                              }}>
                                "{feedbackText || 'Please contact submission@njlrii.com for details regarding this checkpoint action.'}"
                              </p>
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  });
                })()}
              </div>

            </div>

          </div>
        )}

      </div>

      <style jsx global>{`
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
