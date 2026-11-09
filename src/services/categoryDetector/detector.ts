import {
  ExpenseCategory,
  CategoryDetectionResult,
  DetectionOptions,
} from './types';
import { normalizeText } from './normalizer';
import { matchMerchant } from './merchants';
import { matchRegionalIndianVocab } from './regionalVocab';
import { matchCategoryRules } from './rules';
import { matchMultilingual } from './multilingual';
import { getCachedLearnedCategory } from './learnedPreferences';

// Canonical list of all 23 valid categories
export const VALID_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Coffee',
  'Drinks',
  'Transport',
  'Fuel',
  'Travel',
  'Groceries',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Gaming',
  'Utilities',
  'Rent',
  'Health',
  'Fitness',
  'PersonalCare',
  'Education',
  'Pets',
  'Tech',
  'Party',
  'Gift',
  'Services',
  'General',
];

const VALID_CATEGORIES_LOWER = new Map<string, ExpenseCategory>(
  VALID_CATEGORIES.map((cat) => [cat.toLowerCase(), cat])
);

/**
 * Detailed category detection engine with 7-tier deterministic priority,
 * confidence scoring, and match explanations.
 */
export function detectCategoryDetailed(
  description: string = '',
  tags?: string[],
  options?: DetectionOptions
): CategoryDetectionResult {
  // 1. Explicit Category manually picked by user (Highest Priority)
  if (options?.manualCategory && VALID_CATEGORIES.includes(options.manualCategory)) {
    return {
      category: options.manualCategory,
      confidence: 1.0,
      source: 'manual',
      matchedText: 'User selection',
      requiresConfirmation: false,
      explanation: 'Manually selected by user',
    };
  }

  // 2. Explicit category metadata or valid category tag
  if (tags && Array.isArray(tags) && tags.length > 0) {
    for (const tag of tags) {
      if (typeof tag !== 'string') continue;
      const cleanTag = tag.trim();
      // Skip non-category metadata tags (e.g., note:..., receipt:..., payer:...)
      if (
        cleanTag.startsWith('note:') ||
        cleanTag.startsWith('receipt:') ||
        cleanTag.startsWith('payer:')
      ) {
        continue;
      }

      // Check case-insensitively
      const matchedCategory = VALID_CATEGORIES_LOWER.get(cleanTag.toLowerCase());
      if (matchedCategory) {
        return {
          category: matchedCategory,
          confidence: 0.99,
          source: 'category_tag',
          matchedText: cleanTag,
          requiresConfirmation: false,
          explanation: `Explicitly tagged as "${cleanTag}"`,
        };
      }
    }
  }

  const rawDescription = (description || '').trim();
  const normalizedDescription = normalizeText(rawDescription);

  if (!normalizedDescription) {
    return {
      category: 'General',
      confidence: 0.0,
      source: 'fallback',
      requiresConfirmation: false,
      explanation: 'Empty description',
    };
  }

  // 3. User Learned Preference
  if (options?.allowLearnedPreferences !== false) {
    const learned = getCachedLearnedCategory(
      options?.merchantName || normalizedDescription,
      options?.userId
    );
    if (learned && VALID_CATEGORIES.includes(learned)) {
      return {
        category: learned,
        confidence: 0.96,
        source: 'learned_preference',
        matchedText: options?.merchantName || normalizedDescription,
        requiresConfirmation: false,
        explanation: 'User learned category preference',
      };
    }
  }

  // 4. Recognized Merchant (with brand context disambiguation)
  const textToScan = options?.merchantName
    ? `${normalizeText(options.merchantName)} ${normalizedDescription}`
    : normalizedDescription;

  const merchantMatch = matchMerchant(textToScan);
  if (merchantMatch) {
    return {
      category: merchantMatch.category,
      confidence: merchantMatch.confidence,
      source: 'merchant',
      matchedText: merchantMatch.matchedAlias,
      requiresConfirmation: merchantMatch.confidence < 0.75,
      explanation: `Merchant detected: ${merchantMatch.matchedAlias}`,
    };
  }

  // 5. Regional Vocabulary (e.g. Indian Expense Vocab)
  const regionalMatch = matchRegionalIndianVocab(normalizedDescription);
  if (regionalMatch) {
    return {
      category: regionalMatch.category,
      confidence: regionalMatch.confidence,
      source: 'phrase',
      matchedText: regionalMatch.matchedPhrase,
      requiresConfirmation: regionalMatch.confidence < 0.75,
      explanation: `Regional keyword: "${regionalMatch.matchedPhrase}"`,
    };
  }

  // 6. Specific Multi-word Phrases & Single-word Keywords (with exclusions)
  const ruleMatch = matchCategoryRules(normalizedDescription);
  if (ruleMatch) {
    return {
      category: ruleMatch.category,
      confidence: ruleMatch.confidence,
      source: ruleMatch.matchedTerm.includes(' ') ? 'phrase' : 'keyword',
      matchedText: ruleMatch.matchedTerm,
      requiresConfirmation: ruleMatch.confidence < 0.75,
      explanation: `Matched rule: "${ruleMatch.matchedTerm}"`,
    };
  }

  // 7. Multilingual Dictionaries (Spanish, Portuguese, French, Mandarin, Arabic, Indonesian, Japanese)
  const multiMatch = matchMultilingual(rawDescription, normalizedDescription);
  if (multiMatch) {
    return {
      category: multiMatch.category,
      confidence: multiMatch.confidence,
      source: 'multilingual',
      matchedText: multiMatch.matchedTerm,
      requiresConfirmation: false,
      explanation: `Multilingual term (${multiMatch.lang}): "${multiMatch.matchedTerm}"`,
    };
  }

  // 8. General Fallback
  return {
    category: 'General',
    confidence: 0.2,
    source: 'fallback',
    requiresConfirmation: false,
    explanation: 'No specific category matches found',
  };
}

/**
 * Standard category detection function for backward-compatibility.
 * Returns valid ExpenseCategory.
 */
export function detectCategory(description: string = '', tags?: string[]): ExpenseCategory {
  return detectCategoryDetailed(description, tags).category;
}

