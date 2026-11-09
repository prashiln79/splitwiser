import * as fs from 'fs';
import * as path from 'path';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  NAMESPACES,
  RTL_LOCALES,
  isRtlLocale,
  LOCALE_DISPLAY_NAMES,
  LOCALE_NATIVE_NAMES,
} from '../src/i18n/locales';
import {
  normalizeLocale,
  detectBestLocale,
  formatLocalizedAmount,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '../src/i18n/locale-utils';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string, details?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, details || '');
    failedCount++;
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${msg}`);
    passedCount++;
  }
}

console.log('--- STARTING INTERNATIONALIZATION (i18n) TEST SUITE ---');

// ─────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION & LOCALE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────
assert(SUPPORTED_LOCALES.length === 8, '8 supported locales registered');
assert(DEFAULT_LOCALE === 'en', 'English is default fallback locale');
assert(NAMESPACES.length === 15, '15 namespaces defined');
assert(RTL_LOCALES.includes('ar'), 'Arabic (ar) is registered as RTL');
assert(!isRtlLocale('en') && isRtlLocale('ar'), 'isRtlLocale correctly distinguishes LTR vs RTL');

SUPPORTED_LOCALES.forEach((loc) => {
  assert(!!LOCALE_DISPLAY_NAMES[loc], `Display name defined for locale "${loc}"`);
  assert(!!LOCALE_NATIVE_NAMES[loc], `Native script name defined for locale "${loc}"`);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. TRANSLATION FILE SYSTEM & 100% KEY PARITY AUDIT
// ─────────────────────────────────────────────────────────────────────────
const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const enDir = path.join(localesDir, 'en');

const namespaceKeyCounts: Record<string, number> = {};
let totalKeysPerLocale = 0;

function extractKeys(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, extractKeys(v, fullKey));
    } else if (typeof v === 'string') {
      result[fullKey] = v;
    }
  }
  return result;
}

function extractPlaceholders(str: string): string[] {
  const matches = str.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  return matches ? matches.map((m) => m.slice(2, -2).trim()).sort() : [];
}

// Read and verify English source dictionary
const enDictionaries: Record<string, Record<string, string>> = {};

NAMESPACES.forEach((ns) => {
  const filePath = path.join(enDir, `${ns}.json`);
  assert(fs.existsSync(filePath), `English namespace file exists: ${ns}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const flatKeys = extractKeys(content);
  const keyCount = Object.keys(flatKeys).length;
  assert(keyCount > 0, `English namespace "${ns}" has non-empty keys (found ${keyCount})`);
  enDictionaries[ns] = flatKeys;
  namespaceKeyCounts[ns] = keyCount;
  totalKeysPerLocale += keyCount;
});

console.log(`\nVerified English base keys: ${totalKeysPerLocale} total keys across 15 namespaces.`);

// Audit all 7 target locales against English
SUPPORTED_LOCALES.forEach((locale) => {
  if (locale === 'en') return;

  const targetDir = path.join(localesDir, locale);
  assert(fs.existsSync(targetDir), `Locale directory exists for "${locale}"`);

  NAMESPACES.forEach((ns) => {
    const filePath = path.join(targetDir, `${ns}.json`);
    assert(fs.existsSync(filePath), `[${locale}] Namespace file exists: ${ns}.json`);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flatKeys = extractKeys(content);
    const enKeys = enDictionaries[ns];

    // Check for missing keys
    for (const [key, enVal] of Object.entries(enKeys)) {
      // In Arabic or Russian, plural forms may have suffix variants
      const targetVal = flatKeys[key];
      assert(
        targetVal !== undefined && targetVal !== '',
        `[${locale}][${ns}] Key "${key}" exists and is not empty`
      );

      // Verify interpolation variables match
      const enPlaceholders = extractPlaceholders(enVal);
      if (enPlaceholders.length > 0 && targetVal) {
        const targetPlaceholders = extractPlaceholders(targetVal);
        const missing = enPlaceholders.filter((p) => !targetPlaceholders.includes(p));
        assert(
          missing.length === 0,
          `[${locale}][${ns}] Placeholders in "${key}" match English (expected [${enPlaceholders.join(', ')}], found [${targetPlaceholders.join(', ')}])`
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. LOCALE NORMALIZATION & DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────
assert(normalizeLocale('en') === 'en', 'Normalizes exact "en"');
assert(normalizeLocale('en-US') === 'en', 'Normalizes "en-US" to "en"');
assert(normalizeLocale('en_GB') === 'en', 'Normalizes "en_GB" to "en"');
assert(normalizeLocale('zh') === 'zh-Hans', 'Normalizes "zh" to "zh-Hans"');
assert(normalizeLocale('zh-CN') === 'zh-Hans', 'Normalizes "zh-CN" to "zh-Hans"');
assert(normalizeLocale('zh-SG') === 'zh-Hans', 'Normalizes "zh-SG" to "zh-Hans"');
assert(normalizeLocale('es-ES') === 'es', 'Normalizes "es-ES" to "es"');
assert(normalizeLocale('es-419') === 'es', 'Normalizes "es-419" to "es"');
assert(normalizeLocale('ar-SA') === 'ar', 'Normalizes "ar-SA" to "ar"');
assert(normalizeLocale('ar-EG') === 'ar', 'Normalizes "ar-EG" to "ar"');
assert(normalizeLocale('fr-FR') === 'fr', 'Normalizes "fr-FR" to "fr"');
assert(normalizeLocale('fr-CA') === 'fr', 'Normalizes "fr-CA" to "fr"');
assert(normalizeLocale('pt') === 'pt-BR', 'Normalizes "pt" to "pt-BR"');
assert(normalizeLocale('pt-BR') === 'pt-BR', 'Normalizes "pt-BR" to "pt-BR"');
assert(normalizeLocale('id-ID') === 'id', 'Normalizes "id-ID" to "id"');
assert(normalizeLocale('in-ID') === 'id', 'Normalizes legacy Android "in-ID" to "id"');
assert(normalizeLocale('ru-RU') === 'ru', 'Normalizes "ru-RU" to "ru"');
assert(normalizeLocale('de-DE') === null, 'Unsupported locale returns null');
assert(normalizeLocale(null) === null, 'null input returns null safely');
assert(normalizeLocale('') === null, 'empty input returns null safely');

assert(
  detectBestLocale(['de-DE', 'fr-FR', 'en-US']) === 'fr',
  'detectBestLocale selects first matching supported candidate'
);
assert(
  detectBestLocale(['ja-JP', 'ko-KR']) === 'en',
  'detectBestLocale falls back to en when no candidates match'
);

// ─────────────────────────────────────────────────────────────────────────
// 4. LOCALE-AWARE FORMATTING TESTS
// ─────────────────────────────────────────────────────────────────────────
const formattedUsd = formatLocalizedAmount(1234.5, 'USD', 'en');
assert(formattedUsd.includes('1,234.5') || formattedUsd.includes('$'), 'Formats USD for English');

const formattedDate = formatLocalizedDate(new Date('2026-11-09T12:00:00Z'), 'en');
assert(typeof formattedDate === 'string' && formattedDate.length > 0, 'formatLocalizedDate returns non-empty string');

const formattedNumber = formatLocalizedNumber(1000000, 'en');
assert(typeof formattedNumber === 'string' && formattedNumber.length > 0, 'formatLocalizedNumber returns valid string');

// ─────────────────────────────────────────────────────────────────────────
// 5. TRANSLATION COVERAGE REPORT
// ─────────────────────────────────────────────────────────────────────────
console.log('\n========================================================================');
console.log('                 TRANSLATION COVERAGE REPORT');
console.log('========================================================================');
console.log('| Namespace       | Keys  | en  | zh-Hans | es  | ar  | fr  | pt-BR | id  | ru  |');
console.log('|-----------------|-------|-----|---------|-----|-----|-----|-------|-----|-----|');

NAMESPACES.forEach((ns) => {
  const count = namespaceKeyCounts[ns];
  console.log(
    `| ${ns.padEnd(15)} | ${String(count).padStart(5)} | 100%|  100%   | 100%| 100%| 100%| 100%  | 100%| 100%|`
  );
});

console.log('------------------------------------------------------------------------');
console.log(`TOTAL UNIQUE KEYS: ${totalKeysPerLocale} per language`);
console.log(`TOTAL STRINGS ACROSS 8 LANGUAGES: ${totalKeysPerLocale * 8}`);
console.log('COVERAGE: 100.0% across all 8 supported languages');
console.log('========================================================================\n');

console.log(`TOTAL TESTS RUN: ${passedCount}`);
console.log(`PASSED: ${passedCount}`);
console.log(`FAILED: ${failedCount}`);
console.log('--- ALL INTERNATIONALIZATION TESTS PASSED ---');

