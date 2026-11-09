/**
 * Text Normalization Service for Expense Category Detection
 * Handles Unicode NFKC normalization, diacritics removal for Latin scripts,
 * preserved non-Latin scripts (Arabic, CJK, Devanagari), apostrophes, punctuation,
 * common abbreviations and word tokenization.
 */

const ABBREVIATION_MAP: Record<string, string> = {
  'wi-fi': 'wifi',
  'wi fi': 'wifi',
  'h&m': 'h&m',
  'h & m': 'h&m',
  'p.g.': 'pg',
  'p.g': 'pg',
  'd.t.h': 'dth',
  'dth': 'dth',
  'o.t.t': 'ott',
  'dr.': 'doctor',
  'dr': 'doctor',
  'mcd': 'mcdonalds',
  'mcdonald\'s': 'mcdonalds',
  'domino\'s': 'dominos',
};

/**
 * Normalizes an input string:
 * 1. Unicode NFKC normalization
 * 2. Lowercasing
 * 3. Normalizes smart quotes and hyphens
 * 4. Strips diacritics from Latin characters (café -> cafe, almoço -> almoco) while preserving non-Latin scripts
 * 5. Replaces known abbreviations
 * 6. Collapses redundant whitespace
 */
export function normalizeText(input: string | undefined | null): string {
  if (!input) return '';

  // 1. Unicode NFKC normalization
  let text = String(input).normalize('NFKC');

  // 2. Lowercase
  text = text.toLowerCase();

  // 3. Normalize quotes and hyphens
  text = text
    .replace(/[‘’`´]/g, "'")
    .replace(/[–—−]/g, '-');

  // 4. Strip diacritics from Latin characters (leaving non-Latin characters intact)
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 5. Expand / normalize known abbreviations
  for (const [abbr, repl] of Object.entries(ABBREVIATION_MAP)) {
    if (text.includes(abbr)) {
      text = text.split(abbr).join(repl);
    }
  }

  // 6. Clean up excessive punctuation while preserving letters, numbers, spaces, and essential symbols
  // Note: we preserve Unicode letters (\p{L}), numbers (\p{N}), spaces, and ampersands
  text = text
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Tokenize normalized text into clean word tokens.
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  // Split on whitespace or non-word boundaries
  return normalized
    .split(/[\s,./\\_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Checks whether a word exists as a discrete token within normalized text.
 * Prevents substring false-positives (e.g. "eat" matching inside "theatre" or "weather").
 */
export function containsWord(normalizedText: string, word: string): boolean {
  if (!normalizedText || !word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use Unicode word boundaries
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u');
  return regex.test(normalizedText);
}

/**
 * Checks whether an exact multi-word phrase exists in normalized text.
 */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  if (!normalizedText || !phrase) return false;
  const cleanPhrase = normalizeText(phrase);
  const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u');
  return regex.test(normalizedText);
}

