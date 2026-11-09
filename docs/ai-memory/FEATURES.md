# Features Catalog: Splitwiser

This document provides a complete functional index of all features implemented or available across the application.

---

## 1. Authentication & User Profile

### F-1.1: Anonymous Guest Session
- Allows instant evaluation of the application without entering an email or password.
- Generates a local anonymous user profile in SQLite and Firebase Auth with a unique UID.

### F-1.2: Google Authentication
- Integrated with `@react-native-google-signin/google-signin` and Firebase `GoogleAuthProvider`.
- Provides one-tap sign-in and account linking.
- Migrates guest data to the Google account without data loss.

### F-1.3: Dual Profile Avatar System
- Automatic synchronization with Google profile photo (`photoURL`).
- Manual picture upload from device gallery with square 1:1 cropping tool.
- Direct camera capture with square 1:1 cropping tool.
- Uploads compressed JPEG images to Firebase Storage (`users/{uid}/profile/avatar_{timestamp}.jpg`).
- Dynamic source switching between Custom Photo, Google Photo, and Initials Fallback.
- Custom pictures take absolute precedence over Google pictures.

### F-1.4: User Preferences & Account Settings
- Display name customization.
- Email address and phone number binding.
- Default currency selector (supports INR ₹, USD $, EUR €, GBP £, AUD A$, CAD C$, SGD S$).
- Timezone selector.
- Language preference selector.
- Global Haptic feedback toggle (persisted via `hapticsService`).
- Security settings (Biometric Face ID / Fingerprint unlock toggle, App passcode requirement).

---

## 2. Groups & Collaboration

### F-2.1: Group Creation
- Group naming, group type tagging (`home`, `trip`, `couple`, `family`, `friends`, `office`, `other`).
- Default currency selection per group.
- Group description.
- Unique 6-character alphanumeric join code generation.

### F-2.2: Group Cover Photo System
- 16:9 banner header displayed behind the group title.
- Curated preset library with 29 high-resolution thematic covers across 8 categories:
  - *Home & Living*, *Travel & Trips*, *Couple & Romance*, *Food & Dining*, *Adventure & Sports*, *Urban & City*, *Nature & Outdoors*, *Minimal & Abstract*.
- Smart category pre-selection based on group type and name.
- Custom photo upload from device gallery with 16:9 cropping.
- Dynamic scrolling with page content (not pinned, preserving viewable screen area).

### F-2.3: Independent Group Avatar
- Circular group icon distinct from the group cover photo.
- Custom uploaded image or thematic icon representation.

### F-2.4: Member Invitations & Join Flow
- Join via 6-character code on the "Join Group" screen.
- Deep link / shareable link creation for WhatsApp, SMS, or Telegram.
- QR Code display and scan modal (`react-native-qrcode-svg`).

### F-2.5: Group Settings & Administration
- Edit group name, type, and currency.
- Member list viewer with role assignments (`admin` vs `member`).
- Member removal and group leave capabilities.
- Simplify Debts toggle.
- Default split type and default participant selection preferences.
- Notification toggles for expenses, settlements, and updates.
- Group activity log viewer.
- Archive group and delete group capabilities.

---

## 3. Expense Management & Bill Splitting

### F-3.1: Expense Creation & Editing
- Description input with real-time NLP category detection.
- Monetary amount input using the group's default currency.
- Date picker (defaults to today).
- Single payer selection (any group member).
- Multiple payers modal with individual contribution amounts summing to total.
- Active participant selector (select all, deselect, or individual toggles).

### F-3.2: 6 Mathematical Split Modes
1. **Equal (`equal`)**: Divides amount equally across selected participants; distributes remaining cents to avoid fractional drift.
2. **Unequal / Exact (`unequal`)**: Custom monetary amounts per participant; validates that sum equals total.
3. **Percentage (`percentage`)**: Custom percentage shares; validates that sum equals 100%; allocates rounding cents.
4. **Shares / Weights (`shares`)**: Multiplier shares (e.g. 1 share vs. 2 shares); calculates proportional allocations with remainder distribution.
5. **Adjustment (`adjustment`)**: Base equal split with custom positive/negative adjustments; validates adjustments net to zero.
6. **Itemized (`itemized`)**: Per-item costs assigned to specific participants with proportional auto-allocation of tax and tip.

### F-3.3: Intelligent Category Detection
- 23 canonical categories (Food, Coffee, Drinks, Transport, Fuel, Travel, Groceries, Shopping, Entertainment, Movies, Games, Utilities, Electricity, Water, Internet, Rent, Maintenance, Health, Fitness, Education, Gifts, Subscriptions, General).
- Multilingual dictionary supporting English, Hindi, Hinglish, Spanish, French, Portuguese, Indonesian, Mandarin, Japanese, and Arabic.
- Merchant keyword dictionary (Swiggy, Zomato, Uber, Blinkit, Zepto, Amazon, Starbucks, Netflix, etc.).
- Machine-learned category preferences stored locally in `AsyncStorage`.
- Manual user override protection: Once a user manually selects a category, NLP auto-detection is locked.

### F-3.4: Expense Lifecycle
- Real-time updates across group members.
- Soft-delete semantics (`isDeleted: true`) preserving audit trail.
- Expense restoration capability.

---

## 4. Balances, Settlements & Minimization

### F-4.1: Real-Time Group Balances
- Real-time calculation of net balance for every member:
  $$\text{Net Balance} = \sum \text{Paid} - \sum \text{Share} + \sum \text{Settlements In} - \sum \text{Settlements Out}$$
- Positive balance: Member is owed money (green).
- Negative balance: Member owes money (orange/red).
- Zero balance: Member is settled up.

### F-4.2: Debt Minimization (Simplification)
- Greedy graph minimization algorithm:
  - Partitions members into debtors and creditors.
  - Matches largest debtor with largest creditor iteratively.
  - Minimizes total transaction count from $O(N^2)$ to at most $N-1$ transactions.
- Bilateral mode: When simplification is disabled, pairwise direct debts are strictly preserved.

### F-4.3: Settlement Recording
- "Settle Up" modal pre-populating suggested payment amount.
- Direct member-to-member payment recording.
- Full or partial settlement support.
- Immediate recalculation of group and individual balances.

---

## 5. Friends & Direct Debts

### F-5.1: Friend Connections
- Add friends by email, phone, or join code.
- Accept or decline incoming friend requests.
- Remove friendships.

### F-5.2: Cross-Group Aggregated Balance
- Aggregates direct non-group expenses with all shared group balances for that specific friend.
- Single consolidated balance view: "You owe ₹500 across 2 groups" or "You are owed ₹1,200".

### F-5.3: Friend Transaction History
- Combined chronological timeline of shared expenses and settlements between two individuals across all mutual groups.

---

## 6. Analytics, Reports & Exports

### F-6.1: Visual Spending Charts
- Category breakdown Donut Chart with percentage shares and color-coded legends.
- Monthly expenditure bar chart comparing month-over-month trends.

### F-6.2: Export Engine
- **CSV Export**: Standard RFC-4180 compliant CSV spreadsheet containing Date, Description, Category, Paid By, Amount, and Member Shares.
- **Text Summary**: Plain text formatted financial summary ready to copy or share via messaging apps.

