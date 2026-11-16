import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeCurrencyCode,
  toMinorUnit,
  fromMinorUnit,
  getCurrencyDecimals,
} from '../utils/currency';

const CACHE_PREFIX = '@splitwiser:rates_v1:';
const LIVE_TTL_MS = 60 * 60 * 1000; // 1 hour for live cache
const MAX_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // up to 7 days for offline cached rates

export interface ExchangeRateResult {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  rateTimestamp: number; // Unix ms
  source: 'live' | 'cached' | 'offline';
  isStale: boolean;
}

export interface CurrencyConversionResult extends ExchangeRateResult {
  sourceAmount: number;
  sourceAmountMinor: number;
  targetAmount: number;
  targetAmountMinor: number;
}

interface CachedRatePayload {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

/**
 * Fetches exchange rates with the given base currency.
 * Tries live fetch from open.er-api.com, falls back to AsyncStorage cache.
 */
export async function getExchangeRates(
  baseCurrency: string
): Promise<{ rates: Record<string, number>; fetchedAt: number; source: 'live' | 'cached' | 'offline'; isStale: boolean }> {
  const base = normalizeCurrencyCode(baseCurrency);
  const cacheKey = `${CACHE_PREFIX}${base}`;

  // 1. Try reading cache first
  let cached: CachedRatePayload | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[exchangeRateService] Failed to read rate cache:', err);
  }

  const now = Date.now();
  const cacheAge = cached ? now - cached.fetchedAt : Infinity;

  // If cache is fresh (< 1 hour), return cached directly to save bandwidth
  if (cached && cacheAge < LIVE_TTL_MS) {
    return {
      rates: cached.rates,
      fetchedAt: cached.fetchedAt,
      source: 'cached',
      isStale: false,
    };
  }

  // 2. Fetch live rates
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.rates && typeof data.rates === 'object') {
        const payload: CachedRatePayload = {
          base,
          rates: data.rates,
          fetchedAt: now,
        };
        // Persist to AsyncStorage asynchronously
        AsyncStorage.setItem(cacheKey, JSON.stringify(payload)).catch(() => {});
        return {
          rates: data.rates,
          fetchedAt: now,
          source: 'live',
          isStale: false,
        };
      }
    }
  } catch (fetchErr) {
    // Network or timeout failure
    console.warn('[exchangeRateService] Live rate fetch failed, falling back to cache:', fetchErr);
  }

  // 3. Fallback to cached rates if available
  if (cached && cacheAge < MAX_STALE_TTL_MS) {
    return {
      rates: cached.rates,
      fetchedAt: cached.fetchedAt,
      source: 'offline',
      isStale: cacheAge > 24 * 60 * 60 * 1000,
    };
  }

  // 4. Fallback: if base is target or hardcoded common pairs when totally offline and no cache
  throw new Error(
    `Exchange rate for ${base} is unavailable. Please check your internet connection.`
  );
}

/**
 * Gets the direct exchange rate from source to target currency.
 */
export async function getExchangeRate(
  sourceCurrency: string,
  targetCurrency: string
): Promise<ExchangeRateResult> {
  const from = normalizeCurrencyCode(sourceCurrency);
  const to = normalizeCurrencyCode(targetCurrency);

  if (from === to) {
    return {
      baseCurrency: from,
      targetCurrency: to,
      rate: 1.0,
      rateTimestamp: Date.now(),
      source: 'live',
      isStale: false,
    };
  }

  const { rates, fetchedAt, source, isStale } = await getExchangeRates(from);
  const rate = rates[to];

  if (!rate || typeof rate !== 'number' || rate <= 0) {
    throw new Error(`Exchange rate from ${from} to ${to} was not found.`);
  }

  return {
    baseCurrency: from,
    targetCurrency: to,
    rate,
    rateTimestamp: fetchedAt,
    source,
    isStale,
  };
}

/**
 * Converts an amount from source currency to target currency using integer minor units.
 */
export async function convertCurrencyAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): Promise<CurrencyConversionResult> {
  const from = normalizeCurrencyCode(sourceCurrency);
  const to = normalizeCurrencyCode(targetCurrency);

  const rateInfo = await getExchangeRate(from, to);
  const sourceAmountMinor = toMinorUnit(amount, from);

  // Direct calculation with safe rounding to target currency decimals
  const targetDecimals = getCurrencyDecimals(to);
  const targetFactor = Math.pow(10, targetDecimals);

  // Convert using the exact float amount * rate
  const rawTargetAmount = (Number(amount) || 0) * rateInfo.rate;
  const targetAmountMinor = Math.round(rawTargetAmount * targetFactor);
  const targetAmount = fromMinorUnit(targetAmountMinor, to);

  return {
    ...rateInfo,
    sourceAmount: amount,
    sourceAmountMinor,
    targetAmount,
    targetAmountMinor,
  };
}

