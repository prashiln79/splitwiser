# Known Issues & Caveats: Splitwiser

This document tracks known technical limitations, development-mode caveats, and architectural edge cases.

---

## 1. Security & Environment Caveats

### KI-001: Permissive Firestore Security Rules in Development
- **Severity**: **High (Prior to Public Release)**
- **Description**: The current `firestore.rules` file allows open read/write access (`allow read, write: if true;`) to facilitate rapid local prototyping and test data population.
- **Remediation**: Before publishing the application to the Google Play Store or Apple App Store, the hardened production security rules documented in `docs/ai-memory/FIREBASE_RULES.md` must be deployed to Cloud Firestore.

### KI-002: Google Sign-In Native SHA-1 Dependency
- **Severity**: **Medium (Local Development)**
- **Description**: Google Sign-In on Android requires that the developer's local debug keystore SHA-1 fingerprint matches an `oauth_client` entry in Firebase Console / `google-services.json`.
- **Workaround**: When testing on Android devices with newly generated debug keystores, the developer must register their SHA-1 in the Firebase Console and download the updated `google-services.json`.

---

## 2. Feature & Functional Limitations

### KI-003: Receipt OCR Parsing Not Yet Wired
- **Severity**: **Low**
- **Description**: The receipt scanner camera modal is present in `AddExpenseScreen.tsx`, but on-device vision OCR extraction and item line-by-line parsing is planned for v2.1.
- **Current Behavior**: Users can take or select a receipt photo to attach, but line items must currently be entered manually.

### KI-004: FCM Cloud Functions Push Notification Dispatch
- **Severity**: **Low**
- **Description**: Group notification preferences (mute, new expense alerts, settlement notifications) are stored in Firestore and configurable via `GroupNotificationsModal.tsx`. However, the server-side Firebase Cloud Function to dispatch push notification payloads via FCM is not yet deployed.
- **Current Behavior**: Preferences are saved and synchronized, but remote background notifications are not yet triggered.

### KI-005: Single Base Currency per Group
- **Severity**: **Low**
- **Description**: Each group operates in a single base currency (e.g. INR ₹ or USD $). If members incur travel expenses in a foreign currency, they must manually convert the amount before entry.
- **Planned Enhancement**: Dynamic multi-currency conversions with live FX exchange rates are scheduled in the product roadmap.

### KI-006: Presets Offline Image Cache
- **Severity**: **Low**
- **Description**: The 29 curated preset group cover photos load from optimized Unsplash CDN URLs. If an offline user opens a group whose cover was not previously cached in device memory, a neutral emerald gradient placeholder is displayed until an internet connection is re-established.

