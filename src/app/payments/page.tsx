'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, Calendar, FileSpreadsheet, ArrowLeft, Search, Edit2, AlertTriangle, X } from 'lucide-react';
import { Payment } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { formatDisplayDate } from '@/lib/dates';
import Badge from '@/components/common/Badge';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentVoidModal from '@/components/payments/PaymentVoidModal';
import Pagination from '@/components/common/Pagination';
import { exportPaymentsToExcel } from '@/lib/export';
import { toast } from 'sonner';

export default function PaymentsLedgerPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [driverSearch, setDriverSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Modals
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const parsedDriverNum = parseInt(driverSearch.trim(), 10);
      if (!isNaN(parsedDriverNum)) {
        params.set('driverNumber', String(parsedDriverNum));
      }
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payments');

      const data = await res.json();
      setPayments(data.data || []);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Error loading payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fromDate, toDate, driverSearch, currentPage, pageSize]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      // Export exactly what the current filters show; with no filters set, that
      // is every record.
      const exportDriverNum = parseInt(driverSearch.trim(), 10);
      if (!isNaN(exportDriverNum)) params.set('driverNumber', String(exportDriverNum));
      params.set('limit', 'all');

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load payments for export');

      const data = await res.json();
      const list = data.data || [];

      if (list.length === 0) {
        toast.info('No payment records to export');
        return;
      }

      exportPaymentsToExcel({
        payments: list,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      toast.success(`Exported ${list.length} payment records`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-slate-900" /> Payment Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete financial transaction audit records with void and edit controls
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Payment Form
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Driver Number Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              value={driverSearch}
              onChange={(e) => {
                setDriverSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by Driver #..."
              className="pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg w-44 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
            <span className="font-medium text-slate-500 ml-1">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
            {(fromDate || toDate || driverSearch) && (
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setDriverSearch('');
                  setCurrentPage(1);
                }}
                className="text-slate-400 hover:text-slate-700 underline text-xs ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Export Excel */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
          <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Driver #</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Audit / Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-slate-500">Loading ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold text-slate-700">No payment transactions found.</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isVoided = p.status === 'voided';
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoided ? 'bg-slate-50/50 text-slate-400' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-xs font-medium whitespace-nowrap text-slate-800">
                        {formatDisplayDate(p.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        <Link href={`/drivers/${p.driverId}`} className="hover:underline">
                          #{p.driverNumber}
                        </Link>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          isVoided ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge status={p.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title={p.notes || ''}>
                        {p.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-xs">
                        {isVoided ? (
                          <span className="text-slate-400 italic text-[11px]">Voided</span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setEditingPayment(p)}
                              className="px-2 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors"
                              title="Edit payment amount"
                            >
                              Edit
                            </button>
                            <span className="text-slate-300">/</span>
                            <button
                              onClick={() => setVoidingPayment(p)}
                              className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                              title="Void payment"
                            >
                              Void
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Edit & Void Modals */}
      <PaymentEditModal
        isOpen={!!editingPayment}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSuccess={(updated, msg) => {
          toast.success(msg);
          fetchPayments();
        }}
      />

      <PaymentVoidModal
        isOpen={!!voidingPayment}
        payment={voidingPayment}
        onClose={() => setVoidingPayment(null)}
        onSuccess={(voided, msg) => {
          toast.success(msg);
          fetchPayments();
        }}
      />
    </div>
  );
}
