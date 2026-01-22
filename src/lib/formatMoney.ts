/**
 * Safe money formatting utilities that never return NaN
 * All functions handle null, undefined, and invalid values gracefully
 */

export interface FormatMoneyOptions {
  compact?: boolean;
  showSign?: boolean;
}

/**
 * Safely converts a value to cents integer, defaulting to 0 for invalid values
 */
export function safeCents(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

/**
 * Formats cents to a dollar string (e.g., 1234 -> "$12.34")
 * Never returns NaN - defaults to "$0.00" for invalid inputs
 */
export function formatMoney(
  cents: number | null | undefined,
  options: FormatMoneyOptions = {}
): string {
  const { compact = false, showSign = false } = options;
  
  const safeCentsValue = safeCents(cents);
  const dollars = safeCentsValue / 100;
  
  if (compact && Math.abs(dollars) >= 1000) {
    const k = dollars / 1000;
    const formatted = k.toFixed(1).replace(/\.0$/, '') + 'k';
    const sign = showSign && dollars > 0 ? '+' : '';
    return `${sign}$${formatted}`;
  }
  
  const sign = showSign && dollars > 0 ? '+' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}

/**
 * Alias for formatMoney - safe cents formatting
 */
export function formatCentsSafe(
  cents: number | null | undefined,
  options: FormatMoneyOptions = {}
): string {
  return formatMoney(cents, options);
}

/**
 * Alias for formatMoney with compact option
 */
export function formatCentsCompactSafe(cents: number | null | undefined): string {
  return formatMoney(cents, { compact: true });
}

/**
 * Safely sums an array of cents values, treating null/undefined as 0
 */
export function sumCents(values: (number | null | undefined)[]): number {
  return values.reduce<number>((sum, val) => sum + safeCents(val), 0);
}

/**
 * Converts dollars to cents safely
 */
export function dollarsToCentsSafe(dollars: number | null | undefined): number {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) {
    return 0;
  }
  return Math.round(dollars * 100);
}

/**
 * Converts cents to dollars safely
 */
export function centsToDollarsSafe(cents: number | null | undefined): number {
  return safeCents(cents) / 100;
}
