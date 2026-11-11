# Onboarding Navigation Audit

**Document Version:** 1.0.0  
**Testing Date:** 2026-11-11  
**Author:** Senior QA Automation & Mobile Security Engineer  
**Component:** Screen Architecture & Navigation Flows (`src/navigation/AppNavigator.tsx`, `src/navigation/OnboardingNavigator.tsx`, `src/screens/onboarding/*`)  

---

## 1. Screen Inventory & Flow Diagram

### 1.1 Complete Screen List

| Screen Name | File Path | Purpose | Key CTAs / Controls |
|---|---|---|---|
| **Welcome** | `src/screens/onboarding/WelcomeScreen.tsx` | App introduction, brand emblem & tagline | "Get Started" (navigates to AuthSelection `signup`), "Log in" (navigates to AuthSelection `login`) |
| **AuthSelection** | `src/screens/onboarding/AuthSelectionScreen.tsx` | Select authentication method | "Start as Guest" (prominent card), "Continue with Google", "Continue with Email" (modal sheet) |
| **GuestProfileSetup** | `src/screens/onboarding/GuestProfileSetupScreen.tsx` | Enter display name, optional avatar, pick currency | Display name input (≥2 chars), circular photo picker, currency selector, "Continue" button |
| **IntroSlides** | `src/screens/onboarding/IntroSlidesScreen.tsx` | 3 interactive Splitwise-style walkthrough slides | "Skip" (top header), Pager dots `[●][○][○]`, "Continue" (slides 1–2), "Get Started" (slide 3) |
| **FirstSetupSelection** | `src/screens/onboarding/FirstSetupSelectionScreen.tsx` | "What would you like to do first?" decision screen | Apartment card, Trip card, Friends card, Join Group card, "Skip setup for now" |
| **OnboardingGroupCreation**| `src/screens/onboarding/OnboardingGroupCreationScreen.tsx`| Lightweight first group creation | Group name input (pre-filled), group type pills, currency selector, "Create Group", "Skip" |
| **JoinGroup** | `src/screens/JoinGroupScreen.tsx` | Enter 6-character code to join existing group | 6-char input, "Join Group" CTA (marks onboarding done via `isOnboarding=true` param) |

---

### 1.2 Navigation Flow Architecture

```
                       ┌─────────────────────────┐
                       │     1. WelcomeScreen    │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  2. AuthSelectionScreen │
                       └────────────┬────────────┘
                                    │
                                    ├─── [Start as Guest] ───┐
                                    ├─── [Email / Google] ───┤
                                    │                        │
                       ┌────────────▼────────────┐           │
                       │ 3. GuestProfileSetup    │ ◄─────────┘
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
             ┌─────────┤    4. IntroSlides       │
             │ (Skip)  └────────────┬────────────┘
             │                      │ (Continue / Finish)
             │         ┌────────────▼────────────┐
             └────────►│ 5. FirstSetupSelection  ├────────────────────────┐
                       └─────┬─────────────┬─────┘                        │
                             │             │                              │ (Skip setup for now)
            ┌────────────────┘             └────────────────┐             │
            ▼                                               ▼             │
┌─────────────────────────┐                     ┌───────────────────────┐ │
│ 6. GroupCreation        │                     │ 7. JoinGroupScreen    │ │
│ (Apartment/Trip/Friends)│                     │ (6-char code input)   │ │
└───────────┬─────────────┘                     └───────────┬───────────┘ │
            │                                               │             │
            └───────────────────────┬───────────────────────┘             │
                                    │                                     │
                                    ▼                                     │
                       ┌─────────────────────────┐                        │
                       │ Groups Home (Main)      │ ◄──────────────────────┘
                       └─────────────────────────┘
```

---

## 2. Navigation Routing & Gating Matrix

### 2.1 AppNavigator Session Gating

The root navigator in `src/navigation/AppNavigator.tsx` evaluates user session state before mounting screens:

```tsx
const isReadyUser = Boolean(user && user.hasCompletedProfile && user.onboardingCompleted);
```

| User State | Condition Evaluated | Route Rendered | Behavior |
|---|---|---|---|
| Brand new visitor | `!user` | `<Stack.Screen name="Onboarding" component={OnboardingNavigator} />` | Boots at `WelcomeScreen`. |
| Fresh guest / incomplete profile | `user && !user.hasCompletedProfile` | `<Stack.Screen name="Onboarding" component={OnboardingNavigator} />` | `initialRouteName` in `OnboardingNavigator` resolves to `GuestProfileSetupScreen`. |
| Profile done, onboarding in-progress | `user && user.hasCompletedProfile && !user.onboardingCompleted` | `<Stack.Screen name="Onboarding" component={OnboardingNavigator} />` | `initialRouteName` in `OnboardingNavigator` resolves to `IntroSlidesScreen`. |
| Fully onboarded returning user | `user && user.hasCompletedProfile && user.onboardingCompleted` | `<Stack.Screen name="Main" component={MainNavigator} />` | Renders `MainNavigator` (Groups Home) immediately with zero onboarding flash. |

---

### 2.2 Skip Functionality Verification

| Screen | Skip Action | Target Destination | Persistence Triggered | Result |
|---|---|---|---|---|
| `IntroSlidesScreen` | Top-right "Skip" button | `FirstSetupSelection` | None (allows choosing first action or skipping setup entirely) | ✅ Clean transition |
| `FirstSetupSelectionScreen` | "Skip for now" header button & bottom text CTA | `MainNavigator` (Groups Home) | Calls `finishOnboarding()`; updates Firestore & AsyncStorage | ✅ User immediately lands on dashboard |
| `OnboardingGroupCreationScreen`| Top-right "Skip" button | `MainNavigator` (Groups Home) | Calls `finishOnboarding()`; bypasses group creation | ✅ User immediately lands on dashboard |
| `JoinGroupScreen` (via onboarding)| Successful group join with `route.params.isOnboarding=true` | `GroupDetails` / `MainNavigator` | Calls `finishOnboarding()` | ✅ Group joined and onboarding marked done |

---

### 2.3 Edge Cases & Crash Resilience

1. **Back Navigation Traps:**
   - `WelcomeScreen`: Root screen, Android back button exits app cleanly.
   - `AuthSelectionScreen`: Top-left ArrowLeft returns cleanly to `WelcomeScreen`.
   - `IntroSlidesScreen`: Header has no back arrow; prevents backwards transition to completed auth steps while forward progress is clear.
   - `OnboardingGroupCreationScreen`: ChevronLeft returns cleanly to `FirstSetupSelectionScreen`.

2. **Process Kill & Cold Boot Recovery:**
   - Killing app on `Welcome` → Reopens at `Welcome`.
   - Killing app during `GuestProfileSetup` → Reopens at `GuestProfileSetup` (session restored, profile completed flag evaluated).
   - Killing app during `IntroSlides` → Reopens at `IntroSlides` (user not reset back to Welcome or name input).
   - Killing app after completing onboarding → Reopens directly at Groups Home.

3. **No Infinite Navigation Loops:**
   - All state transitions use explicit Stack navigation or reactive `user` state flips in `AppNavigator`, preventing loop recursion.

