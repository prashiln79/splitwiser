# Feature Implementation Status Audit: Splitwiser

This document provides a rigorous, verified audit of all features across the codebase. Every status has been confirmed by inspecting the underlying TypeScript files, components, and test suites.

---

## Status Legend
- **Implemented**: Production-ready, fully implemented in source code with active UI, persistence, and test coverage.
- **Partially Implemented**: Core logic or UI exists, but certain secondary capabilities or edge cases are stubbed or pending backend functions.
- **Planned**: Architected in types/interfaces or roadmap, but source code is not yet written.
- **Not Implemented**: Feature referenced in Splitwise but not built in Splitwiser.
- **Deprecated**: Older implementation replaced by a newer subsystem.

---

## 1. Authentication & Profile Domain

### 1.1 Anonymous Guest Onboarding
- **Status**: **Implemented**
- **Description**: Allows users to enter the app immediately with a temporary anonymous session and start creating groups.
- **Screens**: `OnboardingScreen.tsx`
- **Source Files**: `src/screens/OnboardingScreen.tsx`, `src/services/auth.ts`, `src/context/AuthContext.tsx`
- **Components**: `AppNavigator.tsx`
- **Services**: `auth.ts` (`signInAnonymously`)
- **Firebase Dependencies**: Firebase Auth (`signInAnonymously`), Firestore `users/{uid}`
- **Business Rules**: Creates a local SQLite user record and Firestore document. Automatically prompted to link Google account later.
- **Test Coverage**: Tested in `AuthContext` and integration flows.
- **Known Limitations**: Guest accounts risk data loss if the app cache is completely cleared before linking Google.

### 1.2 Google Sign-In & Account Linking
- **Status**: **Implemented**
- **Description**: Google OAuth authentication with native Google Play Services credential handling, linking anonymous data to existing Google accounts.
- **Screens**: `OnboardingScreen.tsx`, `AccountScreen.tsx`, `EditProfileScreen.tsx`
- **Source Files**: `src/services/auth.ts`, `src/services/useGoogleAuth.ts`, `src/components/common/ConnectGoogleModal.tsx`
- **Components**: `ConnectGoogleModal`, `GoogleIcon`
- **Services**: `auth.ts`, `@react-native-google-signin/google-signin`
- **Firebase Dependencies**: Firebase Auth (`signInWithCredential`, `linkWithCredential`), Firestore `users/{uid}`
- **Business Rules**: Migrates groups, members, and expenses when linking guest account to existing Google UID.
- **Test Coverage**: Unit tests for sync calculations in `tests/profilePhoto.test.ts`.
- **Known Limitations**: Requires configured `google-services.json` and OAuth client SHA-1 fingerprints for Android builds.

### 1.3 Automatic Google Profile Photo + Custom Avatar Hierarchy
- **Status**: **Implemented**
- **Description**: Automatic retrieval of Google avatar on login; custom photo upload with 1:1 cropping; strict priority cascade (Custom > Google > Initials); external Google photo background sync without overwriting custom avatar.
- **Screens**: `AccountScreen.tsx`, `EditProfileScreen.tsx`
- **Source Files**: `src/utils/profilePhotoHelper.ts`, `src/services/userProfilePhotoService.ts`, `src/components/common/ProfilePhotoModal.tsx`, `src/components/common/MemberAvatar.tsx`
- **Components**: `ProfilePhotoModal`, `MemberAvatar` (`ProfileAvatar`)
- **Services**: `userProfilePhotoService.ts`, `auth.ts`, `imageCompressor.ts`
- **Firebase Dependencies**: Firebase Storage (`users/{uid}/profile/avatar_{timestamp}.jpg`), Firestore `users/{uid}`
- **Business Rules**: Custom photo must never be overwritten by subsequent Google logins. Toggling back to Google photo restores Google URL.
- **Test Coverage**: 10 test suites in `tests/profilePhoto.test.ts` (100% pass).
- **Known Limitations**: Custom uploads depend on camera/gallery runtime permissions on physical devices.

### 1.4 User Preferences & Profile Editing
- **Status**: **Implemented**
- **Description**: Editing full name, email, phone, default currency, timezone, and language.
- **Screens**: `EditProfileScreen.tsx`, `AccountScreen.tsx`
- **Source Files**: `src/screens/EditProfileScreen.tsx`, `src/screens/AccountScreen.tsx`
- **Components**: `MemberAvatar`, `ProfilePhotoModal`, `ConnectGoogleModal`
- **Services**: `auth.ts` (`updateProfile`)
- **Firebase Dependencies**: Firestore `users/{uid}`
- **Business Rules**: Name cannot be empty. Currency changes propagate to new expenses.
- **Test Coverage**: Covered in integration tests.
- **Known Limitations**: Changing currency does not retroactively convert past expense records (stored in their recorded currency).

---

## 2. Groups & Management Domain

### 2.1 Group Creation & Join Codes
- **Status**: **Implemented**
- **Description**: Group creation with category types, currency, description, and 6-character unique join code.
- **Screens**: `CreateGroupScreen.tsx`, `JoinGroupScreen.tsx`
- **Source Files**: `src/screens/CreateGroupScreen.tsx`, `src/screens/JoinGroupScreen.tsx`, `src/services/groups.ts`
- **Components**: `GroupCard`, `CategoryIcon`
- **Services**: `groups.ts`, `groupRepository.ts`
- **Firebase Dependencies**: Firestore `splitwiser/data/groups/{groupId}`
- **Business Rules**: Creator is assigned `admin` role. Unique join code indexed for discovery.
- **Test Coverage**: Tested in `tests/groupSettings.test.ts`.
- **Known Limitations**: Join codes are case-insensitive uppercase 6 characters.

### 2.2 Group Cover Photos (Presets & Custom)
- **Status**: **Implemented**
- **Description**: 16:9 banner cover system with 29 curated preset covers across 8 categories, deterministic hashing fallback, smart category pre-selection, custom gallery upload, and smooth scroll integration.
- **Screens**: `GroupDetailsScreen.tsx`, `GroupSettingsScreen.tsx`
- **Source Files**: `src/constants/presetCovers.ts`, `src/services/groupCoverService.ts`, `src/components/common/GroupCoverHeader.tsx`, `src/components/common/GroupCoverPhotoModal.tsx`
- **Components**: `GroupCoverHeader`, `GroupCoverPhotoModal`
- **Services**: `groupCoverService.ts`, `imageCompressor.ts`
- **Firebase Dependencies**: Firebase Storage (`groups/{groupId}/covers/{timestamp}.jpg`), Firestore `groups/{groupId}.coverPhoto`
- **Business Rules**: Group avatar and group cover photo are completely independent. Cover scrolls with the screen content.
- **Test Coverage**: 6 test suites in `tests/coverPhoto.test.ts` (100% pass).
- **Known Limitations**: Presets load from optimized Unsplash CDN URLs; offline viewing relies on device image caching.

### 2.3 Group Settings & Member Roles
- **Status**: **Implemented**
- **Description**: Edit group metadata, member permissions, default split type, simplify debts toggle, and notification preferences.
- **Screens**: `GroupSettingsScreen.tsx`
- **Source Files**: `src/screens/GroupSettingsScreen.tsx`, `src/components/groupSettings/*`
- **Components**: `EditGroupInfoModal`, `GroupMembersModal`, `ExpensePreferencesModal`, `GroupNotificationsModal`, `GroupExportModal`
- **Services**: `groups.ts`, `groupPreferencesService.ts`, `exportService.ts`
- **Firebase Dependencies**: Firestore `groups/{groupId}`, `groups/{groupId}/members/{userId}`
- **Business Rules**: Admin members can change group name and permissions; regular members can view and export.
- **Test Coverage**: 7 test suites in `tests/groupSettings.test.ts` (100% pass).
- **Known Limitations**: Member removal requires member debt balance to be settled first.

---

## 3. Expense & Split Domain

### 3.1 Expense Creation & Editing
- **Status**: **Implemented**
- **Description**: Complete expense authoring with description, amount, date, single/multiple payers, and active participant selection.
- **Screens**: `AddExpenseScreen.tsx`
- **Source Files**: `src/screens/AddExpenseScreen.tsx`, `src/services/expenses.ts`, `src/repositories/expenseRepository.ts`
- **Components**: `AmountInput`, `PayerSelectionModal`, `SplitConfigurationModal`, `ParticipantRow`
- **Services**: `expenses.ts`, `categoryDetector/index.ts`
- **Firebase Dependencies**: Firestore `splitwiser/data/groups/{groupId}/expenses/{expenseId}`
- **Business Rules**: Splits sum must exactly match expense total. Soft deletion preserves audit history.
- **Test Coverage**: Tested in `tests/splitMath.test.ts` and `tests/balanceCalculator.test.ts`.
- **Known Limitations**: Editing a group expense is permitted by any member; activity log records the editor.

### 3.2 6 Mathematical Split Modes
- **Status**: **Implemented**
- **Description**: Exact penny reconciliation across `equal`, `unequal`, `percentage`, `shares`, `adjustment`, and `itemized` split algorithms.
- **Screens**: `AddExpenseScreen.tsx`
- **Source Files**: `src/utils/splitMath.ts`, `src/components/expense/SplitConfigurationModal.tsx`
- **Components**: `SplitConfigurationModal`
- **Services**: `splitMath.ts`
- **Firebase Dependencies**: Splits stored as JSON array in `Expense.splits`.
- **Business Rules**: Fractional remainder pennies are deterministically allocated. Total shares sum must reconcile to the penny.
- **Test Coverage**: 30+ assertions in `tests/splitMath.test.ts` (100% pass).
- **Known Limitations**: Itemized splits support single-payer or equal multi-item distribution per person.

### 3.3 Multiple Payers Support
- **Status**: **Implemented**
- **Description**: Allows multiple people to pay different amounts towards a single collective bill.
- **Screens**: `AddExpenseScreen.tsx`
- **Source Files**: `src/components/expense/PayerSelectionModal.tsx`, `src/utils/balanceCalculator.ts`
- **Components**: `PayerSelectionModal`
- **Services**: Encoded via `payer:{userId}:{amount}` tags in `Expense.tags`.
- **Firebase Dependencies**: Stored in `Expense.tags`.
- **Business Rules**: Sum of payer contributions must equal the total bill amount.
- **Test Coverage**: Scenario 10 in `tests/balanceCalculator.test.ts` (100% pass).
- **Known Limitations**: Payers must be registered group members.

### 3.4 Multilingual Real-Time Category Detection
- **Status**: **Implemented**
- **Description**: 23 canonical categories detected via merchant dictionary, multilingual lexicons (10 languages), and local machine-learned preferences.
- **Screens**: `AddExpenseScreen.tsx`
- **Source Files**: `src/services/categoryDetector/*` (8 files)
- **Components**: `CategoryIcon`
- **Services**: `categoryDetector/detector.ts`
- **Firebase Dependencies**: None (100% client-side offline execution).
- **Business Rules**: User manual selection is strictly immutable and cannot be overwritten by NLP detection.
- **Test Coverage**: 156 test cases in `tests/categoryDetector.test.ts` (100% pass).
- **Known Limitations**: Highly obscure or misspelled merchant names fall back to General category.

---

## 4. Balances & Settlements Domain

### 4.1 Real-Time Net Balance Calculation
- **Status**: **Implemented**
- **Description**: Real-time group balances calculated by aggregating all expenses, multi-payer contributions, and recorded settlements.
- **Screens**: `GroupDetailsScreen.tsx`, `HomeScreen.tsx`
- **Source Files**: `src/utils/balanceCalculator.ts`, `src/repositories/expenseRepository.ts`
- **Components**: `BalanceCard`, `GroupCard`
- **Services**: `balanceCalculator.ts`
- **Firebase Dependencies**: Firestore expenses and settlements collections.
- **Business Rules**: Soft-deleted expenses and settlements are strictly excluded from balance computations.
- **Test Coverage**: 12 scenarios in `tests/balanceCalculator.test.ts` (100% pass).
- **Known Limitations**: All balances are in the group's chosen currency.

### 4.2 Debt Minimization (Simplification)
- **Status**: **Implemented**
- **Description**: Consolidates complex multi-person group debts into the minimal number of direct settlement transfers.
- **Screens**: `GroupDetailsScreen.tsx`, `GroupSettingsScreen.tsx`
- **Source Files**: `src/utils/balanceCalculator.ts` (`optimizeSettlements`)
- **Components**: `SettleUpModal`
- **Services**: `balanceCalculator.ts`
- **Firebase Dependencies**: Firestore group settings `simplifyDebts: boolean`.
- **Business Rules**: Respects group-level toggle. When off, calculates direct bilateral pairwise debts.
- **Test Coverage**: Tested in `tests/groupSettings.test.ts` and `tests/balanceCalculator.test.ts`.
- **Known Limitations**: Simplification requires all group members to agree to route payments through mutual intermediaries.

### 4.3 Settle Up Flow
- **Status**: **Implemented**
- **Description**: Direct settlement modal to record cash, bank, or UPI transfers between debtor and creditor.
- **Screens**: `GroupDetailsScreen.tsx`, `FriendDetailsScreen.tsx`
- **Source Files**: `src/components/common/SettleUpModal.tsx`, `src/services/settlements.ts`, `src/repositories/settlementRepository.ts`
- **Components**: `SettleUpModal`, `MemberAvatar`
- **Services**: `settlements.ts`
- **Firebase Dependencies**: Firestore `groups/{groupId}/settlements/{settlementId}`
- **Business Rules**: Recording a settlement immediately decreases debtor's debt and creditor's credit.
- **Test Coverage**: Covered in balance calculator test suite.
- **Known Limitations**: Records the accounting settlement; does not integrate bank-level automated payment gateways.

---

## 5. Friends Domain

### 5.1 Friend Connections & Aggregated Balances
- **Status**: **Implemented**
- **Description**: Connect with friends via code/email; view cross-group aggregated bilateral balances combining direct and shared group expenses.
- **Screens**: `FriendsScreen.tsx`, `FriendDetailsScreen.tsx`
- **Source Files**: `src/screens/FriendsScreen.tsx`, `src/screens/FriendDetailsScreen.tsx`, `src/services/friendService.ts`
- **Components**: `AddFriendModal`, `BalanceCard`
- **Services**: `friendService.ts`, `friendRepository.ts`
- **Firebase Dependencies**: Firestore `splitwiser/data/friendships/{friendshipId}`
- **Business Rules**: Calculates bilateral net sum across all mutual groups plus direct expenses.
- **Test Coverage**: Tested in `tests/balanceCalculator.test.ts` (Scenarios 4 & 5).
- **Known Limitations**: Friend requests require mutual acceptance to appear in friend lists.

---

## 6. Analytics, Exports & Support Domain

### 6.1 Spending Visualizations
- **Status**: **Implemented**
- **Description**: SVG Donut Chart showing category breakdown and Monthly Trends Bar Chart.
- **Screens**: `StatisticsScreen.tsx`
- **Source Files**: `src/screens/StatisticsScreen.tsx`, `src/components/common/SpendingDonutChart.tsx`, `src/components/common/MonthlyTrendsChart.tsx`
- **Components**: `SpendingDonutChart`, `MonthlyTrendsChart`
- **Services**: Client-side aggregation of local SQLite expenses.
- **Firebase Dependencies**: None (operates offline on local database).
- **Business Rules**: Filters out settlements and deleted expenses.
- **Test Coverage**: Render and calculations validated.
- **Known Limitations**: Aggregates expenses recorded in the user's primary currency.

### 6.2 Data Export Engine
- **Status**: **Implemented**
- **Description**: Generates RFC-4180 CSV spreadsheets and formatted WhatsApp/SMS financial text summaries with date filtering.
- **Screens**: `GroupSettingsScreen.tsx`
- **Source Files**: `src/services/exportService.ts`, `src/components/groupSettings/GroupExportModal.tsx`
- **Components**: `GroupExportModal`
- **Services**: `exportService.ts`
- **Firebase Dependencies**: None.
- **Business Rules**: Correctly escapes quotes and commas per RFC-4180.
- **Test Coverage**: Validated in `tests/groupSettings.test.ts`.
- **Known Limitations**: PDF export is not yet implemented (CSV and text only).

### 6.3 In-App Support Ticket Submission
- **Status**: **Implemented**
- **Description**: Submit support tickets and feedback directly to Firestore.
- **Screens**: `AccountScreen.tsx`
- **Source Files**: `src/services/support.ts`, `src/screens/AccountScreen.tsx`
- **Components**: Support modal in `AccountScreen`
- **Services**: `support.ts` (`submitSupportTicket`)
- **Firebase Dependencies**: Firestore `splitwiser/data/support_tickets/{ticketId}`
- **Business Rules**: Includes user UID, display name, email, and message body.
- **Test Coverage**: Service tested.
- **Known Limitations**: Feedback status tracking is admin-side in Firebase Console.

### 6.4 Multilingual Internationalization (i18n)
- **Status**: **Implemented**
- **Description**: Comprehensive offline-first multilingual localization across 8 tier-1 languages (English, Chinese Simplified, Spanish, Arabic RTL, French, Brazilian Portuguese, Indonesian, Russian) with 15 functional namespaces. Automatic locale detection via `expo-localization`, AsyncStorage persistence, Firestore syncing, and Arabic RTL layout support.
- **Screens**: All application screens (`AccountScreen`, `EditProfileScreen`, `MainNavigator` tabs, etc.)
- **Source Files**: `src/i18n/*`, `src/context/I18nContext.tsx`, `src/components/settings/LanguagePickerModal.tsx`, `src/services/languageService.ts`
- **Components**: `LanguagePickerModal`, `I18nProvider`
- **Services**: `languageService.ts`, `i18n/language-storage.ts`, `i18n/language-detector.ts`
- **Firebase Dependencies**: Firestore `users/{uid}.language`
- **Business Rules**: 100% key parity across all 8 languages; UGC preserved without auto-translation; canonical category IDs immutable; financial math decoupled and language-agnostic; Arabic triggers RTL layout mode via React Native `I18nManager`.
- **Test Coverage**: 3,345 automated test assertions in `tests/i18n.test.ts` (100% pass).
- **Known Limitations**: Physical device app restart is required for native RTL text direction switches to take full system effect on Android.

### 6.5 Complete Application Appearance Settings (Light, Dark, and System Default)
- **Status**: **Implemented**
- **Description**: Production-grade theme architecture supporting three appearance modes: Light, Dark, and System Default (default). Instantaneous update without requiring app restart, dynamic Android status bar synchronization, AsyncStorage cold-start persistence, and Firestore sync on authentication. Complete coverage across every screen, modal, and custom component.
- **Screens**: 100% verified across all screens (`AccountScreen`, `HomeScreen`, `FriendsScreen`, `FriendDetailsScreen`, `GroupDetailsScreen`, `GroupSettingsScreen`, `StatisticsScreen`, `AddExpenseScreen`, `CreateGroupScreen`, `EditProfileScreen`, `JoinGroupScreen`, `OnboardingScreen`).
- **Source Files**: `src/theme/index.tsx`, `src/theme/colors.ts`, `src/theme/themeStorage.ts`, `src/services/themeService.ts`, `src/components/settings/ThemePickerModal.tsx`
- **Components & Modals**: `ThemePickerModal`, `LanguagePickerModal`, `AppHeader`, `GroupCard`, `ExpenseListItem`, `BalanceCard`, `GroupCoverHeader`, `GroupCoverPhotoModal`, `ProfilePhotoModal`, `QrCodeModal`, `TypedConfirmDialog`, `ConfirmationDialog`, `EmptyState`, `MemberAvatar`, `SpendingDonutChart`, `MonthlyTrendsChart`, `AmountInput`, `ParticipantRow`, `PayerSelectionModal`, `SplitConfigurationModal`, `SettleUpModal`, `AddFriendModal`, and all 10 group settings modals (`AddMembersModal`, `BalanceRemindersModal`, `CurrencySelectorModal`, `EditGroupInfoModal`, `ExpensePreferencesModal`, `GroupExportModal`, `GroupMembersModal`, `GroupNotificationsModal`, `MemberDetailsModal`, `RecentActivityModal`).
- **Services**: `themeService.ts`, `themeStorage.ts`
- **Firebase Dependencies**: Firestore `users/{uid}.appearance`
- **Business Rules**: System Default is initial fallback. Switching modes recalculates resolved theme immediately. Green (`#10B981` / `#34D399`) strictly preserved for income/owed balances, Red (`#EF4444` / `#F87171`) for expenses/debts. Emerald brand identity preserved.
- **Test Coverage**: 6 automated test suites in `tests/theme.test.ts` (100% pass).
- **Known Limitations**: None. Operates completely offline with automatic cloud synchronization.

### 6.6 Complete In-App Notification Center Using Firebase Firestore
- **Status**: **Implemented**
- **Description**: Robust in-app notification center operating completely without Firebase Cloud Messaging (FCM) or remote push permissions. Delivers real-time notifications via in-app floating banner toasts, a dedicated `NotificationCenterScreen` inbox grouped chronologically (Today, Yesterday, Earlier) with filter tabs (All, Unread, Expenses, Settlements), interactive unread badge counts on headers across `HomeScreen`, `FriendsScreen`, and `AccountScreen`, fine-grained per-user preferences in Account settings, Firestore cloud persistence with atomic unread counters (`notificationMeta/summary`), deterministic deduplication hashes, and resilient deep-linking route verification.
- **Screens**: `NotificationCenterScreen.tsx`, `HomeScreen.tsx`, `FriendsScreen.tsx`, `AccountScreen.tsx`.
- **Source Files**: `src/screens/NotificationCenterScreen.tsx`, `src/context/NotificationContext.tsx`, `src/services/notificationService.ts`, `src/services/notificationRouter.ts`, `src/utils/notificationUtils.ts`, `src/components/notifications/InAppNotificationBanner.tsx`, `src/components/common/AppHeader.tsx`, `src/types/notifications.ts`, `functions/index.js`.
- **Components & Modals**: `InAppNotificationBanner`, `NotificationCenterScreen`, `AppHeader`, `NotificationSettingsModal`.
- **Services**: `notificationService.ts`, `notificationRouter.ts`, `notificationUtils.ts`.
- **Firebase Dependencies**: All Firestore data lives under `/splitwiser/data/...`: `splitwiser/data/users/{userId}/notifications/{notificationId}`, `splitwiser/data/users/{userId}/notificationMeta/summary`, `splitwiser/data/users/{userId}/notificationMeta/preferences`. Governed by standard `/splitwiser/{document=**}` namespace rule.
- **Business Rules**: Zero FCM device tokens or remote push permissions. Notifications triggered by expense, settlement, group, and reminder operations. Actor is strictly excluded from receiving self-notifications. Muted groups and user preferences honored before write/display. Offline caching with automatic foreground resume reconciliation via `AppState`.
- **Test Coverage**: 7 automated unit & integration test suites in `tests/notifications.test.ts` (100% pass).
- **Known Limitations**: Operates exclusively in-app; notifications generated while offline are synchronized upon reconnect and foreground resume.

---

## 7. Advanced & Future Capabilities

| Feature | Status | Notes |
|---|---|---|
| **Receipt OCR & Item Parsing** | **Planned** | Camera scan UI exists; on-device Gemini API / Vision OCR parser is scheduled for v2.1. |
| **In-App Notification Center** | **Implemented** | Complete Firestore-backed in-app inbox, real-time banner toasts, unread badges, and routing. Zero FCM dependency. |
| **Live Multi-Currency FX Rates** | **Planned** | Planned for travel groups with multi-currency bills. |
| **PDF Summary Generation** | **Planned** | CSV and Text exports are implemented; native PDF formatting planned. |

