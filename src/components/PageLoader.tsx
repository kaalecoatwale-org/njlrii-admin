'use client';

import React from 'react';

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg, #0f1729)',
      gap: '20px',
      zIndex: 9999,
    }}>
      {/* Animated logo */}
      <div style={{
        fontSize: '28px',
        fontWeight: '900',
        letterSpacing: '-0.5px',
        color: 'white',
        fontFamily: 'var(--font-display, Georgia, serif)',
        opacity: 0.9,
      }}>
        NJLRII<span style={{ color: '#ff3b5e' }}>.</span>
      </div>

      {/* Spinner ring */}
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #ff3b5e',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />

      <div style={{
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.05em',
      }}>
        {message}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
