import React from 'react';

interface BadgeProps {
  status: 'active' | 'inactive' | 'voided';
  className?: string;
}

export default function Badge({ status, className = '' }: BadgeProps) {
  switch (status) {
    case 'active':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Active
        </span>
      );
    case 'inactive':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
          Inactive
        </span>
      );
    case 'voided':
      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          Voided
        </span>
      );
    default:
      return null;
  }
}
