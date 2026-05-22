'use client';

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  if (isLoading || totalCount === 0) {
    return null;
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const generatePageNumbers = () => {
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
            onClick={() => onPageChange(pageNum)}
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
  };

  return (
    <div className="pagination-bar-wrapper">
      <div className="pagination-info-text">
        Showing <span>{startItem}</span> to <span>{endItem}</span> of <span>{totalCount}</span> items
      </div>

      <div className="pagination-controls-flex">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="pagination-btn-nav"
          title="First Page"
        >
          «
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="pagination-btn-nav"
          title="Previous Page"
        >
          ‹
        </button>

        {/* Numeric Direct-Jump Buttons with Dynamic Ellipses */}
        {generatePageNumbers()}

        {/* Next Page */}
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="pagination-btn-nav"
          title="Next Page"
        >
          ›
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="pagination-btn-nav"
          title="Last Page"
        >
          »
        </button>
      </div>
    </div>
  );
}
