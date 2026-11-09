# Architecture Decision Records (ADRs): Splitwiser

This document records the permanent, immutable technical and product decisions governing the design and evolution of Splitwiser.

---

## ADR-001: 100% Free Forever Ethos (Zero Paywalls & Zero Advertisements)
- **Status**: **Accepted & Permanent**
- **Context**: Mainstream bill-splitting applications have paywalled fundamental utilities (search, receipt scanning, spending charts, currency conversions, and data exports) behind recurring $40+/year subscriptions.
- **Decision**: Splitwiser will remain 100% free with zero advertisements, zero premium tiers, and zero feature restrictions. Every implemented feature is fully available to every user.
- **Consequences**: Architecture must be cost-efficient. Heavy ML computation (such as category detection and debt minimization) runs client-side to minimize cloud compute overhead.

---

## ADR-002: Integer Minor Currency Units for Financial Math
- **Status**: **Accepted & Permanent**
- **Context**: Standard JavaScript floating-point numbers (`IEEE 754`) introduce binary representation errors (`0.1 + 0.2 === 0.30000000000000004`). In financial apps, this causes fractional cents to appear or disappear, leading to balance discrepancies.
- **Decision**: All financial math across splits, balances, and settlements must use integer minor units (cents, paise) via `src/utils/splitMath.ts`. Remainder cents are allocated deterministically 1-by-1 to participants.
- **Consequences**: No floating-point addition or multiplication is permitted on raw money amounts. Amounts are only converted to major decimal units for display.

---

## ADR-003: Decoupling of Payer Contributions and Participant Shares
- **Status**: **Accepted & Permanent**
- **Context**: Many bill splitters assume an expense has exactly one payer, or force complex workarounds when multiple people chip in for a large group bill.
- **Decision**: Who paid the money and who consumed the expense are strictly decoupled. Multi-payer contributions are supported and encoded cleanly (`payer:userId:amount`).
- **Consequences**: The balance calculation engine handles $M$ payers and $N$ consumers seamlessly.

---

## ADR-004: User-Selected Category Protection (Manual Override Immutability)
- **Status**: **Accepted & Permanent**
- **Context**: Real-time NLP category auto-detection is convenient, but frustrating if it repeatedly overrides a user's explicit manual category selection.
- **Decision**: Once a user explicitly chooses a category, or when editing an existing expense, automated NLP category detection is locked and will **never** overwrite the user's manual choice.
- **Consequences**: Protects user intent while providing smart defaults for unassisted entries.

---

## ADR-005: Separation of Group Avatar and Group Cover Photo
- **Status**: **Accepted & Permanent**
- **Context**: Groups have distinct visual contexts: compact circular icons for list items/cards, and wide horizontal banners for rich screen headers.
- **Decision**: Group Avatar (`Group.imageUrl`) and Group Cover Photo (`Group.coverPhoto`) are completely separate entities. Modifying one does not affect the other.
- **Consequences**: Users can set an icon or logo for the group while selecting a scenic 16:9 cover photo banner.

---

## ADR-006: Group Cover Photo Scrolls with Page Content
- **Status**: **Accepted & Permanent**
- **Context**: Sticky/pinned cover headers consume 30-40% of the mobile viewport, leaving insufficient space to view the expense list.
- **Decision**: The group cover photo is placed inside the main scroll view and scrolls naturally with the page content.
- **Consequences**: Maximizes vertical screen real estate for viewing group expenses and balances on mobile devices.

---

## ADR-007: Custom Avatar Priority Over Google Account Photo
- **Status**: **Accepted & Permanent**
- **Context**: Users authenticate via Google, which provides a default profile photo. However, users frequently prefer to upload a custom avatar.
- **Decision**: A strict 3-tier hierarchy is enforced:
  1. Manually uploaded custom photo (`photoSource === 'custom'`)
  2. Google account photo (`photoSource === 'google'`)
  3. Initials fallback (`photoSource === 'none'`)
  Subsequent Google logins or auth refreshes update `googlePhotoUrl` in the background but **must never overwrite** an active custom picture.
- **Consequences**: The user maintains total control over their public avatar.

---

## ADR-008: Offline-First Architecture with SQLite WAL and Durable Queue
- **Status**: **Accepted & Permanent**
- **Context**: Users frequently record expenses in places with poor cellular reception (restaurants, basements, remote travel locations).
- **Decision**: Splitwiser employs a local-first SQLite architecture (`splitwiser_offline.db`) in WAL mode. All mutations commit locally first and are enqueued in `sync_queue` for background transmission to Firestore.
- **Consequences**: Zero UI latency on writes; full functionality without an internet connection.

---

## ADR-009: Soft Deletions for Financial Audit Trails
- **Status**: **Accepted & Permanent**
- **Context**: Accidental hard deletions of expenses corrupt group accounting history and cause confusion among members.
- **Decision**: Expenses and settlements use soft deletion (`isDeleted: true`). They are omitted from balance calculations but preserved in the database for auditing and restoration.
- **Consequences**: No historical financial records are lost.

---

## ADR-010: Centralized Boundary, Overflow & Input Safety Architecture
- **Status**: **Accepted & Permanent**
- **Context**: Unbounded string inputs, extreme numerical values, floating point mismatches, and CSV formula injection can corrupt local SQLite databases, crash mobile rendering, or corrupt spreadsheet exports.
- **Decision**: All application thresholds and boundary conditions are centralized in `src/constants/limits.ts` (`APP_LIMITS`). Amounts are strictly bounded to 1 Billion major units and verified using safe integer minor units. Currency decimal precisions (0, 2, 3 digits) are enforced. Text inputs enforce hard `maxLength` boundaries. CSV exports sanitize formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Consequences**: Deterministic, crash-resilient input behavior across all screens and models.

---

## ADR-011: Target Platform — Android Only
- **Status**: **Accepted & Permanent**
- **Context**: The project's target deployment, distribution model, hardware optimization, and testing requirements are focused entirely on Android. Maintaining dual-platform abstractions (such as iOS Info.plist, APNs, Xcode schemes) introduces unnecessary maintenance overhead.
- **Decision**: Splitwiser is strictly an **Android-exclusive** project. All features, native permissions, Google Play Services integrations, build scripts (`build:apk`, `build:aab`), and UI navigation patterns are built and validated exclusively for Android (Android 15 / API 35+, package `com.splitwiser.app`).
- **Consequences**:
  - Development and QA focus 100% on Android OS.
  - Native Google Sign-In relies directly on Android Google Play Services (`google-services.json`).
  - Builds target local APK and production AAB files via EAS.
  - iOS support is explicitly excluded and out of scope.

