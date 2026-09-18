'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Driver, Payment } from '@/lib/types';

interface DriverModalProps {
  isOpen: boolean;
  driver?: Driver | null;
  onClose: () => void;
  onSuccess: (driver: Driver, message: string) => void;
}

/**
 * Edit modal for an existing driver row.
 * Mirrors the quick-payment form: Driver Number and Amount, nothing else.
 * Amount edits the driver's most recent active payment, which is loaded when
 * the modal opens. Drivers are created by submitting a payment, so this modal
 * has no "add" mode.
 */
export default function DriverModal({
  isOpen,
  driver,
  onClose,
  onSuccess,
}: DriverModalProps) {
  const [driverNumber, setDriverNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !driver) return;

    setDriverNumber(String(driver.driverNumber));
    setError(null);
    setAmount('');
    setLatestPayment(null);

    // Load the driver's most recent active payment so Amount has something to edit.
    let cancelled = false;
    const loadLatestPayment = async () => {
      setIsLoadingPayment(true);
      try {
        const res = await fetch(`/api/payments?driverId=${driver.id}&status=active&limit=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load the latest payment');
        if (cancelled) return;
        const payment: Payment | undefined = data.data?.[0];
        if (payment) {
          setLatestPayment(payment);
          setAmount(String(payment.amount));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load the latest payment.');
      } finally {
        if (!cancelled) setIsLoadingPayment(false);
      }
    };

    loadLatestPayment();
    return () => {
      cancelled = true;
    };
  }, [driver, isOpen]);

  if (!isOpen || !driver) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseInt(driverNumber.trim(), 10);
    if (isNaN(num) || num <= 0) {
      setError('Driver Number must be a positive integer (e.g. 45).');
      return;
    }

    const numberChanged = num !== driver.driverNumber;
    let parsedAmount: number | null = null;

    if (latestPayment) {
      parsedAmount = parseFloat(amount.trim());
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Amount must be greater than $0.00.');
        return;
      }
    }

    const amountChanged = !!latestPayment && parsedAmount !== latestPayment.amount;

    if (!numberChanged && !amountChanged) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      let updatedDriver: Driver | null = null;

      if (numberChanged) {
        const res = await fetch(`/api/drivers/${driver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverNumber: num }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update driver');
        updatedDriver = data;
      }

      if (amountChanged && latestPayment) {
        const res = await fetch(`/api/payments/${latestPayment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', amount: parsedAmount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update payment');
      }

      const parts: string[] = [];
      if (numberChanged) parts.push(`number changed to #${num}`);
      if (amountChanged) parts.push(`amount updated to $${(parsedAmount as number).toFixed(2)}`);

      onSuccess(
        updatedDriver ?? { ...driver, driverNumber: num },
        `Driver #${num}: ${parts.join(' and ')}.`
      );
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
            <Save className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Driver #{driver.driverNumber}</h3>
            <p className="text-xs text-slate-500">Update the driver number or the latest payment amount</p>
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
              placeholder="Example: 45"
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-400">Must be unique across all drivers.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Example: 125"
              disabled={isSubmitting || isLoadingPayment || !latestPayment}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-hidden transition-all disabled:bg-slate-50 disabled:text-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {isLoadingPayment
                ? 'Loading latest payment...'
                : latestPayment
                  ? `Edits the most recent payment, recorded ${new Date(latestPayment.paymentDate).toLocaleDateString()}. Earlier payments are editable on the Payments page.`
                  : 'No payments recorded yet for this driver.'}
            </p>
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
              disabled={isSubmitting || isLoadingPayment}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
              )}
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
