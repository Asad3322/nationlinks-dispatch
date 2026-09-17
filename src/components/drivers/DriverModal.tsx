'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';
import { Driver } from '@/lib/types';

interface DriverModalProps {
  isOpen: boolean;
  driver?: Driver | null; // If provided, edit mode; otherwise add mode
  onClose: () => void;
  onSuccess: (driver: Driver, message: string) => void;
}

export default function DriverModal({
  isOpen,
  driver,
  onClose,
  onSuccess,
}: DriverModalProps) {
  const [driverNumber, setDriverNumber] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isEdit = !!driver;

  useEffect(() => {
    if (driver) {
      setDriverNumber(String(driver.driverNumber));
      setDriverName(driver.driverName);
      setStatus(driver.status);
    } else {
      setDriverNumber('');
      setDriverName('');
      setStatus('active');
    }
    setError(null);
  }, [driver, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseInt(driverNumber.trim(), 10);
    if (isNaN(num) || num <= 0) {
      setError('Driver Number must be a positive integer (e.g. 45).');
      return;
    }

    if (!driverName.trim()) {
      setError('Driver Name cannot be empty.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && driver) {
        // Edit driver
        const res = await fetch(`/api/drivers/${driver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverNumber: num,
            driverName: driverName.trim(),
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update driver');
        onSuccess(data, `Driver #${data.driverNumber} updated successfully.`);
      } else {
        // Add new driver
        const res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverNumber: num,
            driverName: driverName.trim(),
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add driver');
        onSuccess(data, `Driver #${data.driverNumber} added successfully.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            {isEdit ? <Save className="w-5 h-5 text-emerald-400" /> : <UserPlus className="w-5 h-5 text-emerald-400" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isEdit ? `Edit Driver #${driver?.driverNumber}` : 'Add New Driver'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEdit ? 'Update driver details and status' : 'Register a new driver into NationLinks Dispatch'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Driver Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={driverNumber}
              onChange={(e) => setDriverNumber(e.target.value)}
              placeholder="e.g. 45"
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-400">Must be unique across all drivers.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Driver Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. John Smith"
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
              )}
              <span>{isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Driver'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
