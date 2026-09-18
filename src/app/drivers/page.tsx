'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, ShieldAlert } from 'lucide-react';
import { Driver, DriverStatus } from '@/lib/types';
import DriverSearchBar from '@/components/drivers/DriverSearchBar';
import DriverTable from '@/components/drivers/DriverTable';
import DriverModal from '@/components/drivers/DriverModal';
import Pagination from '@/components/common/Pagination';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'driverNumber' | 'driverName' | 'totalPaid' | 'lastPaymentDate'>('driverNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Ascending default!
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals state
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [statusModalDriver, setStatusModalDriver] = useState<Driver | null>(null);
  const [isStatusActionLoading, setIsStatusActionLoading] = useState<boolean>(false);

  // Fetch drivers from API
  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/drivers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load drivers');

      const data = await res.json();
      setDrivers(data.data || []);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error loading drivers');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Handle Sort Toggle
  const handleSort = (column: 'driverNumber' | 'driverName' | 'totalPaid' | 'lastPaymentDate') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Reset page on search or filter change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status?: DriverStatus) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Edit Driver Handler
  const handleOpenEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setIsDriverModalOpen(true);
  };

  const handleDriverSaved = (savedDriver: Driver, message: string) => {
    toast.success(message);
    fetchDrivers();
  };

  // Delete / Deactivate / Reactivate Driver Handlers
  const [confirmTargetDriver, setConfirmTargetDriver] = useState<Driver | null>(null);
  const [confirmMode, setConfirmMode] = useState<'delete' | 'deactivate' | 'activate' | 'forceDelete'>('deactivate');
  const [isConfirmLoading, setIsConfirmLoading] = useState<boolean>(false);

  const handleOpenDeleteOrDeactivate = (driver: Driver) => {
    setConfirmTargetDriver(driver);
    const hasPayments = (driver.paymentCount || 0) > 0;

    if (driver.status === 'inactive') {
      setConfirmMode('activate');
    } else if (hasPayments) {
      setConfirmMode('deactivate');
    } else {
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
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete driver');
        toast.success(data.message || `Driver #${confirmTargetDriver.driverNumber} permanently deleted.`);
      } else if (confirmMode === 'deactivate') {
        const res = await fetch(`/api/drivers/${confirmTargetDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'inactive' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to deactivate driver');
        toast.success(`Driver #${confirmTargetDriver.driverNumber} has been deactivated.`);
      } else if (confirmMode === 'activate') {
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-900" /> Driver Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage dispatch drivers, view statements, update statuses, and monitor accounts.
          </p>
        </div>
      </div>

      {/* Driver Search and Filter Controls */}
      <DriverSearchBar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        totalDriversCount={totalItems}
      />

      {/* Driver Table with Numeric Ascending Default Sort */}
      <DriverTable
        drivers={drivers}
        isLoading={isLoading}
        sortBy={sortBy as any}
        sortOrder={sortOrder}
        onSort={(col) => handleSort(col as any)}
        onEditDriver={handleOpenEditModal}
        onDeleteOrDeactivate={handleOpenDeleteOrDeactivate}
        onForceDelete={handleOpenForceDelete}
      />

      {/* Pagination Controls */}
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

      {/* Edit Driver Modal */}
      <DriverModal
        isOpen={isDriverModalOpen}
        driver={editingDriver}
        onClose={() => setIsDriverModalOpen(false)}
        onSuccess={handleDriverSaved}
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
