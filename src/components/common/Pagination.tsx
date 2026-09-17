'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  disabled = false,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show (e.g. 1, 2, 3, 4, 5)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white border-t border-slate-200">
      {/* Page Size & Count info */}
      <div className="flex items-center space-x-4 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-slate-200 rounded px-2 py-1 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <span>
          Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> results
        </span>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || disabled}
          className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
        </button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 text-xs">
                  ...
                </span>
              );
            }
            const isCurrent = page === currentPage;
            return (
              <button
                key={`page-${page}`}
                onClick={() => onPageChange(page as number)}
                disabled={disabled}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || disabled}
          className="inline-flex items-center px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>
    </div>
  );
}
