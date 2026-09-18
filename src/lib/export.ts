import * as XLSX from 'xlsx';
import { Payment } from './types';
import { formatCurrency } from './currency';
import { formatDisplayDate } from './dates';

interface ExportPaymentsOptions {
  payments: Payment[];
  fromDate?: string;
  toDate?: string;
  driverNumber?: number;
}

/**
 * Generates and triggers download of a real Excel (.xlsx) statement spreadsheet
 */
export function exportPaymentsToExcel(options: ExportPaymentsOptions): void {
  const { payments, fromDate, toDate, driverNumber } = options;

  // Filter out voided payments for total calculation, but include records with status clearly labeled
  const activePayments = payments.filter((p) => p.status === 'active');
  const totalCents = activePayments.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  const totalDollars = totalCents / 100;

  // Date range labels
  const dateRangeLabel = fromDate && toDate
    ? `From: ${fromDate}   To: ${toDate}`
    : fromDate
    ? `From: ${fromDate} onwards`
    : toDate
    ? `Up to: ${toDate}`
    : 'Period: All Historical Records';

  // Header Title
  const title = driverNumber
    ? `NationLinks Dispatch - Driver #${driverNumber} Statement`
    : 'NationLinks Dispatch - Payment Statement';

  const rows: any[][] = [
    ['NationLinks Dispatch'],
    [title],
    [dateRangeLabel],
    ['Generated at: ' + new Date().toLocaleString()],
    [], // Blank line
    ['Driver #', 'Payment Date', 'Amount ($)', 'Status'],
  ];

  // Data rows
  payments.forEach((p) => {
    rows.push([
      p.driverNumber ?? 'N/A',
      formatDisplayDate(p.paymentDate),
      Number(p.amount).toFixed(2),
      p.status === 'active' ? 'Active' : 'Voided',
    ]);
  });

  // Summary row
  rows.push([]);
  rows.push([
    'Total Active Payments',
    '',
    `$${totalDollars.toFixed(2)}`,
    `(${activePayments.length} active payments)`,
  ]);

  // Create Worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Auto-fit column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Driver #
    { wch: 22 }, // Payment Date
    { wch: 16 }, // Amount
    { wch: 14 }, // Status
  ];

  // Create Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments Statement');

  // Determine Filename
  const dateSuffix = fromDate && toDate
    ? `${fromDate}_to_${toDate}`
    : fromDate
    ? `from_${fromDate}`
    : toDate
    ? `to_${toDate}`
    : new Date().toISOString().split('T')[0];

  const filename = driverNumber
    ? `NationLinks_Dispatch_Driver_${driverNumber}_Statement_${dateSuffix}.xlsx`
    : `NationLinks_Dispatch_Payments_${dateSuffix}.xlsx`;

  // Write and download
  XLSX.writeFile(workbook, filename);
}
