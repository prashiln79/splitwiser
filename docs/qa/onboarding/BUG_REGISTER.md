# Bug Register — Onboarding & Authentication

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-11  
**Project:** Splitwiser Expense Tracker  
**Total Issues Logged:** 8 (1 Critical P0, 4 High/Medium P2, 3 Low P3)  
**Fixed During Audit:** 3 Issues (BUG-003, BUG-004, BUG-008)  

---

## 1. Summary Matrix

| Bug ID | Severity | Status | Component | Summary |
|---|---|---|---|---|
| **BUG-001** | **P0 (Critical)** | **OPEN** | `firestore.rules` | Open security rules (`allow read, write: if true`) permit unrestricted public read/write access. |
| **BUG-002** | **P2 (Medium)** | **OPEN** | `src/services/auth.ts` | Account conflict migration missing explicit idempotency guard on duplicate retries. |
| **BUG-003** | **P2 (Medium)** | **FIXED** | `src/screens/onboarding/AuthSelectionScreen.tsx` | Email regex accepted consecutive dots in local part (`a..b@c.com`). |
| **BUG-004** | **P2 (Medium)** | **FIXED** | `App.tsx` / `src/services/localNotificationService.ts` | OS notification permission requested on first launch during onboarding instead of after landing on main app. |
| **BUG-005** | **P2 (Medium)** | **OPEN** | `src/screens/onboarding/*` | Onboarding UI strings are hardcoded in English rather than leveraging the 8-language i18n dictionary. |
| **BUG-006** | **P2 (Medium)** | **OPEN** | `src/screens/onboarding/*` | Onboarding flow is fixed to dark navy branding (`#0B132B`) and does not adapt to light theme. |
| **BUG-007** | **P3 (Low)** | **OPEN** | `src/screens/onboarding/IntroSlidesScreen.tsx` | Intro slides use `gap` CSS property requiring React Native ≥ 0.71 (present in project, but worth noting for compatibility). |
| **BUG-008** | **P3 (Low)** | **FIXED** | `src/screens/onboarding/GuestProfileSetupScreen.tsx` | Profile setup and group creation screens wrapped with `KeyboardAvoidingView` for compact screen UX. |

---

## 2. Detailed Bug Reports

### BUG-001 [P0 – Critical – OPEN]: Firestore Security Rules Allow Unrestricted Public Access
- **Source File:** `firestore.rules`
- **Current Code:**
  ```firestore
  service cloud.firestore {
    match /databases/{database}/documents {
      match /splitwiser/{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```
- **Description:** Security rules permit any client with the Firebase project ID to read, modify, and delete all user documents, groups, expenses, splits, and settlements without authentication.
- **Impact:** Critical risk of data exfiltration or tampering if exposed prior to tightening rules.
- **Recommended Fix:** Implement user-based access control requiring `request.auth != null`, restricting user doc writes to `request.auth.uid == userId`, and restricting group access to verified members. See `docs/qa/onboarding/FIREBASE_SECURITY_TEST_RESULTS.md` for complete proposed rules.

---

### BUG-002 [P2 – Medium – OPEN]: Data Migration Missing Idempotency Check
- **Source File:** `src/services/auth.ts:migrateAnonymousDataToExistingGoogleAccount()`
- **Description:** When migrating an anonymous user's groups to an existing Google account due to a credential conflict, the process does not write an `isMigrated` lock flag. If interrupted and resumed, `arrayUnion` prevents duplicate group memberships, but expense sub-collections are re-scanned unnecessarily.
- **Impact:** Redundant Firestore writes if a network retry occurs mid-migration.
- **Recommended Fix:** Set a migration status flag or timestamp on the anonymous user document prior to starting the transfer.

---

### BUG-003 [P2 – Medium – FIXED]: Email Validation Accepted Consecutive Dots
- **Source File:** `src/screens/onboarding/AuthSelectionScreen.tsx`
- **Description:** Initial email regex permitted RFC-invalid addresses containing consecutive dots (e.g. `test..user@gmail.com`).
- **Fix Applied:** Added RFC 5321 check rejecting leading, trailing, and consecutive dots:
  ```ts
  const localPart = trimmedEmail.split('@')[0];
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    Alert.alert('Invalid Email', 'Please enter a valid email address.');
    return;
  }
  ```
- **Status:** Verified passing in `tests/onboardingQA.test.ts`.

---

### BUG-004 [P2 – Medium – FIXED]: OS Notification Permission Requested During Onboarding
- **Source File:** `App.tsx` & `src/services/localNotificationService.ts`
- **Description:** Initial implementation called `initLocalNotifications()` in `App.tsx`, which invoked `requestPermissionsAsync()` on first launch. This caused an OS notification permission dialog to interrupt the user before they had even signed in.
- **Fix Applied:** Separated channel initialization from permission requesting:
  - `initLocalNotifications()` creates Android channels silently without asking for permission.
  - Added `requestNotificationPermission()` which is deferred to `NotificationContext` only after the user has completed onboarding and mounted the main app.
- **Status:** Verified passing; onboarding runs with zero OS permission dialogs.

---

### BUG-005 [P2 – Medium – OPEN]: Onboarding Strings Hardcoded in English
- **Source File:** `src/screens/onboarding/*.tsx`
- **Description:** While Splitwiser provides full 8-language translations (`en`, `zh-Hans`, `es`, `ar`, `fr`, `pt-BR`, `id`, `ru`) for notifications and dashboard screens, the newly designed onboarding screens use hardcoded English strings.
- **Impact:** Non-English users see English text during the first-install onboarding experience.
- **Recommended Fix:** Extract all title, subtitle, button, and alert strings to `src/i18n/locales/*/onboarding.json` and wrap with `useTranslation()`.

---

### BUG-006 [P2 – Medium – OPEN]: Onboarding Background Fixed to Dark Navy
- **Source File:** `src/screens/onboarding/*.tsx`
- **Description:** All onboarding screens explicitly render `#0B132B` regardless of system appearance mode.
- **Impact:** Light theme users experience a dark interface until completing onboarding.
- **Recommended Fix:** Retain `#0B132B` as brand default, or dynamically resolve background color via `useAppTheme()`.

---

### BUG-007 [P3 – Low – OPEN]: Use of Modern `gap` Style Property
- **Source File:** `src/screens/onboarding/IntroSlidesScreen.tsx`
- **Description:** `gap: 8` and `gap: 12` are used in bullet lists and pagination dot containers.
- **Impact:** Fully supported in current Expo SDK 58 / React Native 0.76 environment, but could fail if backported to legacy RN < 0.71 runtimes.
- **Status:** Minor; informational only.

---

### BUG-008 [P3 – Low – FIXED]: Missing KeyboardAvoidingView on Profile Setup & Group Creation
- **Source File:** `src/screens/onboarding/GuestProfileSetupScreen.tsx` & `src/screens/onboarding/OnboardingGroupCreationScreen.tsx`
- **Description:** Display name and group name inputs were wrapped in `ScrollView` but lacked an explicit `KeyboardAvoidingView`.
- **Fix Applied:** Wrapped root containers with `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`.
- **Status:** Verified passing on both iOS and Android.

