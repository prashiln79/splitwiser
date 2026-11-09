import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from './types';
import { normalizeText } from './normalizer';

const STORAGE_PREFIX = '@splitwiser_user_merchant_prefs_';

// In-memory cache for fast, synchronous category detection
const memoryCache: Record<string, Record<string, ExpenseCategory>> = {};

function getStorageKey(userId: string = 'global'): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * Preloads learned preferences into memory for instant synchronous lookups.
 */
export async function loadLearnedCache(userId: string = 'global'): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (raw) {
      memoryCache[userId] = JSON.parse(raw);
    } else {
      memoryCache[userId] = {};
    }
  } catch (err) {
    memoryCache[userId] = {};
  }
}

/**
 * Synchronous lookup from in-memory cache.
 */
export function getCachedLearnedCategory(
  term: string,
  userId: string = 'global'
): ExpenseCategory | null {
  const norm = normalizeText(term);
  if (!norm) return null;
  const userMap = memoryCache[userId] || memoryCache['global'];
  return userMap?.[norm] || null;
}

/**
 * Get learned category for a term or merchant asynchronously.
 */
export async function getLearnedCategory(
  term: string,
  userId: string = 'global'
): Promise<ExpenseCategory | null> {
  const norm = normalizeText(term);
  if (!norm) return null;

  if (memoryCache[userId]?.[norm]) {
    return memoryCache[userId][norm];
  }

  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const map = JSON.parse(raw);
    memoryCache[userId] = map;
    return map[norm] || null;
  } catch {
    return null;
  }
}

/**
 * Save user custom correction for a merchant or phrase.
 */
export async function saveLearnedCategory(
  term: string,
  category: ExpenseCategory,
  userId: string = 'global'
): Promise<void> {
  const norm = normalizeText(term);
  if (!norm) return;

  if (!memoryCache[userId]) {
    memoryCache[userId] = {};
  }
  memoryCache[userId][norm] = category;

  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    const map = raw ? JSON.parse(raw) : {};
    map[norm] = category;
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(map));
  } catch (err) {
    console.warn('[categoryDetector] Failed to persist learned preference:', err);
  }
}

/**
 * Remove a user custom correction.
 */
export async function removeLearnedCategory(
  term: string,
  userId: string = 'global'
): Promise<void> {
  const norm = normalizeText(term);
  if (!norm) return;

  if (memoryCache[userId]) {
    delete memoryCache[userId][norm];
  }

  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (raw) {
      const map = JSON.parse(raw);
      delete map[norm];
      await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(map));
    }
  } catch (err) {
    console.warn('[categoryDetector] Failed to remove learned preference:', err);
  }
}

/**
 * Fetch all learned preferences for a user.
 */
export async function getAllLearnedCategories(
  userId: string = 'global'
): Promise<Record<string, ExpenseCategory>> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

