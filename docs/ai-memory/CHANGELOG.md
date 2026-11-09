# Changelog: Splitwiser

All notable changes are documented in this file. Changes are listed in reverse chronological order. This changelog reflects verified source code history.

---

## [v2.0.1] — 2026-11-09

### Added
- **Complete Profile Picture Management System**:
  - New `ProfilePhotoSource` type (`'custom' | 'google' | 'none'`) added to `AppUser`.
  - New fields in `AppUser`: `customPhotoUrl`, `googlePhotoUrl`, `photoSource`.
  - `src/utils/profilePhotoHelper.ts`: `resolveProfilePicture`, `calculateGoogleSyncUpdates`, `isValidPhotoUrl`.
  - `src/services/userProfilePhotoService.ts`: `setCustomProfilePhoto` (upload to Firebase Storage + Firestore update), `switchToGooglePhoto`, `removeCustomPhoto`.
  - `src/components/common/ProfilePhotoModal.tsx`: Full-featured modal with gallery picker, camera capture, Google photo toggle, and remove photo actions.
  - Profile picture card integrated into `EditProfileScreen.tsx` (Account → Edit Profile → Profile Picture).
  - `AccountScreen.tsx` avatar tap now opens `ProfilePhotoModal` instead of a bare image picker.

- **Complete Application Limits & Boundary Validation**:
  - `src/constants/limits.ts`: Centralized `APP_LIMITS` across Expense, Split, Group, User, and Export domains.
  - `src/utils/currency.ts`: Added currency decimal precision awareness (0 for JPY/KRW, 3 for KWD/BHD, 2 for INR/USD/EUR), symbol mappings for all 15 currencies, `isValidFinancialAmount`, `isSafeMinorUnit`, and non-finite safe formatting.
  - `src/utils/splitMath.ts`: Added safe integer checks (`Number.isSafeInteger`) and share bounds protection in `distributeCentsByShares`.
  - `src/screens/AddExpenseScreen.tsx`: Bounded descriptions (`maxLength={255}`), notes (`maxLength={1000}`), sanitized newlines, validated dates between -10 and +1 years, and replaced floating-point multi-payer validation with exact minor-unit cents check.
  - `src/screens/CreateGroupScreen.tsx` & `src/screens/EditProfileScreen.tsx`: Enforced `maxLength` across group names (50), user names (70), emails (254), and phone numbers (25).
  - `src/services/exportService.ts`: Added CSV formula injection defense (`'`, `+`, `-`, `@`, `\t`, `\r`) and bounded export batch sizes to 5,000 rows.
  - `tests/limitsValidation.test.ts`: Added 8 test suites covering zero/negative/overflow amounts, currency decimal precisions, safe integer bounds, and extreme shares.

- **Automated Unit Tests for Profile Photo System** (`tests/profilePhoto.test.ts`):
  - 10 comprehensive test scenarios covering Google login sync, custom upload priority, subsequent Google login protection, URL validation, and fallback chain.

- **Enhanced `MemberAvatar.tsx`**: Exported `ProfileAvatar` alias; image error state resets on `imageUrl` change for clean broken-image recovery.

- **`GoogleIcon.tsx` updated**: Now accepts optional `style` prop for inline icon sizing without TypeScript errors.

- **`package.json` test script**: Added `test:profilephoto` to both standalone and full `npm test` pipeline.

### Changed
- `src/services/auth.ts`: Updated `loadUserProfile`, `signInWithGoogleCredential`, `linkGoogleCredential`, `migrateAnonymousDataToExistingGoogleAccount` to use `calculateGoogleSyncUpdates` — Google login **never** overwrites active custom profile pictures.
- `src/context/AuthContext.tsx`: `onAuthStateChanged` now calls `syncGoogleProfileOnAuth` to track background Google photo updates without overwriting manual custom avatars.

---

## [v2.0.0] — 2026-11-09

### Added
- **Group Cover Photo System**:
  - 29 curated preset covers across 8 thematic categories (Home, Travel, Couple, Food, Adventure, Urban, Nature, Minimal).
  - `src/constants/presetCovers.ts`: Full preset catalog with deterministic hash-based fallback.
  - `src/services/groupCoverService.ts`: Upload and management of custom cover photos.
  - `src/components/common/GroupCoverHeader.tsx`: Scrolling 16:9 banner header embedded in `GroupDetailsScreen`.
  - `src/components/common/GroupCoverPhotoModal.tsx`: Tabbed preset gallery + custom upload modal.
  - Smart category pre-selection based on group type and name analysis.
  - 6 unit tests in `tests/coverPhoto.test.ts` (100% pass).

- **Group Settings Overhaul** (`GroupSettingsScreen.tsx`):
  - Dedicated modals for: Edit Group Info, Members, Expense Preferences, Notifications, Export, Balance Reminders, Recent Activity.
  - Group Type now visible in the settings header.
  - Simplify Debts toggle.
  - Per-group notification toggles.
  - 7 unit tests in `tests/groupSettings.test.ts`.

- **Intelligent Category Detection Engine** (`src/services/categoryDetector/`):
  - 23-category classification system.
  - Multilingual support: English, Hindi, Hinglish, Spanish, French, Portuguese, Indonesian, Mandarin, Japanese, Arabic.
  - Merchant dictionary with 100+ global and Indian brand patterns.
  - Machine-learned user preferences via `AsyncStorage`.
  - 156 test cases in `tests/categoryDetector.test.ts` (100% pass).

- **Data Export Engine** (`src/services/exportService.ts`):
  - RFC-4180 compliant CSV spreadsheet export with date filtering.
  - Formatted text financial summary with WhatsApp/SMS sharing.

- **QR Code Group Invite Modal** (`src/components/common/QrCodeModal.tsx`).

- **Spending Analytics** (`StatisticsScreen.tsx`):
  - `SpendingDonutChart.tsx`: Category breakdown with percentages.
  - `MonthlyTrendsChart.tsx`: Month-over-month spending bars.

- **Split Math Engine** (`src/utils/splitMath.ts`):
  - 6 split modes: equal, unequal, percentage, shares, adjustment, itemized.
  - Integer minor currency unit architecture.
  - 30+ unit tests in `tests/splitMath.test.ts`.

- **Balance Calculator** (`src/utils/balanceCalculator.ts`):
  - `computeNetBalances`: Handles single payer, multi-payer tags, settlements.
  - `optimizeSettlements`: Debt minimization greedy graph algorithm.
  - `getDirectPairwiseSettlements`: Bilateral non-simplified debts.
  - `calculateGroupSettlements`: Respects group `simplifyDebts` setting.
  - 12 test scenarios in `tests/balanceCalculator.test.ts`.

- **Offline Sync Engine** (`src/sync/`):
  - `networkMonitor.ts`: Live network state detection via NetInfo.
  - `syncQueue.ts`: Durable disk-persisted mutation queue with retry/backoff.
  - `syncService.ts`: Bidirectional Firestore `onSnapshot` listeners plus catchup sync on foreground resume.

- **Haptics Service** (`src/services/hapticsService.ts`):
  - Centralized haptic feedback wrapper with global enable/disable toggle.
  - Haptic buttons, tabs, cards, FABs, checkboxes via `/src/components/ui/Haptic*.tsx`.

---

## [v1.0.0] — 2026-11-04 (Initial Release)

### Added
- Anonymous guest onboarding with Google Sign-In.
- Anonymous to Google account data migration.
- Group creation (name, type, currency, join code).
- Group details screen with expense list and member balances.
- Basic expense recording (single payer, equal split).
- Settlement recording via `SettleUpModal`.
- Friends screen with friendship management.
- Friend details screen with cross-group aggregated balance.
- Account settings screen with profile editing.
- Local SQLite persistence with WAL mode and 7-table schema.
- Firebase Auth, Firestore, and Storage integration.
- Light/Dark theme support.
- Safe area inset handling for iOS notched devices and Android navigation bars.

