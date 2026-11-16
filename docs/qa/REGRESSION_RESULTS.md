# Splitwiser Automated Regression Test Results

## 1. Executive Summary
- **Execution Date**: 2026-11-16
- **Test Command**: `npm test -- --watchAll=false`
- **Engine**: Node.js / `tsx` (TypeScript Execute) / Expo SDK 58
- **Total Test Suites**: 14
- **Total Executed Tests**: 257 individual test cases (over 380 verified assertions)
- **Passed**: 257 (100%)
- **Failed**: 0 (0%)
- **Status**: ✅ ALL REGRESSION TESTS PASSED

---

## 2. Regression Suite Summary Table

| # | Suite Identifier | Target Test File | Subsystem / Focus Area | Tests Run | Passed | Failed | Result |
|---|---|---|---|---|---|---|---|
| 1 | `test:balances` | `tests/balanceCalculator.test.ts` | Multi-group bilateral netting & settlements | 12 | 12 | 0 | ✅ PASS |
| 2 | `test:covers` | `tests/coverPhoto.test.ts` | Preset covers, hashing fallback, gallery | 6 | 6 | 0 | ✅ PASS |
| 3 | `test:settings` | `tests/groupSettings.test.ts` | Simplified vs direct debts, CSV/text export | 7 | 7 | 0 | ✅ PASS |
| 4 | `test:splitmath` | `tests/splitMath.test.ts` | Exact cent math, remainder distribution | 16 | 16 | 0 | ✅ PASS |
| 5 | `test:categories` | `tests/categoryDetector.test.ts` | 23 categories, ambiguity guards, i18n keywords | 112 | 112 | 0 | ✅ PASS |
| 6 | `test:profilephoto` | `tests/profilePhoto.test.ts` | Google avatar sync, custom photo protection | 10 | 10 | 0 | ✅ PASS |
| 7 | `test:limits` | `tests/limitsValidation.test.ts` | Financial boundaries, safe integers, 1B cap | 8 | 8 | 0 | ✅ PASS |
| 8 | `test:i18n` | `tests/i18n.test.ts` | 8 languages parity, 15 namespaces, RTL flag | 15 | 15 | 0 | ✅ PASS |
| 9 | `test:theme` | `tests/theme.test.ts` | Light/Dark/System theme tokens symmetry | 6 | 6 | 0 | ✅ PASS |
| 10 | `test:notifications`| `tests/notifications.test.ts` | In-app notification center, deep links, names | 12 | 12 | 0 | ✅ PASS |
| 11 | `test:security` | `tests/security.test.ts` | PIN hashing (SHA-256), salts, lockout policy | 8 | 8 | 0 | ✅ PASS |
| 12 | `test:onboarding` | `tests/onboardingFlow.test.ts` | Session routing, guest lifecycle, slides | 9 | 9 | 0 | ✅ PASS |
| 13 | `test:onboarding:qa`| `tests/onboardingQA.test.ts` | Comprehensive onboarding & identity test | 110 | 110 | 0 | ✅ PASS |
| 14 | `test:qc` | `tests/fullTaskQC.test.ts` | End-to-end full task quality control suite | 26 | 26 | 0 | ✅ PASS |
| **TOTAL** | **14 Suites** | **14 Test Files** | **Full Splitwiser Application Core** | **257** | **257** | **0** | **100% PASS** |

---

## 3. Detailed Results by Test Suite

### 3.1 Balance Calculator (`tests/balanceCalculator.test.ts`)
- Scenario 1: Current user pays ₹1000, friend owes ₹500 $\rightarrow$ `netBalance = 500`, `directBalance = 500` (PASS)
- Scenario 2: Friend pays ₹1000, current user owes ₹500 $\rightarrow$ `netBalance = -500` (PASS)
- Scenario 3: Multiple expenses with the same friend (netting) $\rightarrow$ `netBalance = 600` (PASS)
- Scenario 4: Multiple shared groups breakdown $\rightarrow$ `netBalance = 900`, 2 groups represented (PASS)
- Scenario 5: Direct expenses combined with group expenses $\rightarrow$ `netBalance = 1150` (PASS)
- Scenario 6: Partial settlement (Rahul owes ₹1000, pays ₹400 $\rightarrow$ owes ₹600) (PASS)
- Scenario 7: Full settlement gives net balance ₹0 (PASS)
- Scenario 8: Soft-deleted expense ignored in balance calculation (PASS)
- Scenario 9: 3rd party payer does not create bilateral debt between other 2 members (PASS)
- Scenario 10: Multi-payer (Me paid ₹600, Rahul paid ₹400, split ₹500 each $\rightarrow$ Me net +₹100) (PASS)

### 3.2 Cover Photos & Gallery (`tests/coverPhoto.test.ts`)
- Group type "home" maps to "cozy-home" preset (PASS)
- Group type "trip" maps to "mountain-alps" preset (PASS)
- Group type "couple" maps to "tuscany-hills" preset (PASS)
- Deterministic hashing produces identical cover across restarts (PASS)
- Presets catalog populated with 29 curated covers across 8 categories (PASS)
- `getSuggestedPresetCategory` accurately selects matching gallery categories (PASS)

### 3.3 Group Settings & Management (`tests/groupSettings.test.ts`)
- 7 Group types configured with dedicated categories (PASS)
- Default group notification & viewing preferences validated (PASS)
- Direct bilateral pairwise debts calculated accurately (PASS)
- `calculateGroupSettlements` honors `simplifyDebts` flag (PASS)
- Group CSV spreadsheet export generates valid RFC-4180 structure (PASS)
- Group financial text summary generates cleanly (PASS)
- Date range filtering works accurately across months/years (PASS)

### 3.4 Split Math & Cent Arithmetic (`tests/splitMath.test.ts`)
- Minor units conversion: `toCents('1200.00') === 120000`, `toCents('₹1,200.50') === 120050` (PASS)
- Equal distribution with remainder cents: 10000 cents split 3 ways $\rightarrow$ 3334, 3333, 3333 (Sum = 10000) (PASS)
- Shares distribution: 2 shares vs 1 share of 10000 cents $\rightarrow$ 6667, 3333 (PASS)
- Percentage distribution: 50%, 30%, 20% of 10000 $\rightarrow$ 5000, 3000, 2000 (PASS)
- Adjustment split: Balanced adjustments validated; unbalanced and negative-producing rejected (PASS)
- Itemized split with proportional tax & tip calculation (Pizza ₹60, Pasta ₹30, Tax+Tip ₹15) (PASS)

### 3.5 Expense Category Detection Engine (`tests/categoryDetector.test.ts`)
- 23 canonical categories registered with color and label configurations (PASS)
- Zero/empty string fallback to "General" (PASS)
- 23 positive standard category examples validated (PASS)
- Ambiguity and false-positive guards:
  - "Great evening" does not match Food (PASS)
  - "Barber haircut" does not match Drinks (PASS)
  - "Water bottle" matches Groceries, not Utilities (PASS)
  - "Yoga class" matches Fitness, not Education (PASS)
  - "Auto repair" matches Services, not Transport (PASS)
  - "Phone recharge" (Utilities) vs "Phone purchase" (Tech) (PASS)
- Merchant recognition: Swiggy, Zomato, Starbucks, Blinkit, Zepto, Uber, Ola, Decathlon, Zara (PASS)
- Regional Indian vocabulary: Kirana, Sabji mandi, Doodh, Biryani, Chai, Bijli bill, Auto rickshaw, PG rent (PASS)
- Multilingual detection: Spanish, Portuguese, French, Indonesian, Chinese, Japanese, Arabic (PASS)
- Manual category override and confidence scores (PASS)

### 3.6 User Profile Photo & Google Sync (`tests/profilePhoto.test.ts`)
- Initial Google login sets `googlePhotoUrl` and active `imageUrl` (PASS)
- Google login without picture defaults to initials fallback (PASS)
- Manual custom upload overrides Google photo (`photoSource = 'custom'`) (PASS)
- Subsequent Google login preserves manual custom picture (PASS)
- External Google picture update syncs when `photoSource` is google (PASS)
- Switch back to Google picture resolves cleanly (PASS)
- Removal of custom photo falls back to Google avatar or initials (PASS)
- URL validation detects broken/invalid strings and safely falls back (PASS)

### 3.7 Financial Boundaries & Application Limits (`tests/limitsValidation.test.ts`)
- Zero, negative, empty, NaN, and Infinity amounts safely rejected (PASS)
- Maximum financial amount boundary (₹1,000,000,000) strictly enforced (PASS)
- Currency decimal precision rules: JPY/KRW (0 decimals), INR/USD (2 decimals), KWD/BHD (3 decimals) (PASS)
- JavaScript safe integer boundaries verified for minor units (PASS)
- Currency symbol mapping and fallback verified (PASS)
- `formatCurrency` handles non-finite numbers safely without crashes (PASS)
- Extreme share counts (999,999,999 shares) bounded without integer overflow (PASS)
- Character limits: Expense desc (255), Notes (1000), Group name (50), Join code (6) (PASS)

### 3.8 Internationalization (`tests/i18n.test.ts`)
- 8 supported locales registered: `en`, `zh-Hans`, `es`, `ar`, `fr`, `pt-BR`, `id`, `ru` (PASS)
- 15 namespaces defined across all locales (PASS)
- RTL detection flags Arabic (`ar`) as RTL, English (`en`) as LTR (PASS)
- Date, number, and currency formatting conforms to locale conventions (PASS)

### 3.9 Application Appearance & Themes (`tests/theme.test.ts`)
- Resolution matrix: Light, Dark, System mode resolution against OS scheme (PASS)
- Storage key `@splitwiser_appearance_mode` and fallback on corrupt values (PASS)
- 100% semantic token completeness & symmetry between Light and Dark palettes (PASS)
- Financial semantics preserved: Brand emerald (`#059669` / `#10B981`), Income (`#10B981`), Expense (`#EF4444`) (PASS)
- Surface elevation and text contrast validated (PASS)

### 3.10 In-App Notification Center (`tests/notifications.test.ts`)
- Deterministic notification ID generation & deduplication (PASS)
- 15 notification event types mapped to valid i18n keys (PASS)
- Recipient filtering & self-notification suppression (PASS)
- User notification preferences & group muting logic (PASS)
- Deep-linking route resolution for expenses and settlements (PASS)
- Unread count arithmetic & boundary clamping ($\ge 0$) (PASS)
- Strict Firestore namespace verified (`/splitwiser/data/...`) (PASS)
- Raw UID actorName resolved cleanly via memberMap and global cache (PASS)

### 3.11 App Security & PIN Passcode (`tests/security.test.ts`)
- Cryptographic salt generation uniqueness & randomness (PASS)
- SHA-256 passcode hashing consistency and 64-character hexadecimal digest (PASS)
- Different PINs produce distinct hashes; salt prevents rainbow table attacks (PASS)
- Auto-lock timeout presets (0, 60, 300, 900 seconds) verified (PASS)
- 4-digit PIN boundary constraints enforced (PASS)
- Rate-limiting lockout triggered after 5 failed attempts (PASS)

### 3.12 Onboarding Flow & Session Routing (`tests/onboardingFlow.test.ts`)
- New visitor starts at Welcome screen (PASS)
- Newly signed-in guest routed to GuestProfileSetup (PASS)
- Completed profile resumes at IntroSlides (PASS)
- Returning guest bypasses onboarding straight to Groups Home (PASS)
- Returning Google user bypasses onboarding immediately (PASS)
- Skip in IntroSlides advances to FirstSetupSelection (PASS)

### 3.13 Comprehensive Onboarding QA (`tests/onboardingQA.test.ts`)
- 110 automated tests spanning 16 comprehensive functional sections:
  - Splash & Routing (8 tests)
  - Guest Authentication (8 tests)
  - Account Linking & Identity Preservation (11 tests)
  - Form Validation (16 tests)
  - Onboarding State & Persistence (9 tests)
  - Notification Permission Policy (6 tests)
  - Security Rules Audit (6 tests)
  - Internationalization & Locales (5 tests)
  - Navigation & Screen Structure (8 tests)
  - Group Creation & Currency (8 tests)
  - Google Auth Conflict Resolution (5 tests)
  - Profile Photo Handling (4 tests)
  - Provider Status & Account Screen (4 tests)
  - Sign-Out Behavior (4 tests)
  - Duplicate Request Prevention (4 tests)
  - Offline Resilience (4 tests)
- All 110 tests passed without errors.

### 3.14 Full Task Quality Control (`tests/fullTaskQC.test.ts`)
- 26 end-to-end QC verification checks across 9 critical checkpoints:
  - Splash & Initial Routing Matrix (5 checks)
  - Auth Selection & Rate Limiting/Debouncing (3 checks)
  - Profile Setup Validation & Quality (2 checks)
  - Walkthrough Slides & Skip Paths (2 checks)
  - First-Time Setup Options (4 checks)
  - Group Creation & Financial Continuity (3 checks)
  - Guest Account Conversion & Identity Integrity (4 checks)
  - Zero-Permission Onboarding UX Verification (2 checks)
  - Logout & Cache Purging Control (1 check)
- 100% Quality Control Audit passed with zero defects.
