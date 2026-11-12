import { APP_LIMITS } from '../constants/limits';

const DEFAULT_CURRENCY = '₹';

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
  KRW: '₩',
  AED: 'AED ',
  SAR: 'SAR ',
  CHF: 'CHF ',
  CNY: '¥',
  BRL: 'R$',
  MXN: 'Mex$',
};

const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
};

let globalDefaultCurrency = 'INR';

/**
 * Sets the active global default currency for the application.
 */
export function setDefaultCurrency(currency?: string | null): void {
  if (currency && typeof currency === 'string') {
    globalDefaultCurrency = normalizeCurrencyCode(currency);
  }
}

/**
 * Gets the active global default currency code.
 */
export function getDefaultCurrency(): string {
  return globalDefaultCurrency;
}

/**
 * Normalizes any currency input (symbol or code) to an ISO code (e.g. '₹' -> 'INR', '$' -> 'USD').
 */
export function normalizeCurrencyCode(currency?: string | null): string {
  if (!currency) return globalDefaultCurrency || 'INR';
  const trimmed = currency.trim();
  if (trimmed === '₹') return 'INR';
  if (trimmed === '$') return 'USD';
  if (trimmed === '€') return 'EUR';
  if (trimmed === '£') return 'GBP';
  return trimmed.toUpperCase();
}

/**
 * Returns the standard symbol or code prefix for a currency.
 */
export function getCurrencySymbol(currency?: string): string {
  const code = normalizeCurrencyCode(currency || globalDefaultCurrency);
  return CURRENCY_SYMBOLS[code] ?? code;
}

/**
 * Returns the number of minor-unit decimal places for a currency.
 * Most currencies use 2 (cents/paise), while JPY/KRW use 0, and KWD/BHD use 3.
 */
export function getCurrencyDecimals(currency?: string): number {
  const code = normalizeCurrencyCode(currency || globalDefaultCurrency);
  return CURRENCY_DECIMALS[code] ?? 2;
}

/**
 * Validates whether a given numeric amount is finite, safe, and within business limits.
 */
export function isValidFinancialAmount(
  amount: any,
  currency = 'INR'
): { isValid: boolean; errorMessage?: string } {
  if (amount === undefined || amount === null || amount === '') {
    return { isValid: false, errorMessage: 'Amount cannot be empty.' };
  }
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, errorMessage: 'Please enter a valid numeric amount.' };
  }
  if (num <= 0) {
    return { isValid: false, errorMessage: 'Amount must be greater than zero.' };
  }
  if (num > APP_LIMITS.EXPENSE.MAX_AMOUNT) {
    const symbol = getCurrencySymbol(currency);
    return {
      isValid: false,
      errorMessage: `Amount exceeds maximum allowed limit (${symbol}${APP_LIMITS.EXPENSE.MAX_AMOUNT.toLocaleString()}).`,
    };
  }

  // Check decimal precision according to currency
  const decimals = getCurrencyDecimals(currency);
  const str = String(amount);
  if (str.includes('.')) {
    const decimalPart = str.split('.')[1] || '';
    if (decimalPart.length > decimals) {
      return {
        isValid: false,
        errorMessage: `${currency} supports at most ${decimals} decimal place${decimals === 1 ? '' : 's'}.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Checks whether an integer minor units value (cents) is within safe JS bounds.
 */
export function isSafeMinorUnit(cents: number): boolean {
  return Number.isSafeInteger(cents) && Math.abs(cents) <= Number.MAX_SAFE_INTEGER;
}

/**
 * Formats a monetary amount into a clean currency string.
 * Preserves the exact currency decimal precision and handles NaN/infinite edge cases safely.
 */
export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency ? normalizeCurrencyCode(currency) : globalDefaultCurrency;
  const symbol = getCurrencySymbol(curr);
  const decimals = getCurrencyDecimals(curr);
  if (isNaN(amount) || !isFinite(amount)) {
    return `${symbol}${(0).toFixed(decimals)}`;
  }
  return `${symbol}${Math.abs(amount).toFixed(decimals)}`;
}
