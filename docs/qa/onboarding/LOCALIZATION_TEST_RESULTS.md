# Localization (i18n) Test Results
## Splitwiser — Onboarding QA Suite · FILE 7 of 10

| Field | Value |
|---|---|
| **Document ID** | QA-I18N-007 |
| **Suite** | Onboarding QA |
| **Prepared by** | QA Automation |
| **Date** | 2026-11-11 |
| **Status** | ⚠️ PARTIAL PASS — P2 findings open |

---

## 1. Executive Summary

Splitwiser targets **8 locales** and declares RTL support for Arabic. The automated test suite confirms **100% key coverage** across all 8 languages for the `notifications` namespace. However, a significant gap exists: **all onboarding screens use hardcoded English strings** and do not use the i18n translation pipeline. Additionally, **no RTL layout handling** (`I18nManager.forceRTL()` or `I18nManager.isRTL` guards) is present in any onboarding screen.

This results in **BUG-005 (P2 OPEN)**: Arabic, Simplified Chinese, Spanish, French, Portuguese (Brazil), Indonesian, and Russian users all experience English-only text during the first-run onboarding flow — the most critical UX moment in the app lifecycle.

**Verdict: PARTIAL PASS** — Notifications namespace passes; onboarding i18n is not implemented.

---

## 2. Supported Locales

| Locale Code | Language | Script Direction | Status |
|---|---|---|---|
| `en` | English | LTR | ✅ Reference locale |
| `zh-Hans` | Simplified Chinese | LTR | ✅ Notifications: 100% |
| `es` | Spanish | LTR | ✅ Notifications: 100% |
| `ar` | Arabic | **RTL** | ✅ Notifications: 100% — ⚠️ RTL layout unimplemented in onboarding |
| `fr` | French | LTR | ✅ Notifications: 100% |
| `pt-BR` | Portuguese (Brazil) | LTR | ✅ Notifications: 100% |
| `id` | Indonesian | LTR | ✅ Notifications: 100% |
| `ru` | Russian | LTR | ✅ Notifications: 100% |

---

## 3. Namespace Coverage Results

### 3.1 `notifications` Namespace

| Metric | Value |
|---|---|
| **Total translation keys** | 61 |
| **Languages tested** | 8 |
| **Total key×language pairs** | 488 |
| **Pairs with translation present** | 488 |
| **Coverage** | **100%** |
| **Test method** | Automated — `onboardingQA.test.ts` |
| **Status** | ✅ PASS |

All 61 notification keys are present in every locale file. No missing keys, no empty strings, no untranslated fallback placeholders detected.

### 3.2 `onboarding` Namespace

| Metric | Value |
|---|---|
| **Onboarding screens** | 7 |
| **i18n namespace used** | ❌ None — strings hardcoded |
| **Coverage** | **0%** |
| **Status** | ⛔ NOT IMPLEMENTED (BUG-005) |

---

## 4. Hardcoded String Audit

The following onboarding screens were audited. All confirmed to use hardcoded English string literals rather than `useTranslation()` / `t()` calls.

### 4.1 WelcomeScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| App tagline | `"Split expenses, not friendships"` | `onboarding.welcome.tagline` |
| Primary CTA | `"Get Started"` | `onboarding.welcome.getStarted` |
| Guest CTA | `"Continue as Guest"` | `onboarding.welcome.continueAsGuest` |

### 4.2 AuthSelectionScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Screen title | `"Sign In"` / `"Create Account"` | `onboarding.auth.signIn` / `onboarding.auth.createAccount` |
| Google button | `"Continue with Google"` | `onboarding.auth.continueWithGoogle` |
| Email button | `"Continue with Email"` | `onboarding.auth.continueWithEmail` |
| Email modal title | `"Enter your email"` | `onboarding.auth.emailModalTitle` |
| Validation error — invalid email | `"Please enter a valid email address."` | `onboarding.auth.invalidEmail` |
| Validation error — empty | `"Email cannot be empty."` | `onboarding.auth.emptyEmail` |
| Alert — account exists | `"Account already exists…"` | `onboarding.auth.accountExistsAlert` |
| Alert — no account | `"No account found…"` | `onboarding.auth.noAccountAlert` |

### 4.3 GuestProfileSetupScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Screen title | `"Set Up Your Profile"` | `onboarding.guestProfile.title` |
| Name placeholder | `"Your name"` | `onboarding.guestProfile.namePlaceholder` |
| Validation error — empty name | `"Please enter your name."` | `onboarding.guestProfile.emptyName` |
| Validation error — name too short | `"Name must be at least 2 characters."` | `onboarding.guestProfile.nameTooShort` |
| Continue button | `"Continue"` | `onboarding.guestProfile.continue` |

### 4.4 IntroSlidesScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Slide 1 heading | *(slide title)* | `onboarding.slides.slide1.title` |
| Slide 1 body | *(slide description)* | `onboarding.slides.slide1.body` |
| Slide 2 heading | *(slide title)* | `onboarding.slides.slide2.title` |
| Skip button | `"Skip"` | `onboarding.slides.skip` |
| Next button | `"Next"` | `onboarding.slides.next` |
| Get Started button | `"Get Started"` | `onboarding.slides.getStarted` |

### 4.5 FirstSetupSelectionScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Screen title | `"What would you like to do?"` | `onboarding.firstSetup.title` |
| Create group option | `"Create a Group"` | `onboarding.firstSetup.createGroup` |
| Join group option | `"Join a Group"` | `onboarding.firstSetup.joinGroup` |

### 4.6 OnboardingGroupCreationScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Screen title | `"Create Your First Group"` | `onboarding.groupCreation.title` |
| Group name placeholder | `"Group name"` | `onboarding.groupCreation.placeholder` |
| Validation errors | Various hardcoded strings | `onboarding.groupCreation.errors.*` |
| Submit button | `"Create Group"` | `onboarding.groupCreation.submit` |

### 4.7 JoinGroupScreen

| Element | Hardcoded String | Recommended i18n Key |
|---|---|---|
| Screen title | `"Join a Group"` | `onboarding.joinGroup.title` |
| Invite code placeholder | `"Enter invite code"` | `onboarding.joinGroup.placeholder` |
| Join button | `"Join"` | `onboarding.joinGroup.join` |
| Error — invalid code | `"Invalid invite code."` | `onboarding.joinGroup.invalidCode` |

---

## 5. Alert Dialog Audit

Alert dialogs generated via `Alert.alert()` in onboarding screens are **fully hardcoded in English**:

| Screen | Alert Trigger | Hardcoded Title | Hardcoded Body |
|---|---|---|---|
| `AuthSelectionScreen` | Account conflict | `"Account Already Exists"` | English description |
| `AuthSelectionScreen` | No account found | `"No Account Found"` | English description |
| `GuestProfileSetupScreen` | Validation failure | `"Invalid Name"` | English description |
| `OnboardingGroupCreationScreen` | Creation failure | `"Error"` | English error message |
| `JoinGroupScreen` | Invalid code | `"Invalid Code"` | English description |

---

## 6. RTL Layout Assessment

| Check | Finding | Status |
|---|---|---|
| `I18nManager.isRTL` usage in onboarding | Not found in any onboarding screen | ⚠️ NOT IMPLEMENTED |
| `I18nManager.forceRTL()` call | Not found | ⚠️ NOT IMPLEMENTED |
| `flexDirection: 'row-reverse'` for RTL | Not found | ⚠️ NOT IMPLEMENTED |
| `textAlign: 'right'` for RTL text | Not found | ⚠️ NOT IMPLEMENTED |
| Locale file for Arabic (`ar`) | ✅ Present | ✅ PASS |
| Notifications keys in Arabic | ✅ 100% coverage | ✅ PASS |

**Impact:** Arabic-locale users will see left-aligned, left-to-right layout during onboarding. While the app translates notifications to Arabic, the onboarding layout may appear mirrored or awkward for RTL readers.

---

## 7. Locale Directory Verification

All 8 locale directories are present and structurally correct:

```
src/
  locales/
    en/            ✅ Present
    zh-Hans/       ✅ Present
    es/            ✅ Present
    ar/            ✅ Present
    fr/            ✅ Present
    pt-BR/         ✅ Present
    id/            ✅ Present
    ru/            ✅ Present
```

Each directory contains the expected namespace JSON files. The `notifications` namespace file is confirmed in all 8.

---

## 8. Automated Test Summary

| Test Group | Tests | Passed | Failed | Coverage |
|---|---|---|---|---|
| Notifications namespace — key presence | 61 × 8 = 488 checks | 488 | 0 | 100% |
| Locale directory structure | 8 checks | 8 | 0 | 100% |
| Onboarding i18n (automated) | N/A | — | — | 0% (not implemented) |
| RTL automated checks | N/A | — | — | 0% (not implemented) |

---

## 9. Findings Summary

| ID | Severity | Status | Description |
|---|---|---|---|
| BUG-005 | P2 | 🔴 OPEN | All onboarding screens use hardcoded English strings |
| RTL-001 | P2 | 🔴 OPEN | No RTL layout handling in onboarding for Arabic locale |
| ALERT-001 | P2 | 🔴 OPEN | All `Alert.alert()` calls in onboarding use hardcoded English |

---

## 10. Recommendations

### 10.1 Migrate Onboarding Strings to i18n (BUG-005)

1. Create an `onboarding` namespace JSON file for each locale under `src/locales/{locale}/onboarding.json`.
2. Add the `onboarding` namespace to the i18next configuration.
3. Replace all hardcoded string literals in onboarding screens with `const { t } = useTranslation('onboarding')` and `t('key.path')` calls.
4. Translate the English reference file into all 7 non-English locales.
5. Add an automated test similar to the notifications namespace check to enforce 100% key coverage per locale.

### 10.2 Implement RTL Support

1. Add `I18nManager.isRTL` checks in `IntroSlidesScreen`, `AuthSelectionScreen`, and `GuestProfileSetupScreen`.
2. Use `flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'` for horizontal layouts.
3. Use `textAlign: I18nManager.isRTL ? 'right' : 'left'` for text inputs and labels.
4. Perform a manual RTL device test with the device language set to Arabic.

### 10.3 Translate Alert Dialogs

Replace hardcoded `Alert.alert('Title', 'Body')` calls with translated strings:
```ts
Alert.alert(t('auth.accountExistsAlert.title'), t('auth.accountExistsAlert.body'));
```

---

*Document generated by Splitwiser QA Automation · QA-I18N-007 · 2026-11-11*
