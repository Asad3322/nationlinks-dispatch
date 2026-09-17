/**
 * Safe currency handling utilities using integer cents to prevent
 * floating-point arithmetic errors in financial calculations.
 */

// Convert dollar amount (e.g. 125.50 or "125.50") to integer cents (12550)
export function toCents(amount: number | string): number {
  if (typeof amount === 'number') {
    if (isNaN(amount)) return 0;
    return Math.round(amount * 100);
  }
  
  const clean = String(amount).trim().replace(/[$,]/g, '');
  if (!clean) return 0;
  
  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const parts = unsigned.split('.');
  const dollars = parseInt(parts[0] || '0', 10);
  const centsStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const cents = parseInt(centsStr || '0', 10);
  
  const totalCents = dollars * 100 + cents;
  return isNegative ? -totalCents : totalCents;
}

// Convert cents back to standard dollar float (for database Decimal representation)
export function centsToDollars(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

// Format dollar or cent amount to readable USD string "$125.00"
export function formatCurrency(amount: number | string, fromCents: boolean = false): string {
  const cents = fromCents ? Math.round(Number(amount)) : toCents(amount);
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  
  const formattedDollars = dollars.toLocaleString('en-US');
  const formattedCents = remainder.toString().padStart(2, '0');
  
  return `${isNegative ? '-' : ''}$${formattedDollars}.${formattedCents}`;
}

// Sum an array of amounts safely using integer cents
export function sumAmounts(amounts: (number | string)[]): number {
  const totalCents = amounts.reduce<number>((sum, val) => sum + toCents(val), 0);
  return centsToDollars(totalCents);
}

// Validate monetary input string (must be positive number with max 2 decimal places)
export function isValidMoneyAmount(value: string | number): { valid: boolean; error?: string; cents?: number } {
  const cents = toCents(value);
  if (isNaN(cents)) {
    return { valid: false, error: 'Please enter a valid monetary amount' };
  }
  if (cents <= 0) {
    return { valid: false, error: 'Amount must be greater than $0.00' };
  }
  if (cents > 100000000) { // $1,000,000 limit per transaction
    return { valid: false, error: 'Amount exceeds maximum allowed limit' };
  }
  return { valid: true, cents };
}
