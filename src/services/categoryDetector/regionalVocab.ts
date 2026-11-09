import { ExpenseCategory } from './types';
import { containsPhrase, containsWord } from './normalizer';

export interface RegionalPhraseRule {
  phrase: string;
  category: ExpenseCategory;
  confidence: number;
}

export const INDIAN_VOCAB_RULES: RegionalPhraseRule[] = [
  // ── Groceries ──
  { phrase: 'kirana', category: 'Groceries', confidence: 0.95 },
  { phrase: 'kirana store', category: 'Groceries', confidence: 0.98 },
  { phrase: 'sabji', category: 'Groceries', confidence: 0.95 },
  { phrase: 'sabzi', category: 'Groceries', confidence: 0.95 },
  { phrase: 'sabji mandi', category: 'Groceries', confidence: 0.98 },
  { phrase: 'doodh', category: 'Groceries', confidence: 0.95 },
  { phrase: 'dahi', category: 'Groceries', confidence: 0.95 },
  { phrase: 'atta', category: 'Groceries', confidence: 0.95 },
  { phrase: 'chawal', category: 'Groceries', confidence: 0.95 },
  { phrase: 'daal', category: 'Groceries', confidence: 0.95 },
  { phrase: 'dal', category: 'Groceries', confidence: 0.9 },
  { phrase: 'ration', category: 'Groceries', confidence: 0.95 },
  { phrase: 'rashan', category: 'Groceries', confidence: 0.95 },
  { phrase: 'masala', category: 'Groceries', confidence: 0.9 },
  { phrase: 'paneer', category: 'Groceries', confidence: 0.9 },
  { phrase: 'ghee', category: 'Groceries', confidence: 0.95 },

  // ── Food & Dining ──
  { phrase: 'tiffin', category: 'Food', confidence: 0.95 },
  { phrase: 'tiffin service', category: 'Food', confidence: 0.98 },
  { phrase: 'nashta', category: 'Food', confidence: 0.95 },
  { phrase: 'nasta', category: 'Food', confidence: 0.95 },
  { phrase: 'khana', category: 'Food', confidence: 0.9 },
  { phrase: 'biryani', category: 'Food', confidence: 0.98 },
  { phrase: 'chai', category: 'Coffee', confidence: 0.95 },
  { phrase: 'tea and snacks', category: 'Coffee', confidence: 0.95 },
  { phrase: 'samosa', category: 'Food', confidence: 0.95 },
  { phrase: 'thali', category: 'Food', confidence: 0.95 },
  { phrase: 'dosa', category: 'Food', confidence: 0.95 },
  { phrase: 'paratha', category: 'Food', confidence: 0.95 },
  { phrase: 'pav bhaji', category: 'Food', confidence: 0.98 },
  { phrase: 'mithai', category: 'Food', confidence: 0.95 },
  { phrase: 'dhaba', category: 'Food', confidence: 0.98 },

  // ── Utilities & Bills ──
  { phrase: 'bijli bill', category: 'Utilities', confidence: 0.98 },
  { phrase: 'bijli', category: 'Utilities', confidence: 0.95 },
  { phrase: 'paani bill', category: 'Utilities', confidence: 0.98 },
  { phrase: 'pani bill', category: 'Utilities', confidence: 0.98 },
  { phrase: 'gas cylinder', category: 'Utilities', confidence: 0.98 },
  { phrase: 'cylinder booking', category: 'Utilities', confidence: 0.98 },
  { phrase: 'mobile recharge', category: 'Utilities', confidence: 0.98 },
  { phrase: 'dth recharge', category: 'Utilities', confidence: 0.98 },
  { phrase: 'wifi bill', category: 'Utilities', confidence: 0.98 },
  { phrase: 'broadband bill', category: 'Utilities', confidence: 0.98 },

  // ── Transport ──
  { phrase: 'auto rickshaw', category: 'Transport', confidence: 0.98 },
  { phrase: 'autorickshaw', category: 'Transport', confidence: 0.98 },
  { phrase: 'rickshaw', category: 'Transport', confidence: 0.95 },
  { phrase: 'auto fare', category: 'Transport', confidence: 0.98 },
  { phrase: 'bus ticket', category: 'Transport', confidence: 0.98 },
  { phrase: 'train ticket', category: 'Transport', confidence: 0.98 },
  { phrase: 'local train', category: 'Transport', confidence: 0.98 },
  { phrase: 'metro card', category: 'Transport', confidence: 0.98 },
  { phrase: 'metro recharge', category: 'Transport', confidence: 0.98 },
  { phrase: 'petrol pump', category: 'Fuel', confidence: 0.98 },
  { phrase: 'cng pump', category: 'Fuel', confidence: 0.98 },
  { phrase: 'cng filling', category: 'Fuel', confidence: 0.98 },

  // ── Health ──
  { phrase: 'dawai', category: 'Health', confidence: 0.98 },
  { phrase: 'dawa', category: 'Health', confidence: 0.95 },
  { phrase: 'medical store', category: 'Health', confidence: 0.98 },
  { phrase: 'chemist', category: 'Health', confidence: 0.95 },
  { phrase: 'chemist shop', category: 'Health', confidence: 0.98 },
  { phrase: 'doctor fees', category: 'Health', confidence: 0.98 },
  { phrase: 'dr fees', category: 'Health', confidence: 0.98 },

  // ── Rent ──
  { phrase: 'pg rent', category: 'Rent', confidence: 0.98 },
  { phrase: 'ghar bhada', category: 'Rent', confidence: 0.98 },
  { phrase: 'kamra bhada', category: 'Rent', confidence: 0.98 },
  { phrase: 'room rent', category: 'Rent', confidence: 0.98 },
  { phrase: 'flat rent', category: 'Rent', confidence: 0.98 },
];

/**
 * Match regional Indian vocabulary.
 */
export function matchRegionalIndianVocab(
  normalizedText: string
): { category: ExpenseCategory; confidence: number; matchedPhrase: string } | null {
  for (const rule of INDIAN_VOCAB_RULES) {
    if (
      rule.phrase.indexOf(' ') !== -1
        ? containsPhrase(normalizedText, rule.phrase)
        : containsWord(normalizedText, rule.phrase)
    ) {
      return {
        category: rule.category,
        confidence: rule.confidence,
        matchedPhrase: rule.phrase,
      };
    }
  }
  return null;
}

