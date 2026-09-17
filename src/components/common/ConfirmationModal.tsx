'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center space-x-2 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-slate-900 hover:bg-black'
            }`}
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
            )}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
