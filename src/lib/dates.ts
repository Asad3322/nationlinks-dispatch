/**
 * Date and timezone utilities for consistent business day handling.
 * Avoids UTC boundary drift when parsing and displaying dates.
 */

// Format ISO string to readable date "Sep 16, 2026"
export function formatDisplayDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '—';
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format ISO string to date and time "Sep 16, 2026, 02:45 PM"
export function formatDisplayDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '—';
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date to HTML input value "YYYY-MM-DD"
export function toInputDateFormat(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse "YYYY-MM-DD" string into local start-of-day Date
export function parseStartDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Parse "YYYY-MM-DD" string into local end-of-day Date (23:59:59.999)
export function parseEndDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

// Check if a date falls on today (local day)
export function isToday(dateInput: string | Date): boolean {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}
