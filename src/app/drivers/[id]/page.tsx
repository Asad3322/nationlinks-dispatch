'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, DollarSign, Calendar, FileSpreadsheet, Edit2, Ban, Eye, CheckCircle2 } from 'lucide-react';
import { Driver, Payment } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { formatDisplayDate } from '@/lib/dates';
import Badge from '@/components/common/Badge';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentVoidModal from '@/components/payments/PaymentVoidModal';
import { exportPaymentsToExcel } from '@/lib/export';
import { toast } from 'sonner';

export default function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Payment CRUD Modals
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const loadDriverData = async () => {
    setIsLoading(true);
    try {
      // Load driver profile
      const res = await fetch(`/api/drivers/${resolvedParams.id}`);
      if (!res.ok) throw new Error('Driver not found');
      const d = await res.json();
      setDriver(d);

      // Load driver payments with date filtering
      const pParams = new URLSearchParams();
      pParams.set('driverId', resolvedParams.id);
      if (fromDate) pParams.set('fromDate', fromDate);
      if (toDate) pParams.set('toDate', toDate);
      pParams.set('limit', '1000'); // Load full statement for driver

      const pRes = await fetch(`/api/payments?${pParams.toString()}`);
      if (pRes.ok) {
        const pData = await pRes.json();
        setPayments(pData.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load driver');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, [resolvedParams.id, fromDate, toDate]);

  // Compute active payments total for current view
  const activePayments = payments.filter((p) => p.status === 'active');
  const periodTotalDollars = activePayments.reduce(
    (sum, p) => sum + Math.round(Number(p.amount) * 100),
    0
  ) / 100;

  // Handle Excel Export for this driver
  const handleExportStatement = () => {
    if (!driver || payments.length === 0) {
      toast.info('No payment records to export for this driver.');
      return;
    }

    setIsExporting(true);
    try {
      exportPaymentsToExcel({
        payments,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        driverNumber: driver.driverNumber,
        driverName: driver.driverName,
      });
      toast.success(`Exported statement for Driver #${driver.driverNumber}`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !driver) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading driver statement...</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-bold text-slate-900">Driver Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">The requested driver profile does not exist.</p>
        <Link
          href="/"
          className="inline-flex items-center mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Payment Screen
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back to Home Payment Screen */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Payment Screen
        </Link>
      </div>

      {/* Driver Summary Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-xl bg-[#1e232a] text-white flex items-center justify-center font-bold text-xl shadow-xs">
            #{driver.driverNumber}
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900">{driver.driverName}</h1>
              <Badge status={driver.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered on {formatDisplayDate(driver.createdAt)} • NationLinks Dispatch
            </p>
          </div>
        </div>

        {/* Total Paid Display */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center space-x-4 w-full md:w-auto">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              {fromDate || toDate ? 'Period Total Paid' : 'Total Paid'}
            </span>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(fromDate || toDate ? periodTotalDollars : driver.totalPaid || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Payment History & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-600" /> Payment History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial transaction records for Driver #{driver.driverNumber}
            </p>
          </div>

          {/* Date Filter & Export Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800"
              />
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800"
              />
              {(fromDate || toDate) && (
                <button
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-slate-400 hover:text-slate-700 underline ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              onClick={handleExportStatement}
              disabled={isExporting || payments.length === 0}
              className="inline-flex items-center px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Payments Table: Date | Amount | Status | Actions */}
        {payments.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No payment records found.</p>
            <p className="text-xs text-slate-400 mt-0.5">Payments recorded for this driver will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Notes / Audit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
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
                          <span className="text-slate-400 italic text-[11px]">Transaction Voided</span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            {/* Edit Payment */}
                            <button
                              onClick={() => setEditingPayment(p)}
                              className="px-2 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors"
                              title="Edit payment amount"
                            >
                              Edit
                            </button>

                            <span className="text-slate-300">/</span>

                            {/* Void Payment */}
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Edit Modal */}
      <PaymentEditModal
        isOpen={!!editingPayment}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSuccess={(updated, msg) => {
          toast.success(msg);
          loadDriverData();
        }}
      />

      {/* Payment Void Modal */}
      <PaymentVoidModal
        isOpen={!!voidingPayment}
        payment={voidingPayment}
        onClose={() => setVoidingPayment(null)}
        onSuccess={(voided, msg) => {
          toast.success(msg);
          loadDriverData();
        }}
      />
    </div>
  );
}
