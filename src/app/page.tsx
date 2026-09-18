'use client';

import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileSpreadsheet, RefreshCw, X } from 'lucide-react';
import { Driver } from '@/lib/types';
import DriverTable from '@/components/drivers/DriverTable';
import DriverModal from '@/components/drivers/DriverModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import Pagination from '@/components/common/Pagination';
import { exportPaymentsToExcel } from '@/lib/export';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function DriverPaymentPage() {
  // -------------------------------------------------------------
  // QUICK PAYMENT FORM STATE (Matches Screenshot Top Section)
  // -------------------------------------------------------------
  const [driverNumberInput, setDriverNumberInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // -------------------------------------------------------------
  // CONTROLS & TABLE STATE
  // -------------------------------------------------------------
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'driverNumber' | 'driverName' | 'totalPaid'>('driverNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default: Numeric Ascending
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // -------------------------------------------------------------
  // MODALS STATE (Driver CRUD & Confirmation)
  // -------------------------------------------------------------
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Action / Confirmation modal state
  const [confirmTargetDriver, setConfirmTargetDriver] = useState<Driver | null>(null);
  const [confirmMode, setConfirmMode] = useState<'delete' | 'deactivate' | 'activate' | 'forceDelete'>('deactivate');
  const [isConfirmLoading, setIsConfirmLoading] = useState<boolean>(false);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/drivers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      // Surface the server's real reason (e.g. database unreachable) so a failed
      // load is never mistaken for an empty driver list.
      if (!res.ok) throw new Error(data.error || 'Failed to load drivers');

      setDrivers(data.data || []);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
      setLoadError(null);
    } catch (err: any) {
      console.error(err);
      setDrivers([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoadError(err.message || 'Error loading drivers');
      toast.error(err.message || 'Error loading drivers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [search, fromDate, toDate, sortBy, sortOrder, currentPage, pageSize]);

  // -------------------------------------------------------------
  // QUICK PAYMENT SUBMISSION
  // -------------------------------------------------------------
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!driverNumberInput.trim()) {
      toast.error('Please enter a Driver Number (e.g. 45)');
      return;
    }

    const parsedNum = parseInt(driverNumberInput.trim(), 10);
    if (isNaN(parsedNum) || parsedNum <= 0) {
      toast.error('Driver Number must be a valid positive number');
      return;
    }

    if (!amountInput.trim()) {
      toast.error('Please enter an Amount (e.g. 125)');
      return;
    }

    const parsedAmount = parseFloat(amountInput.trim());
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Payment amount must be greater than $0.00');
      return;
    }

    // Double submission prevention
    if (isSubmittingPayment) return;
    setIsSubmittingPayment(true);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverNumber: parsedNum,
          amount: parsedAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process payment');
      }

      // Registering a new driver is a side effect worth surfacing, so a typo in
      // the driver number is obvious rather than silently creating a driver.
      if (data.driverCreated) {
        toast.success(
          `Driver #${parsedNum} registered and payment of $${parsedAmount.toFixed(2)} recorded.`
        );
      } else {
        toast.success(`Payment of $${parsedAmount.toFixed(2)} recorded for Driver #${parsedNum}!`);
      }

      // Reset form
      setDriverNumberInput('');
      setAmountInput('');

      // Recalculate and refresh table immediately
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // -------------------------------------------------------------
  // SORTING HANDLER
  // -------------------------------------------------------------
  const handleSort = (column: 'driverNumber' | 'driverName' | 'totalPaid') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // -------------------------------------------------------------
  // DRIVER DELETE / DEACTIVATE HANDLER
  // -------------------------------------------------------------
  const handleOpenDeleteOrDeactivate = (driver: Driver) => {
    setConfirmTargetDriver(driver);
    const hasPayments = (driver.paymentCount || 0) > 0;

    if (driver.status === 'inactive') {
      setConfirmMode('activate');
    } else if (hasPayments) {
      // Driver HAS payment history -> prevent delete; deactivate instead
      setConfirmMode('deactivate');
    } else {
      // Driver has ZERO payments -> allow permanent deletion
      setConfirmMode('delete');
    }
  };

  // Permanently remove a driver and any payment history they have.
  const handleOpenForceDelete = (driver: Driver) => {
    setConfirmTargetDriver(driver);
    setConfirmMode('forceDelete');
  };

  const handleConfirmDriverAction = async () => {
    if (!confirmTargetDriver) return;
    setIsConfirmLoading(true);

    try {
      if (confirmMode === 'forceDelete') {
        // force=true also removes the driver's payments.
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}?force=true`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete driver');

        toast.success(data.message || `Driver #${confirmTargetDriver.driverNumber} deleted.`);
      } else if (confirmMode === 'delete') {
        // Hard Delete (zero payments)
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete driver');

        toast.success(data.message || `Driver #${confirmTargetDriver.driverNumber} permanently deleted.`);
      } else if (confirmMode === 'deactivate') {
        // Soft Deactivate (has payments)
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'inactive' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to deactivate driver');

        toast.success(`Driver #${confirmTargetDriver.driverNumber} has been deactivated.`);
      } else if (confirmMode === 'activate') {
        // Reactivate
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reactivate driver');

        toast.success(`Driver #${confirmTargetDriver.driverNumber} is now Active.`);
      }

      setConfirmTargetDriver(null);
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setIsConfirmLoading(false);
    }
  };

  // -------------------------------------------------------------
  // EXCEL EXPORT HANDLER
  // -------------------------------------------------------------
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      // No date filter selected means export every record, not just a page.
      params.set('limit', 'all');

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payment records for export');

      const data = await res.json();
      const paymentList = data.data || [];

      if (paymentList.length === 0) {
        toast.info('No payment records found for the selected period to export.');
        return;
      }

      exportPaymentsToExcel({
        payments: paymentList,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      toast.success(`Exported ${paymentList.length} payment records to Excel spreadsheet.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Excel export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-[85vh] py-6 px-2 sm:px-4 flex justify-center items-start">
      {/* Centered Main Card - Closely replicating Reference Screenshot */}
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Card Title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            NationLinks Dispatch
          </h1>
          <h2 className="text-lg font-semibold text-slate-700">
            Driver Payment
          </h2>
        </div>

        {/* Top Payment Form - Same layout & simplicity as Reference Screenshot */}
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {/* Driver Number Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Driver Number
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={driverNumberInput}
              onChange={(e) => setDriverNumberInput(e.target.value)}
              placeholder="Example: 45"
              disabled={isSubmittingPayment}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="Example: 125"
              disabled={isSubmittingPayment}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Solid Dark SUBMIT Button */}
          <button
            type="submit"
            disabled={isSubmittingPayment}
            className="w-full py-3 mt-2 bg-[#1e232a] hover:bg-black text-white font-bold text-sm tracking-wider uppercase rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
          >
            {isSubmittingPayment ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>SUBMIT</span>
            )}
          </button>
        </form>

        {/* Clean Controls Toolbar Directly Below Payment Form */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {/* Search Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Driver */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Driver Number..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          {/* Date Filter & Export Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* From & To Date Pickers */}
            <div className="flex items-center space-x-1.5 text-slate-600">
              <span className="font-medium text-slate-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />

              <span className="font-medium text-slate-500 ml-1">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />

              {(fromDate || toDate) && (
                <button
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                    setCurrentPage(1);
                  }}
                  className="text-slate-400 hover:text-slate-700 ml-1 underline"
                  title="Clear date filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold text-xs transition-colors disabled:opacity-50"
              title="Export statement as real Excel (.xlsx) file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* Driver Table - Matching columns: Driver # | Driver Name | Total | Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Sorting: <strong>Numeric Ascending (Driver #)</strong>
            </span>
            <span>
              Total drivers: <strong>{totalItems}</strong>
            </span>
          </div>

          <DriverTable
            drivers={drivers}
            isLoading={isLoading}
            loadError={loadError}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEditDriver={(driver) => {
              setEditingDriver(driver);
              setIsDriverModalOpen(true);
            }}
            onDeleteOrDeactivate={handleOpenDeleteOrDeactivate}
            onForceDelete={handleOpenForceDelete}
          />

          {/* Pagination */}
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

      {/* Driver Create/Edit Modal */}
      <DriverModal
        isOpen={isDriverModalOpen}
        driver={editingDriver}
        onClose={() => setIsDriverModalOpen(false)}
        onSuccess={(saved, msg) => {
          toast.success(msg);
          fetchDrivers();
        }}
      />

      {/* Delete / Deactivate / Reactivate Confirmation Modal */}
      {confirmTargetDriver && (
        <ConfirmationModal
          isOpen={!!confirmTargetDriver}
          title={
            confirmMode === 'forceDelete'
              ? `Permanently Delete Driver #${confirmTargetDriver.driverNumber}?`
              : confirmMode === 'delete'
              ? `Permanently Delete Driver #${confirmTargetDriver.driverNumber}?`
              : confirmMode === 'deactivate'
              ? `Deactivate Driver #${confirmTargetDriver.driverNumber}?`
              : `Reactivate Driver #${confirmTargetDriver.driverNumber}?`
          }
          message={
            confirmMode === 'forceDelete'
              ? (confirmTargetDriver.paymentCount || 0) > 0
                ? `This permanently deletes Driver #${confirmTargetDriver.driverNumber} AND all ${confirmTargetDriver.paymentCount} of their payment record(s), totalling ${formatCurrency(confirmTargetDriver.totalPaid || 0)}. The financial history will be gone and this cannot be undone. To keep the records instead, cancel and choose Deactivate.`
                : `Are you sure you want to permanently delete Driver #${confirmTargetDriver.driverNumber}? This cannot be undone.`
              : confirmMode === 'delete'
              ? `Are you sure you want to permanently delete Driver #${confirmTargetDriver.driverNumber}? This driver has zero payment history. This action cannot be undone.`
              : confirmMode === 'deactivate'
              ? `Driver #${confirmTargetDriver.driverNumber} has payment history and cannot be permanently deleted. Deactivating will preserve all financial statements and records while preventing future payments.`
              : `Are you sure you want to reactivate Driver #${confirmTargetDriver.driverNumber}? They will immediately be eligible to receive payments.`
          }
          confirmLabel={
            confirmMode === 'forceDelete'
              ? (confirmTargetDriver.paymentCount || 0) > 0
                ? 'Delete Driver & Payments'
                : 'Delete Driver'
              : confirmMode === 'delete'
              ? 'Delete Driver'
              : confirmMode === 'deactivate'
              ? 'Deactivate Driver'
              : 'Reactivate Driver'
          }
          isDestructive={confirmMode !== 'activate'}
          isLoading={isConfirmLoading}
          onConfirm={handleConfirmDriverAction}
          onCancel={() => setConfirmTargetDriver(null)}
        />
      )}
    </div>
  );
}
