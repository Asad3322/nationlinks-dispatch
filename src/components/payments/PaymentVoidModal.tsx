'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Payment } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface PaymentVoidModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
  onSuccess: (voidedPayment: Payment, message: string) => void;
}

export default function PaymentVoidModal({
  isOpen,
  payment,
  onClose,
  onSuccess,
}: PaymentVoidModalProps) {
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !payment) return null;

  const handleVoid = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'void',
          reason: reason.trim() || 'Voided by Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to void payment');
      }

      onSuccess(
        data,
        `Payment of ${formatCurrency(payment.amount)} for Driver #${payment.driverNumber || ''} has been voided.`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while voiding payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">Void Payment Confirmation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 font-medium leading-relaxed">
            Are you sure you want to void this{' '}
            <strong className="text-slate-900 font-bold">{formatCurrency(payment.amount)}</strong> payment for{' '}
            <strong className="text-slate-900 font-bold">Driver #{payment.driverNumber || payment.driverId}</strong>
            ?
          </p>

          <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
            This transaction will remain permanently logged in database records marked as <strong>Voided</strong>, but
            will be immediately removed from active driver statements and period totals.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Reason for Voiding (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry, incorrect amount, refund"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVoid}
              disabled={isLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Voiding...' : 'Void Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
