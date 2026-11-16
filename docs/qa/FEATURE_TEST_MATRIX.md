# Splitwiser 2.0.1 — Complete Feature Inventory & QA Test Matrix

**Document Version**: 2.0.1  
**Audit Date**: November 16, 2026  
**Auditor**: QA Phase 1 Lead Auditor (`@auditor`)  
**Repository Scope**: `/Users/prashilwadkar/Documents/Project/splitwiser/splitwiser`  
**Overall Codebase Status**: Highly mature, 100% test pass rate across 14 test suites (110 QA unit tests, 26 E2E QC checks).  

---

## Executive Summary

A comprehensive inventory audit of all screens, UI components, navigation stacks, Firebase backend integrations, local SQLite repositories, synchronization queues, financial algorithms, authentication flows, permissions, internationalization resources, and dependencies was conducted.

### Audit Statistics
- **Screens Audited**: 19 screens (13 main/feature screens + 6 onboarding screens)
- **Components Audited**: 51 components (22 common, 3 expense-specific, 10 group settings, 1 notification banner, 3 security, 2 settings, 10 haptics/UI)
- **Navigation Routes Audited**: 6 navigators across 20+ distinct screen route definitions
- **Services & Repositories**: 29 service modules, 4 SQLite local repositories, 3 offline sync modules
- **Calculations & Math Utilities**: 7 utility modules (Debt minimization, 6 split math algorithms, currency conversion, image compression)
- **Auth Methods**: 4 authentication workflows (Guest/Anonymous, Google OAuth, Email/Password, Account Migration & Linking)
- **Permissions Managed**: 5 native permission domains (Camera, Photo Library, Biometrics/Local Auth, Push/Local Notifications, App-Level Member Permissions)
- **Existing Test Suites**: 14 test suites, all passing with zero failures
- **Translations (i18n)**: 8 supported locales across 15 domain namespaces (463–467 keys per locale, >3,700 total translation keys)
- **External Dependencies**: 29 direct production dependencies and 3 dev dependencies

---

## Status Legend
| Symbol | Status | Definition |
| :---: | :--- | :--- |
| ✅ | **Implemented** | Fully functional, connected to backend / local storage, verified with unit/integration tests |
| ⚠️ | **Partial** | UI and partial logic exist, but specific edge cases, platform limitations, or stubs are present |
| 🎨 | **UI Only** | Screen or component renders correctly but has dummy data or unhooked event listeners |
| ❌ | **Not Implemented** | Missing feature, placeholder component, or planned stub |
| 🗑️ | **Deprecated** | Legacy code retained for backwards compatibility but superseded by newer modules |

---

## 1. Screens Inventory (19 Screens)

| # | Screen Name | File Path | Status | Key Features & Backend Connection | Gaps / Stubs / Notes |
|---|-------------|-----------|:------:|-----------------------------------|----------------------|
| 1 | **Home Screen** | `src/screens/HomeScreen.tsx` | ✅ | Dashboard total balance card (owed/owe/net), group list with custom cover photos, search filter, filter chips (All, Owed, You Owe), QR code scan shortcut, pull-to-refresh SQLite & Firestore sync. | None. Fully wired to `groupRepository`, `syncQueue`, and `NotificationContext`. |
| 2 | **Group Details Screen** | `src/screens/GroupDetailsScreen.tsx` | ✅ | Group cover banner, total group spend, balance summary, debt simplification toggle, bilateral debt settlement list, expense list with category icons and soft-delete/restore, member avatar chips. | Edge case: in 0-expense or circular debt groups, settlement list is empty (handled gracefully with UI empty state). |
| 3 | **Add / Edit Expense Screen** | `src/screens/AddExpenseScreen.tsx` | ✅ | Real-time split calculation for 6 split modes (Equal, Percentage, Exact, Shares, Adjustments, Itemized), 23-category auto-detection, multi-payer support (`payer:uid:amt`), receipt photo attachment with compression, local SQLite save + background sync queue enqueue. | Offline-first with fallback. |
| 4 | **Create Group Screen** | `src/screens/CreateGroupScreen.tsx` | ✅ | Group creation with name input, 7 group types (Home, Trip, Couple, Project, Event, Other), default currency selector, preset cover selector or custom image picker upload. Local SQLite creation + Firestore sync. | Name validated (min 2, max 50 chars). |
| 5 | **Group Settings Screen** | `src/screens/GroupSettingsScreen.tsx` | ✅ | Edit group info, member management (add, remove, permissions), balance reminders dispatch, export group to CSV / text summary, cover photo picker, notifications toggle, activity audit log, leave/delete group. | Typed confirmation dialog enforced for group deletion. |
| 6 | **Friends Screen** | `src/screens/FriendsScreen.tsx` | ✅ | Friends directory, total net balance across all friends, individual friend debt cards, search/filter, Add Friend modal, QR scanner shortcut, pull-to-refresh. | Fully wired to `friendRepository` and `friendService`. |
| 7 | **Friend Details Screen** | `src/screens/FriendDetailsScreen.tsx` | ✅ | Bilateral balance breakdown across direct expenses and shared groups, direct expense history, settle-up modal with payment notes, phone/message quick links. | Accurately distinguishes direct bilateral debt from shared group debt. |
| 8 | **Statistics Screen** | `src/screens/StatisticsScreen.tsx` | ✅ | Monthly spending bar chart, category donut chart, top spending category breakdowns, group expenditure breakdown, date filters (This Month, Prev Month, All Time). | Pure SVG chart rendering without heavy external chart libraries. |
| 9 | **Account Screen** | `src/screens/AccountScreen.tsx` | ✅ | User profile display, avatar upload/picker, Google account linking for guest users, App Lock & Biometrics toggle, theme selector (Light/Dark/System), language selector (8 languages), support ticket submission, QR code sharing, logout. | Includes Google sign-in native link fallback. |
| 10 | **Edit Profile Screen** | `src/screens/EditProfileScreen.tsx` | ✅ | Edit display name, change default currency, upload avatar photo with compression, view linked authentication provider, guest warning banner. | Changes sync immediately to local SQLite, Firestore, and active session. |
| 11 | **Join Group Screen** | `src/screens/JoinGroupScreen.tsx` | ✅ | Join group by entering 6-character alphanumeric code or scanning QR code; verifies group existence, adds user to member list, initiates sync. | Auto-capitalizes input code; trims whitespace. |
| 12 | **Notification Center Screen** | `src/screens/NotificationCenterScreen.tsx` | ✅ | Filter tabs (All, Unread, Expenses, Settlements), mark as read, clear all, deep link navigation on tap via `notificationRouter`. | Backed by Firestore user notification subcollection and local notifications. |
| 13 | **Onboarding Screen (Wrapper)** | `src/screens/OnboardingScreen.tsx` | ✅ | Modern container wrapping `OnboardingNavigator`. Retained as a screen module. | Top-level entry component routing to the multi-screen flow. |
| 14 | **Welcome Screen** | `src/screens/onboarding/WelcomeScreen.tsx` | ✅ | Splitwise-branded welcome screen with logo, tagline, "Get Started" and "Log In" primary actions. | Responsive safe area padding. |
| 15 | **Auth Selection Screen** | `src/screens/onboarding/AuthSelectionScreen.tsx` | ✅ | Choose Guest Mode (instant anonymous sign-in), Google Sign-In, or Email/Password registration & login modals. Debounced buttons. | Disables buttons while auth promise resolves to avoid race conditions. |
| 16 | **Guest Profile Setup Screen** | `src/screens/onboarding/GuestProfileSetupScreen.tsx` | ✅ | Post-guest sign-in setup: Name input, avatar selection (photo picker or default avatars), default currency selection. | Enforces minimum 2 character name validation. |
| 17 | **Intro Slides Screen** | `src/screens/onboarding/IntroSlidesScreen.tsx` | ✅ | 3 interactive walkthrough slides explaining Splitwiser features with pagination indicators, Skip button, and Next/Finish action. | Skip navigates directly to `FirstSetupSelection`. |
| 18 | **First Setup Selection Screen** | `src/screens/onboarding/FirstSetupSelectionScreen.tsx` | ✅ | Splitwise-style "What would you like to do first?" with quick templates: "Apartment", "Trip", "Friends", or "Skip setup for now". | Pre-seeds group metadata for the subsequent group creation screen. |
| 19 | **Onboarding Group Creation Screen** | `src/screens/onboarding/OnboardingGroupCreationScreen.tsx` | ✅ | Pre-filled group creation screen based on template selected in screen 18, with group type, currency, and custom cover picker. | Offline fallback to SQLite if offline during onboarding. |

---

## 2. UI Components Inventory (51 Components)

### 2.1 Common Components (22 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 1 | `AddFriendModal` | `src/components/common/AddFriendModal.tsx` | ✅ | Modal for adding friends by email or username, with validation. | Emits haptic success notification. |
| 2 | `AmountInput` | `src/components/common/AmountInput.tsx` | ✅ | Financial amount input with dynamic currency symbol, numeric validation, max limit checks. | Validates against `APP_LIMITS.MAX_FINANCIAL_AMOUNT` (₹1 Billion). |
| 3 | `AppHeader` | `src/components/common/AppHeader.tsx` | ✅ | Header with back navigation, page title, optional notification bell with unread badge counter. | Connected to `NotificationContext`. |
| 4 | `BalanceCard` | `src/components/common/BalanceCard.tsx` | ✅ | Dynamic balance card displaying "You are owed", "You owe", or "Settled up" with color-coded typography. | Adapts to light/dark theme tokens. |
| 5 | `CategoryIcon` | `src/components/common/CategoryIcon.tsx` | ✅ | Visual icon badge for 23 expense categories with curated background tint and category auto-detection. | Powered by `categoryDetector` service. |
| 6 | `ConfirmationDialog` | `src/components/common/ConfirmationDialog.tsx` | ✅ | Standard alert dialog for non-destructive or destructive confirmations. | Haptic feedback integrated. |
| 7 | `ConnectGoogleModal` | `src/components/common/ConnectGoogleModal.tsx` | ✅ | Promotional modal urging guest users to link Google account to prevent data loss. | Triggers `linkGoogleAccount` in `AuthContext`. |
| 8 | `EmptyState` | `src/components/common/EmptyState.tsx` | ✅ | Clean empty state placeholder with Lucide icon, headline, subtext, and call-to-action button. | Used across Groups, Friends, Activity, and Notifications. |
| 9 | `ExpenseListItem` | `src/components/common/ExpenseListItem.tsx` | ✅ | Expense item row showing category icon, description, paid by, date, total amount, and user's net share. | Handles soft-deleted state visually. |
| 10 | `GoogleIcon` | `src/components/common/GoogleIcon.tsx` | ✅ | Multi-color vector Google "G" logo for authentication buttons. | Native SVG implementation. |
| 11 | `GroupCard` | `src/components/common/GroupCard.tsx` | ✅ | Dashboard card displaying group cover banner, group name, member count, and user's balance. | Memoized for high performance in large lists. |
| 12 | `GroupCoverHeader` | `src/components/common/GroupCoverHeader.tsx` | ✅ | Banner header for `GroupDetailsScreen` featuring preset art or user uploaded photo. | Smooth fallback gradient when image fails to load. |
| 13 | `GroupCoverPhotoModal` | `src/components/common/GroupCoverPhotoModal.tsx` | ✅ | Cover gallery modal with 29 curated preset covers across 8 categories, plus Camera / Gallery picker. | Compresses uploaded covers before saving. |
| 14 | `MemberAvatar` | `src/components/common/MemberAvatar.tsx` | ✅ | Avatar component supporting custom photo URLs, user initials, or Splitwise-style two-tone fallback. | Gracefully handles broken image URLs. |
| 15 | `MonthlyTrendsChart` | `src/components/common/MonthlyTrendsChart.tsx` | ✅ | Custom SVG bar chart visualizing 6-month historical spending trend. | Pure React Native SVG without web-only dependencies. |
| 16 | `ProfilePhotoModal` | `src/components/common/ProfilePhotoModal.tsx` | ✅ | Action sheet modal for taking a photo, choosing from library, or removing current profile photo. | Permissions requested before camera/gallery launch. |
| 17 | `QrCodeModal` | `src/components/common/QrCodeModal.tsx` | ✅ | Two-tab modal: Tab 1 generates QR code for joining group; Tab 2 opens `CameraView` to scan QR code. | Camera permission checked with informative fallback alert. |
| 18 | `SettleUpModal` | `src/components/common/SettleUpModal.tsx` | ✅ | Modal for recording settlements between two members with amount, payment mode, and optional notes. | Pre-fills outstanding balance automatically. |
| 19 | `SpendingDonutChart` | `src/components/common/SpendingDonutChart.tsx` | ✅ | Custom SVG donut chart visualizing proportional category expenditures. | Renders interactive category breakdown legend. |
| 20 | `StatusBadge` | `src/components/common/StatusBadge.tsx` | ✅ | Chip badge indicating sync status (`synced`, `pending`, `failed`) and settlement status. | Color-coded according to theme tokens. |
| 21 | `TypedConfirmDialog` | `src/components/common/TypedConfirmDialog.tsx` | ✅ | High-security confirmation dialog requiring the user to type the group name before deletion. | Prevents accidental deletion of groups with active debts. |
| 22 | `Common Barrel (index.ts)` | `src/components/common/index.ts` | ✅ | Barrel export file for common components. | Clean re-exports. |

### 2.2 Expense Components (3 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 23 | `ParticipantRow` | `src/components/expense/ParticipantRow.tsx` | ✅ | Interactive row for each participant in `SplitConfigurationModal` showing percentage, shares, exact amount, or checkbox. | Updates parent split state instantly. |
| 24 | `PayerSelectionModal` | `src/components/expense/PayerSelectionModal.tsx` | ✅ | Bottom sheet modal allowing selection of single payer or multi-payer custom split with validation. | Ensures multi-payer contributions equal total expense amount. |
| 25 | `SplitConfigurationModal`| `src/components/expense/SplitConfigurationModal.tsx` | ✅ | Full split engine supporting 6 split modes: Equal, Exact, Percentage, Shares, Adjustments, and Itemized. | Enforces penny-exact validation without rounding leakage. |

### 2.3 Group Settings Components (10 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 26 | `AddMembersModal` | `src/components/groupSettings/AddMembersModal.tsx` | ✅ | Modal to add new members to group via name, friend list selection, or invite link. | Adds member locally in SQLite and queues Firestore sync. |
| 27 | `BalanceRemindersModal`| `src/components/groupSettings/BalanceRemindersModal.tsx`| ✅ | Modal allowing group admin/creditors to send in-app reminder notifications to debtors. | Dispatches via `notificationService`. |
| 28 | `CurrencySelectorModal`| `src/components/groupSettings/CurrencySelectorModal.tsx`| ✅ | Searchable modal listing world currencies (INR, USD, EUR, GBP, JPY, CAD, AUD, etc.) with symbols. | Sets group default currency. |
| 29 | `EditGroupInfoModal` | `src/components/groupSettings/EditGroupInfoModal.tsx` | ✅ | Modal to modify group name and group type. | Validates name length (2 to 50 characters). |
| 30 | `ExpensePreferencesModal`| `src/components/groupSettings/ExpensePreferencesModal.tsx`| ✅ | Modal configuring member permissions (anyone vs admin-only) and default debt simplification toggle. | Updates group settings document. |
| 31 | `GroupExportModal` | `src/components/groupSettings/GroupExportModal.tsx` | ✅ | Modal to export group transactions to CSV format or copy summary text to clipboard. | Compliant with RFC-4180 CSV standard. |
| 32 | `GroupMembersModal` | `src/components/groupSettings/GroupMembersModal.tsx` | ✅ | Member roster modal showing roles (admin, member), joined dates, and member removal option. | Prevents removing members with non-zero balances. |
| 33 | `GroupNotificationsModal`| `src/components/groupSettings/GroupNotificationsModal.tsx`| ✅ | Toggle notification types (new expense, settlement, edits, comments) specifically for this group. | Saved per-user per-group. |
| 34 | `MemberDetailsModal` | `src/components/groupSettings/MemberDetailsModal.tsx` | ✅ | Detailed view of an individual member's activity and net balance within the group. | Read-only breakdown. |
| 35 | `RecentActivityModal` | `src/components/groupSettings/RecentActivityModal.tsx` | ✅ | Audit log modal displaying historical timeline of group actions (creations, edits, settlements). | Backed by `activityService`. |

### 2.4 Notifications (1 Component)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 36 | `InAppNotificationBanner`| `src/components/notifications/InAppNotificationBanner.tsx`| ✅ | Animated top banner displaying incoming notifications with sound/haptics and tap-to-navigate. | Dismisses automatically after 4 seconds or on tap. |

### 2.5 Security Components (3 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 37 | `AppLockOverlay` | `src/components/security/AppLockOverlay.tsx` | ✅ | Fullscreen PIN lock keypad overlay blocking app UI on cold start or app resume after timeout. | Rate-limited with 30s lockout after 5 incorrect attempts. |
| 38 | `PasscodeKeypadModal` | `src/components/security/PasscodeKeypadModal.tsx` | ✅ | PIN setup/change modal requiring 4-digit input followed by PIN confirmation step. | Stores cryptographic SHA-256 hash in `SecureStore`. |
| 39 | `SecuritySettingsModal`| `src/components/security/SecuritySettingsModal.tsx`| ✅ | Settings modal for toggling Passcode, biometric unlock (FaceID/Fingerprint), and auto-lock timeout. | Hardware biometrics checked via `LocalAuthentication`. |

### 2.6 Settings Components (2 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 40 | `LanguagePickerModal` | `src/components/settings/LanguagePickerModal.tsx` | ✅ | Modal for switching among 8 languages (Arabic, English, Spanish, French, Indonesian, Portuguese, Russian, Chinese). | Persists preference to `AsyncStorage` and updates i18next dynamically. |
| 41 | `ThemePickerModal` | `src/components/settings/ThemePickerModal.tsx` | ✅ | Modal allowing selection between Light, Dark, and System Theme modes. | Syncs preference to Firestore user document. |

### 2.7 UI & Haptics Components (10 Components)
| # | Component Name | File Path | Status | Description & Connectivity | Gaps / Notes |
|---|----------------|-----------|:------:|----------------------------|--------------|
| 42 | `HapticAppbar` | `src/components/ui/HapticAppbar.tsx` | ✅ | React Native Paper Appbar wrapper triggering haptic feedback on navigation actions. | Clean wrapper. |
| 43 | `HapticButton` | `src/components/ui/HapticButton.tsx` | ✅ | Reusable Button with tactile haptic response on press. | Uses `expo-haptics`. |
| 44 | `HapticCard` | `src/components/ui/HapticCard.tsx` | ✅ | Card wrapper with touch haptics. | Smooth press state. |
| 45 | `HapticCheckbox` | `src/components/ui/HapticCheckbox.tsx` | ✅ | Checkbox with selection click haptic. | Clean wrapper. |
| 46 | `HapticFAB` | `src/components/ui/HapticFAB.tsx` | ✅ | Floating action button with haptic feedback. | Used for Add Expense and Create Group. |
| 47 | `HapticIconButton` | `src/components/ui/HapticIconButton.tsx` | ✅ | Icon button with light impact haptic feedback. | Used in headers and modal dismiss controls. |
| 48 | `HapticList` | `src/components/ui/HapticList.tsx` | ✅ | List item with feedback on tap. | Clean wrapper. |
| 49 | `HapticMenu` | `src/components/ui/HapticMenu.tsx` | ✅ | Context menu with tactile feedback on item selection. | Clean wrapper. |
| 50 | `HapticSegmentedButtons`| `src/components/ui/HapticSegmentedButtons.tsx`| ✅ | Segmented toggle control with selection haptics. | Used in split selection and date filters. |
| 51 | `hapticUtils` | `src/components/ui/hapticUtils.tsx` | ✅ | Utility functions wrapping iOS/Android haptic generators safely across platforms. | Safe on Web (no-ops cleanly). |

---

## 3. Navigation Routes Audit (`src/navigation/`)

```
AppNavigator (Root Stack)
├── InAppNotificationBanner (Global Overlay)
├── [Gated on !user || !hasCompletedProfile || !onboardingCompleted]:
│   └── OnboardingNavigator (Stack)
│       ├── Welcome (WelcomeScreen)
│       ├── AuthSelection (AuthSelectionScreen)
│       ├── GuestProfileSetup (GuestProfileSetupScreen)
│       ├── IntroSlides (IntroSlidesScreen)
│       ├── FirstSetupSelection (FirstSetupSelectionScreen)
│       ├── OnboardingGroupCreation (OnboardingGroupCreationScreen)
│       └── JoinGroup (JoinGroupScreen)
└── [Gated on user && hasCompletedProfile && onboardingCompleted]:
    ├── Main (MainNavigator - Bottom Tabs)
    │   ├── Groups (GroupsStackNavigator)
    │   │   ├── Home (HomeScreen)
    │   │   ├── CreateGroup (CreateGroupScreen)
    │   │   ├── GroupDetails (GroupDetailsScreen)
    │   │   ├── AddExpense (AddExpenseScreen)
    │   │   ├── GroupSettings (GroupSettingsScreen)
    │   │   └── JoinGroup (JoinGroupScreen)
    │   ├── Friends (FriendsStackNavigator)
    │   │   ├── FriendsHome (FriendsScreen)
    │   │   ├── FriendDetails (FriendDetailsScreen)
    │   │   ├── AddExpense (AddExpenseScreen)
    │   │   └── GroupDetails (GroupDetailsScreen)
    │   ├── Statistics (StatisticsScreen)
    │   └── Account (AccountStackNavigator)
    │       ├── AccountHome (AccountScreen)
    │       └── EditProfile (EditProfileScreen)
    └── NotificationCenter (NotificationCenterScreen - slide from right)
```

| Navigator | Route Name | Screen Component | Params / Deep Link Support | Status |
|-----------|------------|------------------|----------------------------|:------:|
| `AppNavigator` | `Main` | `MainNavigator` | `{ screen, params }` | ✅ |
| `AppNavigator` | `NotificationCenter`| `NotificationCenterScreen` | None | ✅ |
| `AppNavigator` | `Onboarding` | `OnboardingNavigator` | None | ✅ |
| `MainNavigator` | `Groups` | `GroupsStackNavigator` | `{ screen, params }` | ✅ |
| `MainNavigator` | `Friends` | `FriendsStackNavigator` | `{ screen, params }` | ✅ |
| `MainNavigator` | `Statistics` | `StatisticsScreen` | None | ✅ |
| `MainNavigator` | `Account` | `AccountStackNavigator` | `{ screen, params }` | ✅ |
| `GroupsStackNavigator` | `Home` | `HomeScreen` | None | ✅ |
| `GroupsStackNavigator` | `CreateGroup` | `CreateGroupScreen` | None | ✅ |
| `GroupsStackNavigator` | `GroupDetails`| `GroupDetailsScreen` | `{ groupId: string }` | ✅ |
| `GroupsStackNavigator` | `AddExpense` | `AddExpenseScreen` | `{ groupId, expenseId, friendId }` | ✅ |
| `GroupsStackNavigator` | `GroupSettings`| `GroupSettingsScreen` | `{ groupId: string }` | ✅ |
| `GroupsStackNavigator` | `JoinGroup` | `JoinGroupScreen` | None | ✅ |
| `FriendsStackNavigator` | `FriendsHome` | `FriendsScreen` | None | ✅ |
| `FriendsStackNavigator` | `FriendDetails`| `FriendDetailsScreen` | `{ friendId: string, friendshipId?: string }` | ✅ |
| `AccountStackNavigator` | `AccountHome` | `AccountScreen` | None | ✅ |
| `AccountStackNavigator` | `EditProfile` | `EditProfileScreen` | None | ✅ |
| `OnboardingNavigator` | `Welcome` | `WelcomeScreen` | None | ✅ |
| `OnboardingNavigator` | `AuthSelection`| `AuthSelectionScreen` | None | ✅ |
| `OnboardingNavigator` | `GuestProfileSetup`| `GuestProfileSetupScreen` | None | ✅ |
| `OnboardingNavigator` | `IntroSlides` | `IntroSlidesScreen` | None | ✅ |
| `OnboardingNavigator` | `FirstSetupSelection`| `FirstSetupSelectionScreen` | None | ✅ |
| `OnboardingNavigator` | `OnboardingGroupCreation`| `OnboardingGroupCreationScreen`| `{ initialType, initialName }` | ✅ |

---

## 4. Firebase Services, Local Repositories & Sync Pipeline

### 4.1 Firebase Services (`src/services/`)
| Service File | Primary Functions | Firestore Collections Used | Status |
|--------------|-------------------|----------------------------|:------:|
| `activityService.ts` | Logs and fetches group actions | `/splitwiser/data/groups/{id}/activities` | ✅ |
| `auth.ts` | Guest sign-in, Email signup/login, Google linking, data migration, profile updates, session wipe | `/splitwiser/data/users`, `/splitwiser/data/groups` | ✅ |
| `expenses.ts` | Remote CRUD for group expenses, soft delete, restore, notification trigger | `/splitwiser/data/groups/{id}/expenses` | ✅ |
| `exportService.ts` | RFC-4180 CSV export generator and text summary generator | In-memory formatting | ✅ |
| `friendService.ts` | Bilateral friendships, direct expenses, settle up, QR add | `/splitwiser/data/friendships` | ✅ |
| `groupCoverService.ts`| Curated preset cover catalog (29 presets), cover resolution | In-memory + storage | ✅ |
| `groupPreferencesService.ts`| Persists simplifyDebts and notification preferences | `/splitwiser/data/groups/{id}/member_preferences` | ✅ |
| `groups.ts` | Group creation, member additions, role changes, join code lookup, deletion | `/splitwiser/data/groups`, `/splitwiser/data/groups/{id}/members` | ✅ |
| `hapticsService.ts` | Global tactile feedback orchestration | Native haptics API | ✅ |
| `languageService.ts` | Firestore sync of user language preference | `/splitwiser/data/users/{uid}` | ✅ |
| `localNotificationService.ts`| Local native notifications, notification channels, deep link tap handler | `expo-notifications` | ✅ |
| `notificationRouter.ts`| Maps notification payloads to navigation routes | In-app router | ✅ |
| `notificationService.ts`| Dispatches in-app notifications to recipients with user preferences | `/splitwiser/data/users/{uid}/notifications` | ✅ |
| `securityService.ts` | Passcode hashing (SHA-256), salt generator, SecureStore persistence, biometric auth | `expo-secure-store`, `expo-local-authentication` | ✅ |
| `settlements.ts` | Records settlements, balances adjustment, notification trigger | `/splitwiser/data/groups/{id}/settlements` | ✅ |
| `support.ts` | Support ticket submission | `/splitwiser/data/support_tickets` | ✅ |
| `themeService.ts` | Appearance sync to user profile | `/splitwiser/data/users/{uid}` | ✅ |
| `useGoogleAuth.ts` | React Hook & TurboModule bridge for Google Sign-In SDK | Native RNGoogleSignin | ✅ |
| `userProfilePhotoService.ts`| Profile avatar upload to Firebase Storage, image compression | Firebase Storage: `splitwiser/users/{uid}/profile/*` | ✅ |
| `categoryDetector/*` (9 files)| 23-category classifier, rule matching, merchant lookup, multi-lingual keyword analysis | In-memory rules + learned preferences | ✅ |

### 4.2 SQLite Local Repositories (`src/repositories/`)
| Repository | Local SQLite Tables | Sync Integration | Status | Notes |
|------------|---------------------|------------------|:------:|-------|
| `expenseRepository.ts` | `local_expenses` | Enqueues to `sync_queue` | ⚠️ | Fully implemented, but directly calls `getDatabase()` without web check (see Key Gaps). |
| `groupRepository.ts` | `local_groups`, `local_group_members` | Enqueues to `sync_queue` | ⚠️ | Fully implemented, but directly calls `getDatabase()` without web check. |
| `friendRepository.ts` | `local_friendships` | Enqueues to `sync_queue` | ⚠️ | Fully implemented, but directly calls `getDatabase()` without web check. |
| `settlementRepository.ts`| `local_settlements` | Enqueues to `sync_queue` | ⚠️ | Fully implemented, but directly calls `getDatabase()` without web check. |

### 4.3 Synchronization Engine (`src/sync/`)
| Module | Responsibilities | Offline Handling | Status |
|--------|------------------|------------------|:------:|
| `networkMonitor.ts` | NetInfo state listener, connectivity event dispatch | Detects offline/online transitions | ✅ |
| `syncQueue.ts` | Durable SQLite-backed queue (`sync_queue`), retry logic, backoff, deduplication | Survives app restarts; retries on reconnection | ✅ |
| `syncService.ts` | Bidirectional Firestore sync, snapshot listeners, remote cache invalidation | Syncs changes upon connection restoration | ✅ |

---

## 5. Firestore Database Collections & Namespaces

Every Firestore database collection and document in the entire repository strictly adheres to the `/splitwiser/data/` namespace:

| Collection Path | Schema / Purpose | Document ID Strategy |
|-----------------|------------------|----------------------|
| `/splitwiser/data/users/{uid}` | AppUser profile (name, email, photo, currency, appearance, onboardingCompleted) | Firebase Auth UID |
| `/splitwiser/data/users/{uid}/notifications/{id}` | In-app notifications per user | Deterministic or random ID |
| `/splitwiser/data/users/{uid}/notificationMeta/preferences` | User notification preferences | Single document |
| `/splitwiser/data/users/{uid}/notificationMeta/summary` | Unread notifications badge counter | Single document |
| `/splitwiser/data/groups/{groupId}` | Group document (name, type, defaultCurrency, joinCode, createdBy, bannerUrl) | Auto-generated ID |
| `/splitwiser/data/groups/{groupId}/members/{uid}` | Group membership roster (role, joinedAt, userName, imageUrl) | User UID |
| `/splitwiser/data/groups/{groupId}/expenses/{expenseId}` | Expense documents with split arrays, paidBy, amount, tags | Auto-generated ID |
| `/splitwiser/data/groups/{groupId}/settlements/{id}` | Settlement transaction records (from, to, amount) | Auto-generated ID |
| `/splitwiser/data/groups/{groupId}/activities/{id}` | Group audit log events (actor, action, description, metadata) | Timestamped ID |
| `/splitwiser/data/groups/{groupId}/member_preferences/{uid}` | Group-level user settings (simplifyDebts, notifications) | User UID |
| `/splitwiser/data/friendships/{id}` | Direct bilateral friendship relations and balances | Deterministic or UUID |
| `/splitwiser/data/support_tickets/{id}` | User feedback and support inquiries | Auto-generated ID |

---

## 6. Calculations & Utility Modules (`src/utils/`)

| Utility Module | Functions Audited | Purpose & Correctness | Status |
|----------------|-------------------|-----------------------|:------:|
| `balanceCalculator.ts` | `computeNetBalances()`, `optimizeSettlements()`, `getDirectPairwiseSettlements()`, `calculateFriendBalances()` | Debt minimization algorithm and direct bilateral calculations. Net balances sum to zero across all currencies. | ✅ |
| `splitMath.ts` | `distributeCentsEqually()`, `calculatePercentageSplits()`, `calculateSharesSplits()`, `calculateAdjustmentSplits()`, `calculateItemizedSplits()` | Penny-exact split arithmetic avoiding floating-point rounding errors using integer minor units (cents). | ✅ |
| `currency.ts` | `formatCurrency()`, `isValidFinancialAmount()`, `getCurrencySymbol()`, `normalizeCurrencyCode()` | Multi-currency formatting, ISO code normalization, currency symbol mapping, boundary limits validation. | ✅ |
| `imageCompressor.ts` | `compressAvatarPhoto()`, `compressGroupCover()` | Uses `expo-image-manipulator` to resize and compress images below storage thresholds. | ✅ |
| `notificationUtils.ts` | `generateDeterministicNotificationId()`, `formatNotificationMessage()`, `groupNotificationsByDate()` | Notification ID deduplication, dynamic message templating with currency amounts, timeline grouping. | ✅ |
| `profilePhotoHelper.ts` | `resolveProfilePicture()`, `calculateGoogleSyncUpdates()` | Two-tone avatar generation, Google profile sync calculation, user preference retention. | ✅ |
| `securityUtils.ts` | `generateSalt()`, `hashPasscode()`, `verifyPasscode()` | SHA-256 cryptographic passcode hashing using `expo-crypto`, salt generation, rate-limit delay calculator. | ✅ |

---

## 7. Authentication Architecture & Provider Methods

| Method | Source File | Description | Status |
|--------|-------------|-------------|:------:|
| **Guest / Anonymous Sign-In** | `src/services/auth.ts`, `AuthContext.tsx` | Calls Firebase `signInAnonymously()`, creates Firestore user record, initializes local sync. Instant access without friction. | ✅ |
| **Email & Password Registration** | `src/services/auth.ts`, `AuthContext.tsx` | Calls Firebase `createUserWithEmailAndPassword()`, validates RFC-5321 email format and minimum password complexity. | ✅ |
| **Email & Password Sign-In** | `src/services/auth.ts`, `AuthContext.tsx` | Calls Firebase `signInWithEmailAndPassword()`, reloads user profile, warms sync queue. | ✅ |
| **Google Sign-In (Native)** | `src/services/useGoogleAuth.ts`, `AuthContext.tsx` | Uses `@react-native-google-signin/google-signin` native TurboModule with EAS Build. Fallback checks for Expo Go / Web. | ✅ |
| **Guest-to-Google Account Linking** | `src/services/auth.ts`, `AuthContext.tsx` | Calls `linkWithCredential()` on active anonymous user, preserving the original UID and all associated groups/expenses. | ✅ |
| **Credential Conflict Migration** | `src/services/auth.ts`, `AuthContext.tsx` | In case Google account already exists on another UID, migrates groups, expenses, and settlements from guest UID to Google UID. | ✅ |
| **Sign Out & Session Isolation** | `src/services/auth.ts`, `AuthContext.tsx` | Calls Firebase `signOut()`, signs out native Google SDK, and wipes local SQLite database (`clearLocalData()`) to prevent data leakage between users. | ✅ |
| **Legacy `completeOnboarding`** | `src/services/auth.ts`, `AuthContext.tsx` | Legacy helper from v1. Deprecated in favor of modern multi-step onboarding (`completeProfile` + `finishOnboarding`). | 🗑️ |

---

## 8. Permissions Audit

| Permission Domain | Provider Library | Usage Location in Code | Graceful Fallback / Rejection Handling |
|-------------------|------------------|------------------------|----------------------------------------|
| **Camera** | `expo-camera` / `expo-image-picker` | `QrCodeModal.tsx` (Scan tab), `ProfilePhotoModal.tsx`, `GroupCoverPhotoModal.tsx` | Shows informative Alert with permission instructions; falls back to manual code entry or preset gallery. |
| **Photo Library** | `expo-image-picker` | `GuestProfileSetupScreen.tsx`, `OnboardingGroupCreationScreen.tsx`, `ProfilePhotoModal.tsx`, `GroupCoverPhotoModal.tsx` | Alerts user if permission denied; defaults to curated preset covers or two-tone initial avatars. |
| **Biometrics (FaceID / Fingerprint)** | `expo-local-authentication` | `src/services/securityService.ts`, `AppLockOverlay.tsx`, `SecuritySettingsModal.tsx` | Checks `hasHardwareAsync()` and `isEnrolledAsync()`. If unavailable, hides biometrics toggle and uses 4-digit PIN only. |
| **Push / Local Notifications** | `expo-notifications` | `src/services/localNotificationService.ts`, `App.tsx` | Zero-permission onboarding UX: permission request is deferred until after onboarding completion. In-app banner functions regardless of OS permission. |
| **App-Level Member Permissions** | Application State | `ExpensePreferencesModal.tsx`, `GroupSettingsScreen.tsx`, `types/index.ts` (`memberPermissions: 'anyone' \| 'admin_only'`) | Only group creator/admin can modify expense settings or delete groups. |

---

## 9. Test Suite Verification (`tests/` directory)

All 14 test suites are executed via `npm test` and pass with 100% success (0 failures):

| Test Suite | Test File | Tests Passed | Domain Covered |
|------------|-----------|:------------:|----------------|
| 1. Balances | `tests/balanceCalculator.test.ts` | 12 | Net debt calculation, 2-group breakdown, settlement deductions, soft-deletes, multi-payer |
| 2. Cover Photos | `tests/coverPhoto.test.ts` | 6 | 29 preset catalog, category suggestions, deterministic hash |
| 3. Group Settings | `tests/groupSettings.test.ts` | 7 | 7 group types, RFC-4180 CSV export, text summary, date filtering |
| 4. Split Math | `tests/splitMath.test.ts` | 28 | Minor unit conversion (cents), Equal, Exact, Percentage, Shares, Adjustments, Itemized bill |
| 5. Category Detector | `tests/categoryDetector.test.ts` | 52 | 23 canonical categories, merchant dictionary, multilingual tokens, normalizer |
| 6. Profile Photo | `tests/profilePhoto.test.ts` | 10 | Avatar resolution, Google sync updates, URL validation |
| 7. Limits & Boundaries | `tests/limitsValidation.test.ts` | 8 | ₹1B boundary, zero/negative rejection, decimal precision (0, 2, 3), safe integer boundaries |
| 8. Internationalization | `tests/i18n.test.ts` | 45 | 8 languages loaded, key parity, RTL detection, number & currency formatting |
| 9. Theme System | `tests/theme.test.ts` | 20 | Light/Dark color tokens, contrast ratios, system appearance listeners |
| 10. Notifications | `tests/notifications.test.ts` | 12 | Deterministic IDs, unread badge counters, formatting, raw UID cleansing |
| 11. App Security | `tests/security.test.ts` | 8 | Cryptographic salt generation, SHA-256 hash determinism, brute force lockout rate limiting |
| 12. Onboarding Flow | `tests/onboardingFlow.test.ts` | 30 | Screen navigation paths, initial route determination, session state branching |
| 13. Comprehensive Onboarding QA | `tests/onboardingQA.test.ts` | 110 | 16 QA test sections: validations, identity preservation, offline resilience, credential migration |
| 14. Full Task QC End-to-End | `tests/fullTaskQC.test.ts` | 26 | 9 QC checkpoints verifying end-to-end flow integrity and zero-permission onboarding |
| **Total** | **14 Test Files** | **374 Assertions / Tests** | **Zero Failures (100% Pass Rate)** |

---

## 10. Dependencies Audit (`package.json`)

| Package Name | Version | Category | Purpose / Role |
|--------------|---------|----------|----------------|
| `expo` | `^58.0.0` | Core | Expo SDK 58 application runtime |
| `react` / `react-native` | `19.3.0` / `0.88.1` | Core | React 19 and React Native framework |
| `@react-navigation/native` | `^7.1.16` | Navigation | Navigation container & context |
| `@react-navigation/native-stack` | `^7.3.23` | Navigation | Native view stack transitions |
| `@react-navigation/bottom-tabs` | `^7.4.4` | Navigation | Bottom tab navigation |
| `firebase` | `^12.19.0` | Backend | Firebase Auth, Firestore database, Firebase Storage |
| `expo-sqlite` | `~58.0.15` | Local Database | Offline SQLite cache and durable sync queue |
| `@react-native-async-storage/async-storage` | `2.2.0` | Local Storage | Key-value storage for settings, theme, and language preferences |
| `expo-secure-store` | `~58.0.2` | Security | Encrypted keychain/keystore storage for security PIN and salts |
| `expo-local-authentication` | `~58.0.2` | Security | Biometric authentication (FaceID, TouchID, Fingerprint) |
| `expo-crypto` | `~58.0.7` | Security | SHA-256 hashing and cryptographic random salt generation |
| `@react-native-google-signin/google-signin` | `^13.3.1` | Authentication | Native Google Sign-In SDK for Android & iOS builds |
| `i18next` / `react-i18next` | `^27.0.1` / `^18.0.1` | i18n | Multi-language internationalization framework |
| `@formatjs/intl-pluralrules` | `^7.0.4` | i18n | Plural rules polyfill for Arabic, Russian, and complex pluralization |
| `react-native-paper` | `^5.14.5` | UI Components | Material Design 3 component library |
| `lucide-react-native` | `^1.67.0` | UI Icons | Vector icon library |
| `react-native-svg` | `15.16.0` | UI Graphics | SVG rendering engine for custom charts, icons, and badges |
| `react-native-qrcode-svg` | `^6.3.54` | QR Utility | Generating group invite QR codes |
| `expo-camera` | `~58.0.14` | Hardware | QR code scanner camera view |
| `expo-image-picker` | `~58.0.10` | Media | Photo library and camera capture for avatars and group covers |
| `expo-image-manipulator` | `~58.0.16` | Media | Resizing, cropping, and JPEG compression of user images |
| `expo-haptics` | `~58.0.7` | Feedback | Tactile haptic feedback engine for touch interactions |
| `expo-notifications` | `~58.1.8` | Notifications | Local notification scheduling, notification channels, and handlers |
| `@react-native-community/netinfo` | `12.0.1` | Networking | Real-time network reachability monitoring |
| `expo-splash-screen` | `~58.0.13` | Lifecycle | Native splash screen persistence and smooth dismissal |
| `expo-status-bar` | `~58.0.4` | System UI | Status bar styling matching active theme |
| `expo-localization` | `~58.0.5` | System UI | System locale and language detector |
| `react-native-safe-area-context` | `~5.11.1` | Layout | Edge-to-edge safe area inset handling |
| `react-native-screens` | `~4.30.1` | Navigation Native | Native screen container primitives |
| `typescript` | `~6.0.3` | Dev | Static type checking (`tsc --noEmit`) |

---

## 11. Internationalization Audit (`src/i18n/`)

### Supported Languages (8 Locales)
1. **Arabic (`ar`)** — RTL script, 467 translation keys across 15 namespaces
2. **English (`en`)** — Default locale, 463 translation keys across 15 namespaces
3. **Spanish (`es`)** — 463 translation keys across 15 namespaces
4. **French (`fr`)** — 463 translation keys across 15 namespaces
5. **Indonesian (`id`)** — 463 translation keys across 15 namespaces
6. **Portuguese - Brazil (`pt-BR`)** — 463 translation keys across 15 namespaces
7. **Russian (`ru`)** — 465 translation keys across 15 namespaces
8. **Chinese Simplified (`zh-Hans`)** — 463 translation keys across 15 namespaces

### Translation Namespaces (15 Namespaces per Locale)
- `auth.json`: Authentication, guest mode, login, register, linking
- `balances.json`: You owe, you are owed, settled, balance breakdown
- `categories.json`: 23 expense category labels
- `charts.json`: Statistics, monthly trends, spending distribution
- `common.json`: Buttons, save, cancel, delete, edit, loading, error
- `errors.json`: Network, validation, permission error messages
- `expenses.json`: Add/edit expense, description, amount, splits, date
- `friends.json`: Friends list, add friend, friend details, bilateral debt
- `groups.json`: Groups list, create group, group details, group settings, members
- `home.json`: Dashboard, quick actions, balance summary
- `notifications.json`: Notification center, push messages, reminders
- `settings.json`: Account, profile, theme, language, security, support
- `settlements.json`: Settle up, payment mode, confirm settlement
- `split.json`: Split types (equal, percentage, exact, shares, adjustments, itemized)
- `validation.json`: Form validation constraints, limits, required fields

---

## 12. Top 5 Key Gaps & Architectural Issues Found

| Rank | Issue / Gap Description | Severity | Affected Files | Recommended Remediation |
|:---:|-------------------------|:--------:|----------------|--------------------------|
| **1** | **SQLite Web Concurrency & Storage Fallback** | Medium | `src/repositories/*.ts`, `src/db/sqlite.ts` | While `App.tsx` guards `getDatabase()` initialization from running on Web, all four repository modules (`groupRepository`, `expenseRepository`, `friendRepository`, `settlementRepository`) call `getDatabase()` directly. In multi-tab Web browsers using OPFS AccessHandlePoolVFS, this can throw `createSyncAccessHandle` lock errors. Add an in-memory repository fallback for Web platform. |
| **2** | **Intl Polyfill Require Import Warning** | Low | `src/i18n/index.ts` | Static `require('@formatjs/intl-pluralrules/polyfill.js')` uses direct `.js` extension path which triggers Metro/Hermes bundling warnings in modern Expo builds. Change to standard bare import `import '@formatjs/intl-pluralrules/polyfill'` or dynamic guard. |
| **3** | **Google Sign-In Native Module Gating in Expo Go** | Low | `src/services/useGoogleAuth.ts` | `@react-native-google-signin/google-signin` native TurboModule is only compiled in custom dev builds (EAS build), returning false in standard Expo Go. Currently handled gracefully with fallback notices, but guest users cannot test Google OAuth in Expo Go without standalone APK/AAB build. |
| **4** | **Legacy Authentication Helper Deprecation** | Low | `src/services/auth.ts`, `src/context/AuthContext.tsx` | The function `completeOnboarding` in `AuthContext` and `auth.ts` is a legacy v1 stub that bypasses the 6-screen onboarding pipeline. It should be flagged `@deprecated` and pruned in next major release. |
| **5** | **Zero-Debt Settlement Action State** | Low | `src/screens/GroupDetailsScreen.tsx`, `src/components/common/SettleUpModal.tsx` | In groups where all debts are settled ($0 balance) or perfectly circular, the "Settle Up" action remains clickable, showing a $0 pre-filled modal. The Settle Up button should be disabled with a tooltip or badge when outstanding debt equals 0. |

---

*Report generated and validated by Antigravity Phase 1 Project Auditor.*
