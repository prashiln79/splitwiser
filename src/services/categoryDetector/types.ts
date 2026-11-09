export type ExpenseCategory =
  | 'Food'
  | 'Coffee'
  | 'Drinks'
  | 'Transport'
  | 'Fuel'
  | 'Travel'
  | 'Groceries'
  | 'Shopping'
  | 'Entertainment'
  | 'Subscriptions'
  | 'Gaming'
  | 'Utilities'
  | 'Rent'
  | 'Health'
  | 'Fitness'
  | 'PersonalCare'
  | 'Education'
  | 'Pets'
  | 'Tech'
  | 'Party'
  | 'Gift'
  | 'Services'
  | 'General';

export type DetectionSource =
  | 'manual'
  | 'category_tag'
  | 'learned_preference'
  | 'merchant'
  | 'phrase'
  | 'keyword'
  | 'multilingual'
  | 'fallback';

export interface CategoryDetectionResult {
  category: ExpenseCategory;
  confidence: number; // Range 0.0 - 1.0
  source: DetectionSource;
  matchedText?: string;
  alternatives?: ExpenseCategory[];
  requiresConfirmation: boolean;
  explanation?: string;
}

export interface CategoryRule {
  category: ExpenseCategory;
  priority: number; // Higher number evaluated first (e.g., 90 for phrases, 50 for keywords)
  weight: number; // Confidence score (0.0 - 1.0)
  phrases?: string[]; // Multi-word phrases
  keywords?: string[]; // Single-word tokens requiring word boundaries
  excludePhrases?: string[]; // Exclusions (if description matches, this rule is skipped)
  compiledRegex?: RegExp;
}

export interface MerchantContextOverride {
  matchPatterns: string[]; // Patterns in text to trigger override
  category: ExpenseCategory;
  confidence: number;
}

export interface MerchantRule {
  brand: string;
  aliases: string[]; // Normalized variations, e.g. ["starbucks", "starbucks coffee"]
  defaultCategory: ExpenseCategory;
  confidence: number;
  contextOverrides?: MerchantContextOverride[];
}

export interface DetectionOptions {
  manualCategory?: ExpenseCategory | null;
  merchantName?: string;
  locale?: string;
  userId?: string;
  allowLearnedPreferences?: boolean;
}

