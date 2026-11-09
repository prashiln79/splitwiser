/**
 * Application-wide limits, boundary conditions, and validation thresholds.
 * Researched and configured according to platform constraints, SQLite/Firestore
 * document limits, and product financial specifications.
 */

export const APP_LIMITS = {
  // ─── Financial & Expense Limits ─────────────────────────────────────────────
  EXPENSE: {
    /** Minimum valid expense amount in major currency units */
    MIN_AMOUNT: 0.01,
    /** Maximum valid expense amount (1 Billion). Well within Number.MAX_SAFE_INTEGER cents */
    MAX_AMOUNT: 1_000_000_000,
    /** Maximum length for expense description/title (Splitwise standard is 255) */
    MAX_DESCRIPTION_LENGTH: 255,
    /** Minimum length for expense description */
    MIN_DESCRIPTION_LENGTH: 1,
    /** Maximum length for optional expense notes */
    MAX_NOTES_LENGTH: 1000,
    /** Maximum number of tags allowed per expense */
    MAX_TAGS_COUNT: 20,
    /** Maximum length for an individual tag */
    MAX_TAG_LENGTH: 60,
    /** Maximum allowed receipt image file size before compression (10 MB) */
    MAX_RECEIPT_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    /** Furthest allowed expense date in the past (10 years) */
    MAX_PAST_YEARS: 10,
    /** Furthest allowed expense date in the future (1 year) */
    MAX_FUTURE_YEARS: 1,
  },

  // ─── Split & Calculation Limits ─────────────────────────────────────────────
  SPLIT: {
    /** Maximum number of shares an individual can be assigned (prevents overflow) */
    MAX_SHARES_PER_PERSON: 100_000,
    /** Maximum number of line items on an itemized receipt bill */
    MAX_ITEMIZED_ITEMS: 100,
    /** Maximum length for an itemized line item title */
    MAX_ITEM_TITLE_LENGTH: 100,
    /** Maximum percentage tolerance difference for 100% sum */
    PERCENTAGE_TOLERANCE: 0.05,
  },

  // ─── Group & Community Limits ───────────────────────────────────────────────
  GROUP: {
    /** Minimum length for group name */
    MIN_NAME_LENGTH: 1,
    /** Maximum length for group name (matches modal constraints) */
    MAX_NAME_LENGTH: 50,
    /** Maximum length for group description */
    MAX_DESCRIPTION_LENGTH: 500,
    /** Maximum number of members in a single group */
    MAX_MEMBERS_PER_GROUP: 1000,
    /** Standard join code character length */
    JOIN_CODE_LENGTH: 6,
    /** Maximum group cover photo file size before compression (10 MB) */
    MAX_COVER_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  },

  // ─── User Profile Limits ───────────────────────────────────────────────────
  USER: {
    /** Minimum length for user display name */
    MIN_NAME_LENGTH: 1,
    /** Maximum length for user display name */
    MAX_NAME_LENGTH: 70,
    /** Maximum length for email address */
    MAX_EMAIL_LENGTH: 254,
    /** Maximum length for phone number string */
    MAX_PHONE_LENGTH: 25,
    /** Maximum length for search query input */
    MAX_SEARCH_QUERY_LENGTH: 100,
    /** Maximum avatar upload file size before compression (5 MB) */
    MAX_AVATAR_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  },

  // ─── Export Limits ─────────────────────────────────────────────────────────
  EXPORT: {
    /** Maximum number of expenses exported in a single batch to avoid mobile memory pressure */
    MAX_EXPORT_ROWS: 5000,
  },
} as const;

