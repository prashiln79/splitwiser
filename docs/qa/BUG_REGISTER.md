# Splitwiser Master Bug Register

## Severity Classifications
- **P0 (Critical / Blocker)**: System-wide failure, data loss, security vulnerability, inability to authenticate or process transactions. Must be resolved before any release.
- **P1 (High)**: Major feature impairment, crash under specific conditions, broken edge cases, account linking failures.
- **P2 (Medium)**: Non-breaking functional bug, visual layout defects, missing localizations, degraded UX with workarounds.
- **P3 (Low)**: Minor cosmetic inconsistencies, formatting quirks, non-fatal console warnings.

---

## Active & Resolved Bug Register

| Bug ID | Severity | Module | Description | Status | File | Line | Fixed By |
|---|---|---|---|---|---|---|---|
| **BUG-001** | P0 | Security / Firebase | Firestore development security rules are set to `allow read, write: if true;`, allowing unauthenticated public access. Must enforce `request.auth != null` and group membership before production release. | ⚠️ Documented / Hardening Needed | `firestore.rules` | L4 | firebase-inspector / Pending Prod Rules Deployment |
| **BUG-002** | P1 | Storage / Web | SQLite web concurrency OPFS `createSyncAccessHandle` throws `NoModificationAllowedError` across multiple browser tabs due to exclusive locks. | ✅ Resolved | `App.tsx` / `src/database/index.ts` | Warmup guarded | sqlite-fixer (`Platform.OS !== 'web'` warmup guard) |
| **BUG-003** | P2 | i18n / Web | Missing or uninitialized polyfill for `@formatjs/intl-pluralrules` causes runtime warnings on web and older JavaScript engines during pluralization. | ✅ Resolved | `src/i18n/index.ts` | L1 | i18n-tester |
| **BUG-004** | P1 | Identity / Linking | Linking guest account to Google email that is already registered throws `auth/credential-already-in-use`, risking stranded anonymous data. | ✅ Resolved | `src/services/auth.ts` | L210+ | auth-tester (`migrateAnonymousDataToExistingGoogleAccount`) |
| **BUG-005** | P2 | Notifications | Raw Firebase UID string displayed as actorName in notifications instead of resolving to friendly user display name. | ✅ Resolved | `src/utils/notificationUtils.ts` | L420-L460 | notificationUtils (`resolveNotificationDisplay` with memberMap & global cache) |
| **BUG-006** | P2 | UI / Android | Edge-to-edge camera cutout and status bar collision on notch devices leading to covered header titles. | ✅ Resolved | `src/screens/onboarding/` | Safe area wrappers | ui-inspector / onboardingFlow |
| **BUG-007** | P3 | Financial Engine | IEEE 754 floating point arithmetic precision drift on odd penny distributions (e.g. ₹100 split 3 ways). | ✅ Resolved | `src/utils/splitMath.ts` | L28-L38 | financial-tester (`distributeCentsEqually` remainder cent allocation) |
| **BUG-008** | P2 | User Profile | Subsequent Google logins automatically overwrote user's custom uploaded avatar photo. | ✅ Resolved | `src/utils/profilePhotoHelper.ts` | L58-L85 | profilePhoto test suite (`calculateGoogleSyncUpdates` preserves custom) |
| **BUG-009** | P3 | Categories | False positive categorization: "Barber haircut" matched "bar" (Drinks), "Water bottle" matched Utilities, "Great evening" matched "eat" (Food). | ✅ Resolved | `src/services/categoryDetector.ts` | L40-L115 | categoryDetector test suite (word boundary & negative guards) |
| **BUG-010** | P2 | Security | Brute force PIN guessing not rate-limited on SecurityLockScreen. | ✅ Resolved | `src/utils/securityUtils.ts` | L85-L107 | security test suite (5 failed attempts lock out for 30s) |
| **BUG-011** | P1 | Financial / Calculation | 1-Cent / 1-Paisa debts dropped in `optimizeSettlements` due to strict `> 0.01` and `< -0.01` comparisons, causing fractional penny debts to disappear. | ✅ Resolved | `src/utils/balanceCalculator.ts` | L80-L108 | financial-tester (`>= 0.01` and `<= -0.01` with rounding) |
| **BUG-012** | P2 | Financial / Calculation | 1-Cent debts dropped in non-simplified `getDirectPairwiseSettlements` due to `> 0.01` threshold. | ✅ Resolved | `src/utils/balanceCalculator.ts` | L164-L182 | financial-tester (`>= 0.01` and `<= -0.01`) |
| **BUG-013** | P1 | Financial / Payers | Multiple payers encoded in tags ignored by `getDirectPairwiseSettlements`, attributing debts to phantom user `__MULTIPLE__`. | ✅ Resolved | `src/utils/balanceCalculator.ts` | L140-L160 | financial-tester (proportional allocation across multi-payer tags) |

---

## Defect Summary
- **Total Logged**: 13
- **P0 (Critical)**: 1 (Documented / Target for Production Security Hardening)
- **P1 (High)**: 4 (All Resolved)
- **P2 (Medium)**: 6 (All Resolved)
- **P3 (Low)**: 2 (Both Resolved)
- **Resolution Rate**: 92.3% Resolved (12/13), 1 Documented Production Pre-condition.
