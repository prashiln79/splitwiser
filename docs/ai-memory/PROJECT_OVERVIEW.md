# Project Overview: Splitwiser

## 1. Executive Summary

**Splitwiser** is a modern, Android-targeted mobile expense-sharing and group bill-splitting application built with **React Native**, **Expo SDK 58**, **TypeScript**, and **Firebase**.

Inspired by Splitwise, Splitwiser provides an intuitive, high-performance, and delightful experience for roommates, travel groups, couples, and friends to track shared expenses, compute bilateral or simplified group balances, record settlements, and analyze spending patterns. The application is architected and optimized exclusively for the Android ecosystem (Android 15 / API 35+, Google Play Services, Material UI, APK/AAB distribution).

### The Splitwiser Mission
Unlike commercial expense splitting alternatives that have paywalled core features (such as receipt scanning, charts, search, export, and currency switching) behind subscription tiers ($40+/year), **Splitwiser is 100% free forever**. Every single user receives access to every feature without restrictions, upsells, or advertisements.

---

## 2. Technical Stack Summary

| Layer | Technologies |
|---|---|
| **Target Platform** | **Android Only** (Android 15 / API 35+, Google Play Services, Package `com.splitwiser.app`) |
| **Mobile Runtime** | React Native 0.88.1, React 19.3.0, Expo SDK ~58.0.0 |
| **Language** | TypeScript ~5.3.3 |
| **Authentication** | Firebase Authentication (Anonymous guest accounts, Google Sign-In with OAuth credentials) |
| **Cloud Database** | Cloud Firestore (Standard mode, multi-region `money-manager-b394e`) |
| **Cloud Storage** | Firebase Storage (User avatars, group cover photos) |
| **Local Database** | `expo-sqlite` (~58.0.15) with WAL mode enabled (`splitwiser_offline.db`) |
| **Offline Sync Engine** | Custom two-way durable transaction queue with SQLite and Firestore listeners |
| **Navigation** | `@react-navigation/native` v7, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` |
| **UI Components** | Custom design system built with `react-native-paper` 5.14.5 and `lucide-react-native` 1.67.0 |
| **Charts** | Custom SVG data visualizers using `react-native-svg` (Donut charts, Monthly bar trends) |
| **Image Processing** | `expo-image-manipulator` (auto-resize, compress to 400x400 JPEG), `expo-image-picker` |
| **Hardware APIs** | `expo-camera`, `expo-haptics`, `expo-secure-store`, `@react-native-community/netinfo` |
| **Test Runner** | `npx tsx` running Node.js native assertions across 6 test suites |

---

## 3. Core Architectural Principles

### 1. Offline-First Durability
The application operates fully offline. Users can launch the app without internet access, view existing groups and expenses, create new expenses, record settlements, and update profile data. Mutations are committed synchronously to SQLite and placed into a durable `sync_queue` table with retry counters and exponential backoff.

### 2. Fractional Penny Reconciliation (Zero Drift)
All financial calculations operate in integer minor currency units (cents, paise). When ₹100.00 is split across 3 people:
- Person 1 pays: ₹33.34 (3334 cents)
- Person 2 pays: ₹33.33 (3333 cents)
- Person 3 pays: ₹33.33 (3333 cents)
- **Total sum is guaranteed to be exactly ₹100.00 (10000 cents)**. Remainder pennies are systematically distributed to eliminate floating-point drift.

### 3. Payer vs. Split Decoupling
Splitwiser separates who contributed money from who consumed the expense:
- **Payer Contributions**: Supports single payer or multiple payers (e.g. Alice paid ₹600 and Bob paid ₹400 for a ₹1000 dinner).
- **Participant Shares**: Supports 6 distinct mathematical split modes:
  1. `equal`: Divided equally with penny-remainder resolution.
  2. `unequal`: Exact monetary amounts specified per participant.
  3. `percentage`: Percentage allocations summing to 100%.
  4. `shares`: Relative weights (e.g., 2 shares vs. 1 share).
  5. `adjustment`: Base equal split modified by positive/negative individual adjustments.
  6. `itemized`: Per-item prices with automatic proportional distribution of taxes and tips.

### 4. Smart Debt Minimization (Simplification)
Groups can toggle between:
- **Simplified Debts (`simplifyDebts: true`)**: A client-side graph algorithm that consolidates transitive group debts into the absolute minimum number of settlement transactions.
- **Direct Pairwise Debts (`simplifyDebts: false`)**: Preserves bilateral debts strictly between the original debtor and creditor.

### 5. Multi-Tier Profile Photo Hierarchy
User avatars follow a strict priority cascade:
1. **Custom Uploaded Photo** (`photoSource === 'custom'`)
2. **Google Account Photo** (`photoSource === 'google'`)
3. **Initials Fallback** (`photoSource === 'none'`)
Subsequent Google logins sync the external URL in the background but **never overwrite** a manually selected avatar.

---

## 4. Repository Structure

```
splitwiser/
├── App.tsx                    # Application root, providers setup, SQLite warmup
├── index.js                   # Expo root entrypoint
├── app.json                   # Expo application manifest, permissions, plugins
├── package.json               # Dependencies, build scripts, test scripts
├── firestore.rules            # Firestore security rules
├── src/
│   ├── config/                # Firebase initialization & Google Auth webClientId
│   ├── context/               # AuthContext (user session, profile sync, Google login)
│   ├── db/                    # SQLite database schema, WAL pragmas, migrations
│   ├── navigation/            # BottomTab + Stack navigators
│   ├── screens/               # 12 Primary application screens
│   ├── components/
│   │   ├── common/            # Reusable UI (Avatars, Covers, Modals, Charts, Badges)
│   │   ├── expense/           # Payer & Split configuration modals, participant rows
│   │   ├── groupSettings/     # Settings modals (Members, Export, Notifications, etc.)
│   │   └── ui/                # Haptic-enhanced buttons, cards, checkboxes, FABs
│   ├── services/              # Business logic (Expenses, Groups, Settlements, Sync, ML)
│   │   └── categoryDetector/  # 23-category multilingual NLP detector
│   ├── repositories/          # SQLite persistence adapters (CRUD, upsert, queries)
│   ├── sync/                  # Network monitor, sync queue processor, cursors
│   ├── theme/                 # Light/Dark theme tokens & typography
│   ├── types/                 # Central TypeScript models and interfaces
│   └── utils/                 # Split math, balance calculations, image compressor
└── tests/                     # 6 Automated unit test suites (200+ test cases)
```

