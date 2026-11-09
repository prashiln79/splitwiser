# Product Requirements Document (PRD): Splitwiser

## 1. Product Vision & Goals

**Splitwiser** is designed to solve the everyday friction of shared group living, shared dining, collective traveling, and interpersonal financial bookkeeping without friction, paywalls, or advertisements.

### Target Personas
1. **The Flatmate / Roommate**: Needs recurring bill splitting (rent, electricity, groceries, Wi-Fi) with equal shares or adjustments for individual room sizes.
2. **The Group Traveler**: Organizes trips with multi-currency expenses, multiple payers at dinners, and needs a simplified summary at the end to settle all debts in minimal transactions.
3. **The Couple**: Tracks shared meals, dates, groceries, and streaming subscriptions with clear bilateral balances.
4. **The Social Friend**: Records occasional lunch outings, movie tickets, or rides without needing to create an entire permanent group.

---

## 2. Functional Requirements Summary

### FR-1: Identity & Authentication
- **Anonymous Onboarding**: Users can immediately enter the app as an anonymous guest with a temporary profile.
- **Google Sign-In**: Link guest account or sign in directly with Google using `@react-native-google-signin/google-signin` and Firebase Auth OAuth credentials.
- **Data Migration**: When an anonymous user signs in with Google, all existing groups, expenses, and settlements created anonymously must be migrated and preserved.
- **Profile Customization**: Users can edit their display name, email, phone number, default currency (INR, USD, EUR, GBP, AUD, CAD, SGD), timezone, and language.

### FR-2: Profile Picture Management
- **Google Photo Retrieval**: Automatically fetch Google account photo on initial login and set as default avatar.
- **Custom Upload**: Enable gallery selection (1:1 crop) and camera capture. Upload compressed JPEG (400x400) to Firebase Storage `users/{uid}/profile/avatar_{timestamp}.jpg`.
- **Priority Cascade**:
  1. Manually uploaded custom photo
  2. Google account photo
  3. Initials fallback
- **Subsequent Login Safety**: Google login refreshes `googlePhotoUrl` without overwriting an active custom avatar.
- **Source Switching**: User can seamlessly switch between custom image, Google image, and initials.

### FR-3: Group Management
- **Group Creation**: Name, group type (`home`, `trip`, `couple`, `family`, `friends`, `office`, `other`), currency, description, and auto-generated 6-character join code.
- **Group Visuals**:
  - **Group Avatar**: Circular icon/avatar for lists and cards.
  - **Group Cover Photo**: 16:9 banner displayed behind group headers. Supports curated presets (29 covers across 8 categories) and custom uploaded photos.
- **Member Management**: Invite via share link/join code, view member list, assign admin roles, remove members.
- **Group Settings**:
  - Simplify debts toggle.
  - Default split type.
  - Default participants selection (`all`, `custom`, `last`).
  - Member permissions (`anyone` vs `admin_only`).
  - Notification toggles (new expenses, settlements, updates).
  - Export data (CSV, financial text summary).
  - Archive or delete group.

### FR-4: Expense Recording & Splitting
- **Inputs**: Amount, description, date, currency, payer selection, split mode, category tag.
- **Payer Modes**:
  - Single payer (any group member).
  - Multiple payers (custom contributions summing to total amount).
- **Split Modes**:
  - `equal`: Equal split with remainder-penny distribution.
  - `unequal`: Custom exact amounts summing to total.
  - `percentage`: Percentage allocations summing to 100%.
  - `shares`: Weighted shares (e.g. 1 share, 2 shares, 3 shares).
  - `adjustment`: Equal split with positive/negative individual offset amounts.
  - `itemized`: Itemized bill breakdown with proportional tax/tip distribution.
- **Category Intelligence**: Automatic real-time category detection based on description, merchant keywords, and multilingual tokens. Manual selection is locked and never overwritten.

### FR-5: Balance & Debt Settlement
- **Group Balances**: Real-time net balance per member (positive = owed money, negative = owes money).
- **Simplified Settlements**: Minimal transaction graph algorithm (`optimizeSettlements`) reducing $O(N^2)$ bilateral debts to $O(N)$ transactions.
- **Pairwise Direct Settlements**: Bilateral debts directly between payer and participant when simplification is disabled.
- **Settle Up Action**: Quick settlement modal to record full or partial payments between members.

### FR-6: Friends & Direct Debts
- **Friendships**: Search users by join code or email, send requests, accept/decline.
- **Direct Expenses**: Create non-group direct expenses between two friends.
- **Aggregated Friend Balance**: Sum of direct debts plus all shared group debts between the two individuals.

### FR-7: Analytics & Reporting
- **Spending Donut Chart**: Category-wise breakdown with percentage and amount.
- **Monthly Spending Trends**: Interactive bar chart comparing monthly expenditures.
- **Export Engine**:
  - RFC-4180 compliant CSV spreadsheet export.
  - Formatted text financial summary for WhatsApp/SMS sharing.

---

## 3. Non-Functional Requirements (NFR)

| Area | Requirement |
|---|---|
| **Target Platform** | **Android Only** (Android 15 / API 35+, Google Play Services, Package `com.splitwiser.app`). |
| **Performance** | SQLite queries must return within 50ms. Screen transitions must render at 60fps. |
| **Offline First** | Full read/write functionality without network connectivity. Automatic sync on reconnect. |
| **Reliability** | Zero penny rounding error. Remainder cents must always be allocated deterministically. |
| **Security** | Auth tokens securely stored via `AsyncStorage` / `SecureStore`. User profile uploads strictly authenticated. |
| **Responsiveness** | Support light and dark theme modes. Dynamic safe area inset handling for notches/home indicators. |
| **Accessibility & Haptics** | Haptic feedback across primary buttons, tabs, toggles, and sliders, controllable via user preference. |
| **Storage Optimization** | Image compression bounds user avatars to ~30KB (400x400 JPEG at 0.75 quality) to conserve bandwidth. |

