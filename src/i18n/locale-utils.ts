import { DEFAULT_LOCALE, SUPPORTED_LOCALES, SupportedLocale } from './locales';

/**
 * Normalizes an arbitrary locale or language tag into one of our supported app locales.
 * Handles language subtag matching, script tags (e.g. zh-Hans vs zh-CN), and legacy tags.
 */
export function normalizeLocale(localeString?: string | null): SupportedLocale | null {
  if (!localeString || typeof localeString !== 'string') {
    return null;
  }

  const clean = localeString.trim().replace(/_/g, '-');
  const lower = clean.toLowerCase();

  // Direct match
  const directMatch = SUPPORTED_LOCALES.find(
    (loc) => loc.toLowerCase() === lower
  );
  if (directMatch) return directMatch;

  // Specific dialect/script mappings
  if (lower.startsWith('zh')) {
    // Simplified Chinese dialects: zh-Hans, zh-CN, zh-SG
    if (lower.includes('hant') || lower.includes('tw') || lower.includes('hk')) {
      // Traditional Chinese falls back to en or zh-Hans based on preference; standard fallback: zh-Hans
      return 'zh-Hans';
    }
    return 'zh-Hans';
  }

  if (lower.startsWith('pt')) {
    // Default Portuguese to pt-BR
    return 'pt-BR';
  }

  if (lower.startsWith('id') || lower.startsWith('in')) {
    // 'in' is legacy ISO 639-1 code for Indonesian
    return 'id';
  }

  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('ar')) return 'ar';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('ru')) return 'ru';
  if (lower.startsWith('en')) return 'en';

  return null;
}

/**
 * Detects the best supported locale from an ordered list of device preferred locales.
 */
export function detectBestLocale(preferredLocales?: (string | null | undefined)[]): SupportedLocale {
  if (preferredLocales && Array.isArray(preferredLocales)) {
    for (const loc of preferredLocales) {
      if (loc) {
        const normalized = normalizeLocale(loc);
        if (normalized) {
          return normalized;
        }
      }
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Formats a localized currency amount safely without throwing.
 */
export function formatLocalizedAmount(
  amount: number,
  currencyCode: string = 'USD',
  locale: string = 'en'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback if Intl.NumberFormat throws or currency code is non-standard
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats a date using localized Intl.DateTimeFormat.
 */
export function formatLocalizedDate(
  date: Date | number,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof date === 'number' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
  } catch {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString();
  }
}

/**
 * Formats a number with localized decimal and grouping separators.
 */
export function formatLocalizedNumber(
  value: number,
  locale: string = 'en',
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

