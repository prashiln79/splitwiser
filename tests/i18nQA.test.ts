import * as fs from 'fs';
import * as path from 'path';
import i18n from 'i18next';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  NAMESPACES,
  isRtlLocale,
  LOCALE_DISPLAY_NAMES,
  LOCALE_NATIVE_NAMES,
  SupportedLocale,
} from '../src/i18n/locales';
import {
  normalizeLocale,
  detectBestLocale,
  formatLocalizedAmount,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '../src/i18n/locale-utils';
import { getCurrencySymbol, normalizeCurrencyCode } from '../src/utils/currency';
import { resources } from '../src/i18n/resources';
import { i18nConfig } from '../src/i18n/config';

// Initialize i18next instance for dynamic testing
if (!i18n.isInitialized) {
  i18n.init({
    ...i18nConfig,
    lng: DEFAULT_LOCALE,
  });
}

let totalTests = 0;
let passedCount = 0;
let failedCount = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, details !== undefined ? details : '');
    failedCount++;
    failures.push(`${testName}${details ? ': ' + JSON.stringify(details) : ''}`);
  }
}

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

const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const languages = ['en', 'zh-Hans', 'es', 'ar', 'fr', 'pt-BR', 'id', 'ru'] as const;

// Read all dictionaries into memory
const allDictionaries: Record<string, Record<string, Record<string, string>>> = {};
for (const lang of languages) {
  allDictionaries[lang] = {};
  for (const ns of NAMESPACES) {
    const filePath = path.join(localesDir, lang, `${ns}.json`);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      allDictionaries[lang][ns] = extractKeys(content);
    } else {
      allDictionaries[lang][ns] = {};
    }
  }
}

console.log('========================================================================');
console.log('       SPLITWISER INTERNATIONALIZATION (i18n) QA TEST SUITE');
console.log('========================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. ALL 8 LANGUAGES HAVE IDENTICAL KEY COUNT (NO MISSING BASELINE KEYS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: Identical Key Count & Baseline Key Parity ---');
const enKeysByNs: Record<string, string[]> = {};
let totalEnKeys = 0;
for (const ns of NAMESPACES) {
  const keys = Object.keys(allDictionaries['en'][ns] || {});
  enKeysByNs[ns] = keys;
  totalEnKeys += keys.length;
}
assert(totalEnKeys === 463, `English baseline has expected 463 keys (found ${totalEnKeys})`);

for (const lang of languages) {
  let langTotal = 0;
  for (const ns of NAMESPACES) {
    langTotal += Object.keys(allDictionaries[lang][ns] || {}).length;
  }
  // Base keys are 463; ar has 4 extra plural keys (467), ru has 2 extra plural keys (465)
  if (lang === 'ar') {
    assert(langTotal === 467, `Arabic has 467 keys (463 base + 4 CLDR plural forms _zero, _two, _few, _many)`);
  } else if (lang === 'ru') {
    assert(langTotal === 465, `Russian has 465 keys (463 base + 2 CLDR plural forms _few, _many)`);
  } else {
    assert(langTotal === 463, `${lang} has exactly 463 keys matching English baseline`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NO EMPTY STRING VALUES FOR ANY TRANSLATION KEY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 2: No Empty String Values ---');
for (const lang of languages) {
  let emptyCount = 0;
  const emptyKeys: string[] = [];
  for (const ns of NAMESPACES) {
    const dict = allDictionaries[lang][ns] || {};
    for (const [k, v] of Object.entries(dict)) {
      if (typeof v !== 'string' || v.trim().length === 0) {
        emptyCount++;
        emptyKeys.push(`${ns}.${k}`);
      }
    }
  }
  assert(emptyCount === 0, `No empty string values found in locale "${lang}"`, emptyKeys);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ALL CURRENCY CODES ARE VALID (USD, EUR, INR, GBP, etc.)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 3: Currency Codes Validity ---');
const standardCurrencies = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'BRL', 'CNY'];
for (const curr of standardCurrencies) {
  const normalized = normalizeCurrencyCode(curr);
  assert(normalized === curr, `Currency code ${curr} normalizes to valid ISO code ${curr}`);
}
assert(normalizeCurrencyCode('$') === 'USD', `Symbol '$' normalizes to 'USD'`);
assert(normalizeCurrencyCode('€') === 'EUR', `Symbol '€' normalizes to 'EUR'`);
assert(normalizeCurrencyCode('£') === 'GBP', `Symbol '£' normalizes to 'GBP'`);
assert(normalizeCurrencyCode('₹') === 'INR', `Symbol '₹' normalizes to 'INR'`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. CURRENCY SYMBOL MAPPING CORRECT FOR EACH LOCALE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 4: Currency Symbol Mapping ---');
assert(getCurrencySymbol('USD') === '$', `getCurrencySymbol('USD') returns '$'`);
assert(getCurrencySymbol('EUR') === '€', `getCurrencySymbol('EUR') returns '€'`);
assert(getCurrencySymbol('GBP') === '£', `getCurrencySymbol('GBP') returns '£'`);
assert(getCurrencySymbol('INR') === '₹', `getCurrencySymbol('INR') returns '₹'`);
assert(getCurrencySymbol('BRL') === 'R$', `getCurrencySymbol('BRL') returns 'R$'`);
assert(getCurrencySymbol('JPY') === '¥', `getCurrencySymbol('JPY') returns '¥'`);
assert(getCurrencySymbol('CAD') === 'C$', `getCurrencySymbol('CAD') returns 'C$'`);

// Verify formatLocalizedAmount produces correct symbols across locales
const usdInEn = formatLocalizedAmount(100, 'USD', 'en');
assert(usdInEn.includes('$'), `formatLocalizedAmount in en contains '$': ${usdInEn}`);
const inrInEn = formatLocalizedAmount(100, 'INR', 'en');
assert(inrInEn.includes('₹'), `formatLocalizedAmount in en contains '₹': ${inrInEn}`);
const eurInFr = formatLocalizedAmount(100, 'EUR', 'fr');
assert(eurInFr.includes('€'), `formatLocalizedAmount in fr contains '€': ${eurInFr}`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. NUMBER FORMATTING — 1234567.89 FORMATTED CORRECTLY PER LOCALE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 5: Number Formatting per Locale ---');
const testNum = 1234567.89;
const enNum = formatLocalizedNumber(testNum, 'en');
assert(enNum.includes('1,234,567.89'), `en formatted number uses commas and dot: ${enNum}`);

const esNum = formatLocalizedNumber(testNum, 'es');
assert(esNum.includes('1.234.567,89'), `es formatted number uses dots and comma: ${esNum}`);

const frNum = formatLocalizedNumber(testNum, 'fr');
// French uses narrow no-break space or standard space
assert(frNum.includes('234') && frNum.includes(',89'), `fr formatted number uses comma decimal separator: ${frNum}`);

const ptNum = formatLocalizedNumber(testNum, 'pt-BR');
assert(ptNum.includes('1.234.567,89'), `pt-BR formatted number uses dots and comma: ${ptNum}`);

const idNum = formatLocalizedNumber(testNum, 'id');
assert(idNum.includes('1.234.567,89'), `id formatted number uses dots and comma: ${idNum}`);

for (const lang of languages) {
  const formatted = formatLocalizedNumber(testNum, lang);
  assert(typeof formatted === 'string' && formatted.length > 0, `${lang} formatted number returns valid string: ${formatted}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DATE FORMATTING — TODAY'S DATE FORMATTED CORRECTLY PER LOCALE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 6: Date Formatting per Locale ---');
const today = new Date();
for (const lang of languages) {
  const formattedDate = formatLocalizedDate(today, lang);
  assert(
    typeof formattedDate === 'string' && formattedDate.length > 3,
    `${lang} formats today's date properly: ${formattedDate}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RUSSIAN PLURAL RULES — 1 item, 2 items, 5 items
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 7: Russian Plural Rules ---');
const ruPluralRules = new Intl.PluralRules('ru');
assert(ruPluralRules.select(1) === 'one', `Intl.PluralRules('ru') selects 'one' for 1`);
assert(ruPluralRules.select(2) === 'few', `Intl.PluralRules('ru') selects 'few' for 2`);
assert(ruPluralRules.select(5) === 'many', `Intl.PluralRules('ru') selects 'many' for 5`);
assert(ruPluralRules.select(21) === 'one', `Intl.PluralRules('ru') selects 'one' for 21`);
assert(ruPluralRules.select(22) === 'few', `Intl.PluralRules('ru') selects 'few' for 22`);
assert(ruPluralRules.select(25) === 'many', `Intl.PluralRules('ru') selects 'many' for 25`);

// Verify through i18next
const ruCount1 = i18n.t('groups:memberCount', { lng: 'ru', count: 1 });
const ruCount2 = i18n.t('groups:memberCount', { lng: 'ru', count: 2 });
const ruCount5 = i18n.t('groups:memberCount', { lng: 'ru', count: 5 });
assert(ruCount1.includes('1') && ruCount1.includes('участник') && !ruCount1.includes('участника'), `Russian 1 item resolves correctly: "${ruCount1}"`);
assert(ruCount2.includes('2') && ruCount2.includes('участника'), `Russian 2 items resolves correctly (few form): "${ruCount2}"`);
assert(ruCount5.includes('5') && ruCount5.includes('участников'), `Russian 5 items resolves correctly (many form): "${ruCount5}"`);

// ─────────────────────────────────────────────────────────────────────────────
// 8. ARABIC RTL LOCALE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 8: Arabic RTL Locale Detection ---');
assert(isRtlLocale('ar') === true, `isRtlLocale('ar') === true`);
assert(isRtlLocale('en') === false, `isRtlLocale('en') === false`);
assert(isRtlLocale('fr') === false, `isRtlLocale('fr') === false`);
assert(isRtlLocale('es') === false, `isRtlLocale('es') === false`);
assert(isRtlLocale('zh-Hans') === false, `isRtlLocale('zh-Hans') === false`);
assert(isRtlLocale('ru') === false, `isRtlLocale('ru') === false`);

// ─────────────────────────────────────────────────────────────────────────────
// 9. LOCALE DETECTION FALLS BACK TO ENGLISH WHEN DEVICE LOCALE IS UNKNOWN
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 9: Locale Detection Fallback ---');
assert(detectBestLocale(['xx-YY']) === 'en', `detectBestLocale with unknown locale 'xx-YY' falls back to 'en'`);
assert(detectBestLocale(['zz-Latn-ZZ']) === 'en', `detectBestLocale with unrecognized tag falls back to 'en'`);
assert(detectBestLocale([]) === 'en', `detectBestLocale with empty array falls back to 'en'`);
assert(detectBestLocale(undefined) === 'en', `detectBestLocale with undefined falls back to 'en'`);
assert(normalizeLocale('unsupported-LOCALE') === null, `normalizeLocale with invalid locale returns null`);

// Normalization mappings
assert(normalizeLocale('zh-CN') === 'zh-Hans', `normalizeLocale('zh-CN') returns 'zh-Hans'`);
assert(normalizeLocale('pt-PT') === 'pt-BR', `normalizeLocale('pt-PT') returns 'pt-BR'`);
assert(normalizeLocale('in-ID') === 'id', `normalizeLocale('in-ID') returns 'id'`);

// ─────────────────────────────────────────────────────────────────────────────
// 10. ALL 8 LOCALES HAVE TRANSLATION FOR EVERY KEY IN ENGLISH BASELINE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 10: Complete Coverage of English Baseline ---');
for (const lang of languages) {
  if (lang === 'en') continue;
  let missingBaselineCount = 0;
  const missingKeys: string[] = [];

  for (const ns of NAMESPACES) {
    const enDict = allDictionaries['en'][ns] || {};
    const targetDict = allDictionaries[lang][ns] || {};

    for (const key of Object.keys(enDict)) {
      if (targetDict[key] === undefined || targetDict[key] === null) {
        missingBaselineCount++;
        missingKeys.push(`${ns}.${key}`);
      }
    }
  }

  assert(
    missingBaselineCount === 0,
    `Locale "${lang}" has 100% of English baseline keys (0 missing)`,
    missingKeys
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. NO TRANSLATION VALUE IS IDENTICALLY UNTRANSLATED IN ARABIC
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 11: Arabic Untranslated String Verification ---');
const allowedEnglishInArabic = new Set(['common:appName', 'settlements:upi']);
let unexpectedEnglishInArabic = 0;
const untranslatedKeys: { key: string; value: string }[] = [];

for (const ns of NAMESPACES) {
  const enDict = allDictionaries['en'][ns] || {};
  const arDict = allDictionaries['ar'][ns] || {};

  for (const [key, arVal] of Object.entries(arDict)) {
    const fullKey = `${ns}:${key}`;
    const enVal = enDict[key];
    if (enVal && arVal.trim() === enVal.trim() && !allowedEnglishInArabic.has(fullKey)) {
      unexpectedEnglishInArabic++;
      untranslatedKeys.push({ key: fullKey, value: arVal });
    }
  }
}

assert(
  unexpectedEnglishInArabic === 0,
  `No untranslated English strings found in Arabic (excluding brand 'Splitwiser' and acronym 'UPI')`,
  untranslatedKeys
);

// ─────────────────────────────────────────────────────────────────────────────
// 12. DYNAMIC INTERPOLATION WORKS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 12: Dynamic Interpolation ---');
// Test 1: Name substitution
const interpEnName = i18n.t('friends:addExpenseWithFriend', { lng: 'en', name: 'Alice' });
assert(interpEnName === 'Add expense with Alice', `Interpolates {{name}} in English: "${interpEnName}"`);

const interpEsName = i18n.t('friends:addExpenseWithFriend', { lng: 'es', name: 'Carlos' });
assert(interpEsName === 'Añadir gasto con Carlos', `Interpolates {{name}} in Spanish: "${interpEsName}"`);

const interpArName = i18n.t('friends:addExpenseWithFriend', { lng: 'ar', name: 'أحمد' });
assert(interpArName === 'إضافة مصروف مع أحمد', `Interpolates {{name}} in Arabic: "${interpArName}"`);

const interpRuName = i18n.t('friends:addExpenseWithFriend', { lng: 'ru', name: 'Иван' });
assert(interpRuName === 'Добавить расход с Иван', `Interpolates {{name}} in Russian: "${interpRuName}"`);

// Test 2: Amount / count substitution
const interpValidation = i18n.t('validation:nameTooLong', { lng: 'en', max: 50 });
assert(interpValidation.includes('50'), `Interpolates numeric variable {{max}}: "${interpValidation}"`);

const interpAllocated = i18n.t('split:allocatedOf', { lng: 'zh-Hans', allocated: '¥100', total: '¥200' });
assert(
  interpAllocated.includes('¥100') && interpAllocated.includes('¥200'),
  `Interpolates multiple variables in Simplified Chinese: "${interpAllocated}"`
);

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY & REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n========================================================================');
console.log('                          TEST RUN SUMMARY');
console.log('========================================================================');
console.log(`TOTAL CHECKS: ${totalTests}`);
console.log(`PASSED:       ${passedCount}`);
console.log(`FAILED:       ${failedCount}`);
if (failedCount > 0) {
  console.log('FAILURES:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('STATUS:       ALL INTERNATIONALIZATION TESTS PASSED PERFECTLY!');
  console.log('========================================================================\n');
}
