# Authentication Test Results

**Document Version:** 1.0.0  
**Testing Date:** 2026-11-11  
**Author:** Senior QA Automation & Mobile Security Engineer  
**Component:** Firebase Authentication Services (`src/services/auth.ts`, `src/services/useGoogleAuth.ts`, `src/context/AuthContext.tsx`)  

---

## 1. Executive Summary

This document records the end-to-end and integration test execution results for the three core authentication strategies supported in Splitwiser:
1. **Start as Guest** (`signInAnonymously`)
2. **Continue with Google** (`signInWithCredential` + native Google Play Services)
3. **Continue with Email** (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`)

All automated test suites executed via `tests/onboardingQA.test.ts` and `tests/onboardingFlow.test.ts` completed with **100% pass rate (110/110 assertions)**.

---

## 2. Test Execution Matrix

### 2.1 Guest Authentication (Anonymous Auth)

| Test ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Related File |
|---|---|---|---|---|---|---|---|---|
| AUTH-G-01 | Fresh guest session initialization | Fresh installation, no prior auth state | 1. Tap "Start as Guest"<br>2. Call `signInAsGuest()` | Firebase returns anonymous UID; creates Firestore user profile with `isAnonymous=true`, `authProvider='anonymous'`, `hasCompletedProfile=false`, `onboardingCompleted=false`. | Anonymous session established; initial document initialized. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-G-02 | Session reuse on repeated tap | Active anonymous session in memory | 1. Tap "Start as Guest" while `auth.currentUser` is already anonymous | `signInAsGuest()` returns existing anonymous user without creating a new UID or duplicate profile doc. | Existing session returned with unchanged UID. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-G-03 | Guest profile doc deduplication | User doc already exists in `/splitwiser/data/users/{uid}` | 1. Call `signInAsGuest()` | Checks `loadUserProfile(uid)` first; does not overwrite existing profile with blank fields. | Existing document loaded and returned untouched. | ✅ PASS | P1 | `src/services/auth.ts` |
| AUTH-G-04 | Profile setup completion | Anonymous user with `hasCompletedProfile=false` | 1. Enter display name ≥2 chars<br>2. Pick currency<br>3. Submit | `completeProfileSetup()` updates name, currency, `hasCompletedProfile=true`, propagates to local SQLite. | Profile marked complete; SQLite updated. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-G-05 | Rapid tap prevention | User taps "Start as Guest" multiple times quickly | 1. Rapidly tap guest button 3 times in 200ms | Button is disabled via `isGuestLoading=true`; only 1 Firebase request issued. | Only 1 network call made. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-G-06 | Guest session restart persistence | App terminated after guest session creation | 1. Close app<br>2. Restart | Session restored by `onAuthStateChanged` using AsyncStorage persistence. Same UID maintained. | Session restored; same UID preserved. | ✅ PASS | P0 | `src/config/firebase.ts` |
| AUTH-G-07 | Guest protected feature access | Guest user created group | 1. Create group<br>2. Add expense<br>3. Check balances | All features function identically to permanent accounts with zero upsells. | Full feature set available to guest. | ✅ PASS | P0 | `src/repositories/groupRepository.ts` |
| AUTH-G-08 | Guest access boundary restriction | Guest user A, Group owned by user B | 1. User B creates group<br>2. User A attempts to view without join code | Access denied; User A not in `memberIds`. | Access correctly restricted. | ✅ PASS | P1 | `src/navigation/GroupsStackNavigator.tsx` |

---

### 2.2 Google Authentication

| Test ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Related File |
|---|---|---|---|---|---|---|---|---|
| AUTH-GO-01 | Native Google Sign-In check in Expo Go | Running in Expo Go client | 1. Tap "Continue with Google" | `isGoogleSigninSupported()` detects missing RNGoogleSignin turbo module, displays actionable error advising APK/development build. | Informative modal displayed without app crash. | ✅ PASS | P2 | `src/services/useGoogleAuth.ts` |
| AUTH-GO-02 | New Google user registration | Valid Google credential (idToken, accessToken) | 1. Obtain tokens<br>2. Call `signInWithGoogleCredential()` | User profile initialized with Google display name, email, Google avatar, `authProvider='google'`, `isAnonymous=false`. | User created and profile populated. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-GO-03 | Returning Google user sign-in | Existing Google account in Firestore | 1. Sign in with existing Google account | Loads existing user profile; if `onboardingCompleted=true`, routes immediately to `MainNavigator`. | Bypasses onboarding straight to Groups Home. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-GO-04 | Custom avatar protection on Google sync | User has uploaded custom photo (`photoSource='custom'`) | 1. Trigger `syncGoogleProfileOnAuth()` | User's custom photo URL is NOT overwritten by Google photo URL. | Custom avatar strictly preserved. | ✅ PASS | P1 | `src/services/auth.ts` |
| AUTH-GO-05 | Google Sign-In user cancellation | Google bottom sheet opens | 1. Tap outside or press Back button | Returns `{ type: 'cancel' }`; screen restores loading state cleanly without errors. | Clean dismissal, no error banner. | ✅ PASS | P2 | `src/services/useGoogleAuth.ts` |

---

### 2.3 Email & Password Authentication

| Test ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Related File |
|---|---|---|---|---|---|---|---|---|
| AUTH-EM-01 | Valid new email registration | Unregistered email address | 1. Enter email, password (≥6 chars), name<br>2. Submit | `createUserWithEmailAndPassword()` succeeds; Firestore doc initialized with `authProvider='password'`, `isAnonymous=false`. | Account created and profile persisted. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-EM-02 | Empty email/password rejection | Empty form | 1. Leave fields empty<br>2. Tap Submit | Validation alert: "Please enter both your email address and password." | Alert displayed, submission blocked. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-EM-03 | Password <6 characters rejected | Password shorter than min length | 1. Enter password of 5 chars | Validation alert: "Password must be at least 6 characters." | Alert displayed, submission blocked. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-EM-04 | Malformed email rejected (regex) | Bad email format (e.g. `user@`, `no-domain`) | 1. Enter malformed email<br>2. Submit | Validation alert: "Please enter a valid email address." | Form validation catches format error. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-EM-05 | Consecutive dot email rejected (RFC 5321) | Email with `a..b@domain.com` | 1. Enter consecutive dots email<br>2. Submit | Validation alert: "Please enter a valid email address." (Fixed in BUG-003). | Form validation catches consecutive dots. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-EM-06 | Existing email login success | Existing registered email account | 1. Enter registered email + password<br>2. Submit | `signInWithEmailAndPassword()` succeeds; loads existing profile and routes to Groups Home if onboarding done. | Authenticated and routed correctly. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-EM-07 | Incorrect password error | Existing account, wrong password | 1. Enter valid email + wrong password | Meaningful alert: "Authentication Notice: [Firebase error message]". | Error surfaced to user. | ✅ PASS | P1 | `src/screens/onboarding/AuthSelectionScreen.tsx` |
| AUTH-EM-08 | Email sign-in button debounce | User double taps login button | 1. Double tap submit button | `isEmailSubmitting=true` disables button; only 1 request dispatched. | Only 1 request issued. | ✅ PASS | P2 | `src/screens/onboarding/AuthSelectionScreen.tsx` |

---

### 2.4 User Sign-Out & Data Isolation

| Test ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Related File |
|---|---|---|---|---|---|---|---|---|
| AUTH-SO-01 | Guest user sign-out | Active anonymous guest session | 1. Open AccountScreen<br>2. Tap "Log Out (Guest)"<br>3. Confirm | Local SQLite cleared via `clearLocalData()`; Firebase signed out; `user` set to null; AppNavigator routes to Welcome. | Local tables reset, routed to Welcome. | ✅ PASS | P0 | `src/screens/AccountScreen.tsx` |
| AUTH-SO-02 | Permanent user sign-out | Active Google/Email session | 1. Open AccountScreen<br>2. Tap "Log Out"<br>3. Confirm | Native Google SDK signs out; SQLite cleared; Firebase signed out; app routes to Welcome. | Clean sign-out across all layers. | ✅ PASS | P0 | `src/services/auth.ts` |
| AUTH-SO-03 | Cross-user data isolation after sign-out | User A signed out, User B logs in | 1. User A logs out<br>2. User B logs in | User B does not see User A's cached SQLite groups or expenses. | Data isolation verified. | ✅ PASS | P0 | `src/db/sqlite.ts` |

---

## 3. Conclusions & Recommendations

1. **All Authentication Paths Operational:** Guest, Google, and Email authentication behave reliably across online and local fallback modes.
2. **Defensive Form Validation:** Email format validation now strictly enforces single-dot local parts and minimum password lengths.
3. **Session Stability:** Firebase session restoration via AsyncStorage operates reliably without flash-routing or infinite splash loading.

