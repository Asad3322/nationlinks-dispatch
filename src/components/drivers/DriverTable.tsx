'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, Trash2, UserX, UserCheck } from 'lucide-react';
import { Driver } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface DriverTableProps {
  drivers: Driver[];
  isLoading: boolean;
  loadError?: string | null;
  sortBy: 'driverNumber' | 'driverName' | 'totalPaid';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'driverNumber' | 'driverName' | 'totalPaid') => void;
  onEditDriver: (driver: Driver) => void;
  onDeleteOrDeactivate: (driver: Driver) => void;
  onForceDelete: (driver: Driver) => void;
}

export default function DriverTable({
  drivers,
  isLoading,
  loadError = null,
  sortBy,
  sortOrder,
  onSort,
  onEditDriver,
  onDeleteOrDeactivate,
  onForceDelete,
}: DriverTableProps) {
  const renderSortIcon = (column: 'driverNumber' | 'driverName' | 'totalPaid') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-slate-300 group-hover:text-slate-500 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-slate-900 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-slate-900 inline" />
    );
  };

  return (
    <div className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          {/* Table Header closely matching reference screenshot */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-700 text-xs font-semibold tracking-wide select-none">
              {/* Driver # Column */}
              <th
                scope="col"
                onClick={() => onSort('driverNumber')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors w-24 text-left group"
              >
                <div className="flex items-center">
                  <span>Driver #</span>
                  {renderSortIcon('driverNumber')}
                </div>
              </th>

              {/* Total Column */}
              <th
                scope="col"
                onClick={() => onSort('totalPaid')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors text-right group"
              >
                <div className="flex items-center justify-end">
                  <span>Total</span>
                  {renderSortIcon('totalPaid')}
                </div>
              </th>

              {/* Actions Column */}
              <th scope="col" className="py-3 px-4 text-right w-44">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium text-slate-500">Loading drivers...</span>
                  </div>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={3} className="py-10 text-center">
                  <p className="text-sm font-semibold text-red-700">Could not load drivers from the database.</p>
                  <p className="text-xs text-red-500 mt-0.5 max-w-xl mx-auto">{loadError}</p>
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-10 text-center text-slate-500">
                  <p className="text-sm font-semibold text-slate-700">No drivers found.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try searching with a different driver number or name.</p>
                </td>
              </tr>
            ) : (
              drivers.map((driver) => {
                const hasPayments = (driver.paymentCount || 0) > 0;
                const isInactive = driver.status === 'inactive';

                return (
                  <tr
                    key={driver.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isInactive ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Driver # */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 text-sm whitespace-nowrap">
                      {driver.driverNumber}
                      {isInactive && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded text-[10px] bg-rose-50 text-rose-600 border border-rose-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="py-3 px-4 text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(driver.totalPaid || 0)}
                    </td>

                    {/* Actions: View / Edit / Deactivate or Delete */}
                    <td className="py-3 px-4 text-right whitespace-nowrap text-xs">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* View */}
                        <Link
                          href={`/drivers/${driver.id}`}
                          className="px-2 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors"
                          title="View statement & payment history"
                        >
                          View
                        </Link>

                        <span className="text-slate-300">/</span>

                        {/* Edit */}
                        <button
                          onClick={() => onEditDriver(driver)}
                          className="px-2 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors"
                          title="Edit driver details"
                        >
                          Edit
                        </button>

                        <span className="text-slate-300">/</span>

                        {/* Drivers with history can be deactivated; Delete always
                            removes the driver and any payments outright. */}
                        {hasPayments && (
                          <>
                            <button
                              onClick={() => onDeleteOrDeactivate(driver)}
                              className={`px-2 py-1 rounded font-medium transition-colors ${
                                isInactive
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={isInactive ? 'Activate Driver' : 'Deactivate Driver (keeps payment history)'}
                            >
                              {isInactive ? 'Activate' : 'Deactivate'}
                            </button>
                            <span className="text-slate-300">/</span>
                          </>
                        )}

                        <button
                          onClick={() => onForceDelete(driver)}
                          className="px-2 py-1 rounded font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                          title={
                            hasPayments
                              ? `Delete driver and all ${driver.paymentCount} payment record(s)`
                              : 'Delete Driver'
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
