# Splitwiser AI Project Memory System

> **Welcome to the Splitwiser AI Project Memory System.**  
> This documentation suite provides an exhaustive, self-contained, and deterministic source of truth for AI coding agents and human engineers alike. Every document reflects the actual implemented source code verified against the repository.

---

## 🧭 Navigation & Document Sitemap

| # | Document | Scope & Purpose |
|---|----------|-----------------|
| 01 | [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | High-level mission, tech stack, open-source 100% free ethos, and core architecture principles. |
| 02 | [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Product requirements document (PRD), user personas, performance targets, and non-functional requirements. |
| 03 | [FEATURES.md](./FEATURES.md) | Complete functional catalog of all system features organized by domain. |
| 04 | [FEATURE_STATUS.md](./FEATURE_STATUS.md) | Verified implementation audit: Implemented, Partially Implemented, Planned, Not Implemented, or Deprecated. |
| 05 | [USER_FLOWS.md](./USER_FLOWS.md) | End-to-end journey maps, screen transitions, state flows, and edge cases. |
| 06 | [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) | Design system, emerald color palette, typography scale, component standards, haptics, and theming. |
| 07 | [TECH_ARCHITECTURE.md](./TECH_ARCHITECTURE.md) | System architecture, navigation tree, repository pattern, offline-first SQLite, sync engine, and state management. |
| 08 | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete entity relational diagrams, Firestore document hierarchy, and SQLite local database tables. |
| 09 | [FIREBASE_RULES.md](./FIREBASE_RULES.md) | Cloud Firestore and Firebase Storage security rules audit, access control models, and production hardening. |
| 10 | [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) | Core invariants, group member roles, soft deletion semantics, settlement rules, and friendship lifecycles. |
| 11 | [EXPENSE_CALCULATIONS.md](./EXPENSE_CALCULATIONS.md) | Minor-unit integer arithmetic, remainder penny distribution, 6 split algorithms, and debt minimization mathematics. |
| 12 | [CATEGORY_DETECTION.md](./CATEGORY_DETECTION.md) | 23-category intelligent detector, multilingual NLP lexicons, merchant patterns, and learned preferences. |
| 13 | [INTEGRATIONS.md](./INTEGRATIONS.md) | External SDKs, Google Sign-In, Firebase Auth/Firestore/Storage, Expo modules, and camera/media pipelines. |
| 14 | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Test framework architecture, 6 test suites, 200+ unit assertions, and test authoring standards. |
| 15 | [DECISIONS.md](./DECISIONS.md) | Architecture Decision Records (ADRs) capturing permanent technical and business constraints. |
| 16 | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Known bugs, open development caveats, performance considerations, and edge-case behaviors. |
| 17 | [ROADMAP.md](./ROADMAP.md) | Prioritized future engineering roadmap (Receipt OCR, Cloud Functions push notifications, live FX). |
| 18 | [CHANGELOG.md](./CHANGELOG.md) | Chronological version history from initial release to v2.0.1. |

---

## ⚡ Quick Reference Card

### Core Tech Stack
- **Target Platform**: **Android Only** (Android 15 / API 35+, Google Play Services, APK/AAB local build profiles)
- **Framework**: React Native 0.88.1, Expo SDK 58, React 19.3.0
- **Language**: TypeScript 5.3+ (Strict Mode)
- **Local Database**: `expo-sqlite` (WAL Mode enabled, persistent local cache)
- **Backend**: Firebase 12.19.0 (Authentication, Cloud Firestore, Firebase Storage)
- **Navigation**: React Navigation v7 (Native Stack + Bottom Tabs)
- **UI Components**: Custom design system styled on React Native Paper + Lucide React Native icons
- **Haptics**: `expo-haptics` managed via centralized `hapticsService`

### Critical Immutable Rules
1. **Target Platform: Android Exclusive**: The project is engineered, tested, and targeted exclusively for Android (Google Play Services, Android 15/API 35, Material Design, local EAS APK/AAB builds). iOS deployment is intentionally out of scope.
2. **100% Free / No Paywalls**: Splitwiser has zero Pro subscriptions, zero feature locks, and zero advertisements.
3. **Integer Minor Currency Units**: All financial calculations are stored in integer cents/paise (`toCents`, `fromCents`) to eliminate floating-point arithmetic drift.
4. **Payer Contributions vs. Participant Shares**: Who paid and who consumed are strictly decoupled.
5. **Manual Category Protection**: User-selected categories are NEVER overwritten by automatic NLP category detection.
6. **Avatar vs. Cover Separation**: Group avatars (circular identifiers) and Group cover photos (horizontal header banners) are completely independent.
7. **User Profile Picture Priority**:
   - 1. Manually uploaded custom photo (`photoSource === 'custom'`)
   - 2. Google account photo (`photoSource === 'google'`)
   - 3. Initials fallback (`photoSource === 'none'`)
   - Subsequent Google logins NEVER overwrite a custom uploaded avatar.
8. **Offline-First Synchronization**: Local writes commit immediately to SQLite and queue mutations in `sync_queue` for two-way synchronization with Firestore.

---

## 🤖 Instructions for AI Coding Agents

When working on this repository:
1. **Read Before Editing**: Consult the relevant memory file before altering any business logic, calculations, or navigation routes.
2. **Preserve Financial Accuracy**: Never use standard floating-point addition/multiplication on money amounts. Always use `src/utils/splitMath.ts`.
3. **Run Tests After Any Modification**:
   ```bash
   npm run ts:check
   npm test
   ```
4. **Do Not Commit Directly**: The user requires all modifications to be left in the working tree uncommitted unless explicitly instructed to run git commands.

