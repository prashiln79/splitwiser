import { APP_LIMITS } from '../constants/limits';
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_MAP,
  getCurrencyInfo,
  CurrencyInfo,
} from './currencyData';

export { SUPPORTED_CURRENCIES, CURRENCY_MAP, getCurrencyInfo, CurrencyInfo };

const DEFAULT_CURRENCY = '₹';

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
  return getCurrencyInfo(code).symbol;
}

/**
 * Returns the English name for a currency.
 */
export function getCurrencyName(currency?: string): string {
  const code = normalizeCurrencyCode(currency || globalDefaultCurrency);
  return getCurrencyInfo(code).name;
}

/**
 * Returns the number of minor-unit decimal places for a currency.
 * Most currencies use 2 (cents/paise), while JPY/KRW/VND/IDR/CLP use 0, and KWD/BHD/OMR/JOD use 3.
 */
export function getCurrencyDecimals(currency?: string): number {
  const code = normalizeCurrencyCode(currency || globalDefaultCurrency);
  return getCurrencyInfo(code).decimals;
}

/**
 * Converts a major unit float amount to an integer minor unit (e.g. 10.50 USD -> 1050 cents, 100 JPY -> 100 yen, 1.250 KWD -> 1250 fils)
 */
export function toMinorUnit(amount: number, currency?: string): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return Math.round((Number(amount) || 0) * factor);
}

/**
 * Converts an integer minor unit to a major unit float.
 */
export function fromMinorUnit(minor: number, currency?: string): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return (Number(minor) || 0) / factor;
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
      if (decimals === 0) {
        return {
          isValid: false,
          errorMessage: `${currency} does not support decimal fractions.`,
        };
      }
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
