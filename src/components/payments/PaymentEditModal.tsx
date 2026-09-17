'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, X, DollarSign, Calendar, FileText } from 'lucide-react';
import { Payment } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface PaymentEditModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
  onSuccess: (updatedPayment: Payment, message: string) => void;
}

export default function PaymentEditModal({
  isOpen,
  payment,
  onClose,
  onSuccess,
}: PaymentEditModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount.toFixed(2));
      setPaymentDate(payment.paymentDate ? payment.paymentDate.split('T')[0] : '');
      setNotes(payment.notes || '');
      setError(null);
    }
  }, [payment]);

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a valid number greater than $0.00');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          amount: parsedAmount,
          paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update payment');
      }

      onSuccess(data, `Payment updated from ${formatCurrency(payment.amount)} to ${formatCurrency(parsedAmount)}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Edit Payment #{payment.driverNumber ? `Driver #${payment.driverNumber}` : ''}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Original Amount: <span className="font-semibold text-slate-800">{formatCurrency(payment.amount)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Alert */}
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Financial correction: Editing this transaction will immediately recalculate driver totals, statement records, and Excel reports.
          </span>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Corrected Amount ($)
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Example: 120"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Payment Date
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
              Correction Notes / Reason
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Corrected cash receipt discrepancy"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Confirm Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
