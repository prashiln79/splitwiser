# Splitwiser Onboarding System — Master Test Plan

**Document Version:** 1.0  
**Date:** 2026-11-11  
**Prepared By:** QA Engineering  
**Project:** Splitwiser — React Native (Expo) Expense-Splitting App  
**Firebase Project:** `money-manager-b394e` (Production)

---

## 1. Executive Summary

This test plan governs all quality-assurance activities for the Splitwiser **onboarding system** — the user journey from first app launch through authenticated session establishment, profile completion, intro slides, and first group creation or joining. The scope spans seven onboarding screens, four authentication pathways, account-linking logic, anonymous-to-permanent data migration, navigation routing, offline resilience, and form validation.

A total of **110 automated unit tests** have been written across two test files (`tests/onboardingQA.test.ts` and `tests/onboardingFlow.test.ts`) and all pass against the current codebase. Manual device-level testing is required for OAuth flows (Google Sign-In), haptics, and notification permission prompts.

> [!IMPORTANT]
> **BUG-001 (P0 — OPEN):** `firestore.rules` currently uses `allow read, write: if true` across the entire `/splitwiser/{document=**}` namespace. This means any unauthenticated actor with knowledge of the Firebase project ID can read or write any user document. This rule **must be replaced before any public release**.

---

## 2. Test Environment

| Property | Value |
|---|---|
| Firebase Project | `money-manager-b394e` |
| Environment | Production (no emulator configured) |
| Runtime | Node.js 20 LTS + `tsx` (TypeScript executor) |
| Framework | React Native 0.76 via Expo SDK 52 |
| Navigation | `@react-navigation/native` v7 (native stack) |
| Auth SDK | Firebase JS SDK v11 (`getReactNativePersistence`) |
| Auth Persistence | `AsyncStorage` |
| Offline DB | SQLite (via Expo SQLite) |
| Test Runner | Node.js `assert` module + custom `runTest` harness |
| Platforms (manual) | iOS 17+ (physical device), Android 14+ (physical device) |
| Google OAuth | Requires **custom dev build** (not Expo Go) |

> [!NOTE]
> No Firebase Local Emulator Suite is configured. Automated unit tests are pure in-process logic tests that do **not** make network calls to Firebase. Network-dependent scenarios (actual Firestore reads/writes, Firebase Auth API calls) require manual test execution on physical devices.

---

## 3. Scope

### 3.1 In Scope

| Area | Description |
|---|---|
| Onboarding screens | WelcomeScreen, AuthSelectionScreen, GuestProfileSetupScreen, IntroSlidesScreen, FirstSetupSelectionScreen, OnboardingGroupCreationScreen, JoinGroupScreen |
| Authentication | Guest (anonymous), Email (sign-up + sign-in), Google OAuth |
| Account linking | Guest → Google, Guest → Email upgrade |
| Data migration | `migrateAnonymousDataToExistingGoogleAccount()` |
| Navigation routing | AppNavigator gating, OnboardingNavigator initial route computation |
| Form validation | Email format, password length, display name length, group name length |
| Persistence | AsyncStorage + Firestore dual-write for `onboardingCompleted` |
| Offline resilience | Guest session, group creation fallback, sync queue |
| Legacy compatibility | Users with `name` set but no `onboardingCompleted` field |
| Notification permissions | `initLocalNotifications()` early-request behaviour |
| Security rules | Firestore rule audit |
| Duplicate request prevention | Loading-flag guards on all auth buttons |

### 3.2 Out of Scope

| Item | Reason |
|---|---|
| MainNavigator screens (Groups, Expenses, Settlements, etc.) | Covered by separate test suites |
| Push notification delivery | Covered by `tests/notifications.test.ts` |
| Balance calculation logic | Covered by `tests/balanceCalculator.test.ts` |
| Export / PDF generation | Covered by separate test suite |
| i18n / locale selection beyond routing | Covered by `tests/i18n.test.ts` |
| App Store / Play Store submission | Out of QA scope |
| Performance / load testing | Not applicable to onboarding |
| Accessibility (a11y) audit | Scheduled for separate accessibility sprint |

---

## 4. Test Categories & Case Counts

| # | Category | Automated | Manual | Total | Status |
|---|---|---|---|---|---|
| 1 | Guest Authentication | 8 | 2 | 10 | ✅ Auto PASS |
| 2 | Google Authentication | 5 | 3 | 8 | ✅ Auto PASS / Manual TBD |
| 3 | Email Authentication | 11 | 2 | 13 | ✅ Auto PASS |
| 4 | Auth Provider Detection | 4 | 0 | 4 | ✅ Auto PASS |
| 5 | Sign-out Behaviour | 4 | 1 | 5 | ✅ Auto PASS |
| 6 | Guest Session Lifecycle | 6 | 4 | 10 | ✅ Auto PASS |
| 7 | Profile Completion Flow | 5 | 2 | 7 | ✅ Auto PASS |
| 8 | Session Restoration | 3 | 2 | 5 | ✅ Auto PASS |
| 9 | Cross-User Data Isolation | 3 | 1 | 4 | ✅ Auto PASS |
| 10 | Offline Resilience | 4 | 3 | 7 | ✅ Auto PASS |
| 11 | Google Credential Linking | 11 | 2 | 13 | ✅ Auto PASS |
| 12 | Email Credential Linking | 3 | 0 | 3 | ✅ Auto PASS |
| 13 | Credential Conflict Migration | 5 | 1 | 6 | ✅ Auto PASS |
| 14 | Photo Preservation | 4 | 1 | 5 | ✅ Auto PASS |
| 15 | Navigation Routing | 9 | 2 | 11 | ✅ Auto PASS |
| 16 | Form Validation | 15 | 0 | 15 | ✅ Auto PASS |
| 17 | Duplicate Request Prevention | 4 | 0 | 4 | ✅ Auto PASS |
| 18 | Legacy User Compatibility | 3 | 0 | 3 | ✅ Auto PASS |
| 19 | Notification Permission Policy | 2 | 2 | 4 | ✅ Auto PASS |
| 20 | Security Rules Audit | 1 | 1 | 2 | ❌ BUG-001 |
| **TOTAL** | | **110** | **29** | **139** | |

---

## 5. Entry Criteria

Before testing commences the following must be satisfied:

- [ ] Codebase compiles with **zero TypeScript errors** (`tsc --noEmit`)
- [ ] All 12 existing test suites pass (`npm test`)
- [ ] `docs/qa/onboarding/` directory exists
- [ ] At least one physical iOS and one physical Android device available for manual testing
- [ ] Firebase project `money-manager-b394e` is accessible
- [ ] Google OAuth custom dev build is available on test devices

---

## 6. Exit Criteria

Testing is considered complete when all of the following are satisfied:

- [ ] All 110 automated unit tests pass
- [ ] All manual test cases marked PASS or BLOCKED (with documented justification)
- [ ] All P0 bugs resolved or formally accepted as known risks by the product owner
- [ ] All P1 bugs resolved or have an agreed remediation date
- [ ] BUG-001 (Firestore open rules) is either fixed or a waiver is approved in writing
- [ ] Test results documents are reviewed and signed off

---

## 7. Risk Matrix

| Risk ID | Risk Description | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|---|
| R-001 | Firestore open rules expose all user data | High | Critical | **P0** | Replace rules with auth-scoped rules before release |
| R-002 | Google Sign-In fails in Expo Go builds | High | High | P1 | Friendly error shown; custom build required for testing |
| R-003 | Anonymous data migration loses expense splits | Low | High | P1 | `arrayUnion` used; tested in account-linking suite |
| R-004 | Migration not idempotent — running twice could double-add memberIds | Low | Medium | P2 | `arrayUnion` is set-semantic; partial mitigation confirmed |
| R-005 | Notification permission prompt at first launch (before user opts in to notifications) | Medium | Low | P2 | UX concern; `initLocalNotifications()` called at App root |
| R-006 | AsyncStorage key collision between users sharing a device | Low | Medium | P2 | Keys scoped by UID; confirmed in isolation tests |
| R-007 | Splash screen flicker if `isLoading` resolves slowly | Low | Low | P3 | `SplashScreen.hideAsync()` deferred until `!isLoading` |
| R-008 | Back navigation from AuthSelection → Welcome loses form state | Low | Low | P3 | Modal dismisses cleanly; no state loss |

---

## 8. Bug Register (Open)

| Bug ID | Severity | Status | Description | Affected File |
|---|---|---|---|---|
| BUG-001 | P0 | 🔴 OPEN | `firestore.rules` — `allow read, write: if true` on entire namespace | `firestore.rules` |
| BUG-002 | P2 | 🟡 OPEN | `migrateAnonymousDataToExistingGoogleAccount()` not explicitly idempotent | `src/services/auth.ts` |
| BUG-003 | P2 | ✅ FIXED | Email validation allowed consecutive dots in local part (e.g. `a..b@c.com`) | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| BUG-004 | P2 | 🟡 OPEN | `initLocalNotifications()` requests OS notification permission on first launch unconditionally | `src/services/localNotificationService.ts` |

---

## 9. Assumptions & Constraints

1. **No Firebase Emulator**: All automated tests are pure unit/logic tests. Network integration tests require manual execution.
2. **Production Firebase**: Tests run against the production Firebase project. No test data isolation is configured.
3. **Google Sign-In**: Only testable in a custom Expo dev build. Expo Go cannot support Google OAuth.
4. **AsyncStorage**: Mocked in unit tests; real persistence tested manually on device.
5. **Platform-specific haptics**: Not validated in automated tests; iOS and Android haptic feedback tested manually.
6. **Device-level OS permissions**: Notification permission prompts are OS-controlled and require manual test execution.

---

## 10. Test Schedule Overview

| Phase | Activity | Estimated Duration |
|---|---|---|
| Phase 1 | Automated unit test execution & fix cycle | 2 days |
| Phase 2 | Manual authentication testing (iOS) | 1 day |
| Phase 3 | Manual authentication testing (Android) | 1 day |
| Phase 4 | Account-linking & migration manual tests | 1 day |
| Phase 5 | Navigation edge-case & app-kill tests | 0.5 days |
| Phase 6 | Security rules fix & re-test | 1 day |
| Phase 7 | Sign-off review & document finalisation | 0.5 days |
| **Total** | | **~7 days** |

---

## 11. Tools & Frameworks Used

| Tool | Purpose |
|---|---|
| `tsx` / Node.js 20 | TypeScript test execution without compilation step |
| `assert` (Node built-in) | Test assertion library |
| TypeScript `tsc --noEmit` | Static type checking (0 errors confirmed) |
| Expo Dev Build | Custom native build for Google OAuth testing |
| Firebase Console | Manual verification of Firestore writes |
| React Native Debugger | Manual navigation and state inspection |
| Physical iOS device (iOS 17+) | Manual auth, haptics, notification prompt tests |
| Physical Android device (Android 14+) | Manual auth, haptics, notification prompt tests |

---

## 12. References

| File | Description |
|---|---|
| [`tests/onboardingQA.test.ts`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/tests/onboardingQA.test.ts) | Comprehensive 101-test automated suite |
| [`tests/onboardingFlow.test.ts`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/tests/onboardingFlow.test.ts) | Navigation flow and guest auth (9 tests) |
| [`src/services/auth.ts`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/src/services/auth.ts) | Authentication service implementation |
| [`src/context/AuthContext.tsx`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/src/context/AuthContext.tsx) | Auth context providing hooks to screens |
| [`src/navigation/AppNavigator.tsx`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/src/navigation/AppNavigator.tsx) | Top-level navigator gating logic |
| [`src/navigation/OnboardingNavigator.tsx`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/src/navigation/OnboardingNavigator.tsx) | Onboarding stack with computed initial route |
| [`firestore.rules`](file:///Users/prashilwadkar/Documents/Project/splitwiser/splitwiser/firestore.rules) | Firestore security rules (P0 issue) |
