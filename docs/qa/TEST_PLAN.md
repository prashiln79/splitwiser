# Splitwiser Quality Assurance Master Test Plan (v2.0.1)

## 1. Document Control & Overview
- **Application Name**: Splitwiser (React Native Expense Sharing App)
- **Version**: 2.0.1
- **Platform Targets**: Android (APK/AAB via Expo SDK 58), Web (React Native Web / Metro), iOS
- **Document Version**: 1.0.0
- **Status**: Active / In-Execution

---

## 2. Test Strategy & Objectives
The primary objective of the Splitwiser QA process is to guarantee financial accuracy, authentication integrity, cross-platform UI responsiveness, data persistence resilience, offline capabilities, and internationalization conformance.

### 2.1 Core Pillars
1. **Mathematical & Financial Exactness**: Zero penny loss, exact cent arithmetic (`splitMath.ts`), debt optimization (`optimizeSettlements`), and multi-currency precision.
2. **Identity & Data Preservation**: Flawless guest-to-permanent account conversion (`linkWithCredential`), UID preservation, and anti-data-loss conflict handling.
3. **Offline & Sync Reliability**: Local SQLite caching, sync queue retry logic, and seamless cloud synchronization with Firestore.
4. **Visual & Device Responsiveness**: Consistent typography, dynamic dark/light theme switching, RTL layout support, and notch/safe-area handling across all screen sizes (360px to 1024px+).
5. **Security & Access Control**: Client-side PIN hashing (SHA-256 with salt), rate-limiting/lockout policies, and Firestore security rules verification.

---

## 3. Test Scope

### 3.1 In-Scope Modules
- **Authentication & Onboarding**:
  - Guest authentication (`signInAnonymously`), Google OAuth (`@react-native-google-signin/google-signin`), and Email/Password flows.
  - Multi-step onboarding: Welcome, AuthSelection, GuestProfileSetup, IntroSlides, FirstSetupSelection, OnboardingGroupCreation, JoinGroup.
  - Account linking and conflict resolution (`auth/credential-already-in-use`).
- **Financial & Group Calculations**:
  - Equal, Percentage, Exact, Shares, Adjustment, and Itemized split calculations.
  - Pairwise direct debt vs. debt simplification algorithms.
  - Soft-delete expense reversal, edit re-calculation, and multi-payer expense splits.
  - Boundary limits: ₹0 rejection, ₹1,000,000,000 ceiling, and decimal precisions (0, 2, 3 decimals).
- **Group Settings & Management**:
  - Group creation, cover photo preset assignments, deterministic hashing fallbacks.
  - Export services (CSV RFC-4180 and financial text summary generation).
  - Date-range filtering (all, this month, past intervals).
- **Category Detection Engine**:
  - Automatic keyword matching across 23 canonical categories.
  - Multilingual receipt keywords (English, Hindi, Spanish, French, Chinese, Arabic, Portuguese, Indonesian, Japanese).
  - Ambiguity guards (e.g., "barber" $\neq$ drinks, "water bottle" $\neq$ utilities).
- **In-App Notification Center**:
  - 15 event types, deterministic deduplication hashing, actor UID $\rightarrow$ display name resolution.
  - Group muting and category toggle filters.
  - Deep-link route resolution to ExpenseDetails and GroupDetails.
- **Appearance & Security**:
  - Light, Dark, and System theme persistence with semantic token symmetry.
  - 4-digit PIN setup, SHA-256 salt hashing, lockout after 5 failed attempts.
- **Internationalization (i18n)**:
  - 8 fully translated locales: `en`, `zh-Hans`, `es`, `ar`, `fr`, `pt-BR`, `id`, `ru`.
  - RTL mirroring for Arabic (`ar`).

### 3.2 Out-of-Scope
- Hardware device NFC payment terminals.
- Third-party banking gateway processing (Splitwiser records peer-to-peer debts and settlements; does not process fiat payment transfers directly).
- Real push notification dispatch via FCM production APNs servers (tested via in-app Firestore notification center and local OS notification handlers).

---

## 4. Entry & Exit Criteria

### 4.1 Entry Criteria
- Codebase builds cleanly with `npm run ts:check` without TypeScript compilation errors.
- Test runner and dependencies (`tsx`, `node`, `expo-sqlite`, `firebase`) resolved.
- Baseline unit test scripts registered in `package.json`.

### 4.2 Exit Criteria
- **100% Pass Rate** on all automated test suites (`npm test`).
- **Zero P0 / P1 open defects** in `BUG_REGISTER.md`.
- Full verification across all 8 i18n locales with 0 missing translation keys.
- Financial edge cases (fractions of cents, multi-currency isolation, extreme shares) verified with zero deviation.
- Regression test suite passes with zero regressions on master branch.

---

## 5. Test Environments & Configurations

| Environment | Specs / Engine | Primary Focus |
|---|---|---|
| **Node.js Test Runner** | Node v20+ / `tsx` | Fast in-process unit & integration suites, split math, balance calculation, security hashing |
| **Small Android** | 360 x 640 dp (hdpi / xhdpi) | Button tap targets (min 44x44dp), text wrapping, modal sizing, bottom tab clearance |
| **Standard Android** | 390 x 844 dp (xxhdpi) | Standard baseline UI, list view performance, expense card layout |
| **Large Android** | 412 x 915 dp (xxxhdpi) | Edge-to-edge camera cutout handling, status bar padding, high-res asset scaling |
| **Tablet Form Factor** | 768 x 1024 dp | Max-width content containers, multi-column navigation, tablet balance cards |
| **Web Browser** | Chrome / Safari / Firefox (React Native Web) | Cross-origin isolation (COOP/COEP), OPFS SQLite fallback, mouse/keyboard interactions |

---

## 6. Test Data Requirements

### 6.1 User Profiles
- `user_me`: Primary authenticated session user (Guest, Google, or Email).
- `user_rahul`, `user_alice`, `user_charlie`: Peer group members and multi-party split participants.
- `anon_test_user`: Anonymous visitor with incomplete and complete profile states.

### 6.2 Financial Fixtures
- Small transaction: ₹20.00 (Chai / Snacks).
- Odd penny distribution: ₹100.00 split 3 ways (33.34, 33.33, 33.33).
- Extreme transaction boundary: ₹1,000,000,000.00.
- Currency precisions: JPY (0 decimals), INR/USD (2 decimals), KWD (3 decimals).

---

## 7. Roles & Swarm Execution Responsibilities

| Role | Agent / Owner | Assigned Responsibilities |
|---|---|---|
| **Project Auditor** | `@auditor` | Full codebase inventory: screens, components, routes, services, collections, and feature matrix |
| **Financial Test Engineer** | `@financial-tester` | Financial correctness, edge cases, splitMath, debt simplification, multi-payer splits |
| **Auth Test Engineer** | `@auth-tester` | Guest session lifecycle, Google OAuth, email auth, credential conflict migrations |
| **Expense & Group Tester** | `@expense-tester` | Group CRUD, expense management, settlement lifecycle, export engine |
| **UI/UX Inspector** | `@ui-inspector` | Visual quality, device responsiveness, dark/light theme tokens, RTL layout audit |
| **Firebase & Security Auditor**| `@firebase-inspector` | Firestore namespace isolation (`/splitwiser/data/`), security rules, listener cleanup |
| **i18n & Localization Tester** | `@i18n-tester` | Locale parity across 8 languages, pluralization rules polyfill, RTL UI mirrors |
| **SQLite & Storage Fixer** | `@sqlite-fixer` | SQLite web concurrency bug fix (OPFS lock), offline persistence verification |
| **Documentation Writer** | `@report-writer` | Test plan, bug register, device matrix, regression logs, final QC evaluation |
| **Swarm Coordinator** | `@coordinator` | Work allocation, blocker triage, final release sign-off |
