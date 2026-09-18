'use client';

import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { DriverStatus } from '@/lib/types';

interface DriverSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter?: DriverStatus;
  onStatusFilterChange: (status: DriverStatus | undefined) => void;
  totalDriversCount?: number;
}

export default function DriverSearchBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalDriversCount,
}: DriverSearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by driver number..."
          className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all shadow-xs"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center space-x-2">
        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter || ''}
            onChange={(e) => onStatusFilterChange((e.target.value as DriverStatus) || undefined)}
            className="appearance-none pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden transition-colors shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
