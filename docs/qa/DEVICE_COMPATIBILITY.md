# Splitwiser Device & Viewport Compatibility Matrix

## 1. Target Configurations & Form Factors

| Config Code | Form Factor | Logical Resolution | Aspect Ratio | Representative Devices |
|---|---|---|---|---|
| **AND-SM** | Small Android | 360 x 640 dp | 16:9 | Samsung Galaxy A01, Nexus 5, Moto E |
| **AND-STD** | Standard Android | 390 x 844 dp | 19.5:9 | Google Pixel 7a, Samsung Galaxy S23 |
| **AND-LG** | Large Android | 412 x 915 dp | 20:9 | Google Pixel 8 Pro, Samsung Galaxy S24 Ultra |
| **TAB-MD** | Tablet | 768 x 1024 dp | 4:3 | iPad Mini, Samsung Galaxy Tab S7 (portrait) |
| **WEB-DT** | Web / Desktop | 1280 x 800+ px / Responsive | 16:10 | Google Chrome, Safari, Firefox, Edge |

---

## 2. Comprehensive Compatibility Matrix

| Screen / View | Feature Under Test | AND-SM (360px) | AND-STD (390px) | AND-LG (412px) | TAB-MD (768px) | WEB-DT (Desktop/Web) | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| **Splash** | Branding & Session Init | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Centered logo, smooth route transition |
| **Welcome** | Hero illustrations & Call-to-Actions | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Vertical scroll container prevents overflow on 360px |
| **AuthSelection** | Google OAuth & Guest Mode Buttons | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Min tap height 48dp, debounced tap handlers |
| **GuestProfileSetup** | Avatar Picker, Name & Currency selection | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | KeyboardAvoidingView handles soft keyboard properly |
| **IntroSlides** | 3 Walkthrough Slides with Dots & Skip | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Paging horizontal scroll, touch-friendly skip |
| **FirstSetupSelection** | Apartment / Trip / Friends Quick Start Cards | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Grid wraps cleanly; max-width constraint on tablet |
| **OnboardingGroupCreation** | Group Name input, Type selector, Currency | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Pre-populated suggested name; safe submit button |
| **JoinGroup** | 6-character code input & QR scanner | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⚠️ Partial (Web Camera) | Verified (Web fallback) | Camera scanning active on native; manual code on web |
| **Groups Home** | Group cards list, Net balance summary | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Pull-to-refresh, positive/negative balance contrast |
| **GroupDetails** | Expenses tab, Balances tab, Total stats | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Sticky header, segmented tabs switch smoothly |
| **AddExpense** | Amount input, Split method modal, Categories | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Numeric keypad, auto-category suggestions |
| **ExpenseDetails** | Split breakdown, Soft-delete, Edit action | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Confirmation dialog on delete, audit info visible |
| **SettleUpModal** | Pairwise settlement input, Recorded status | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Pre-filled suggested debt amount |
| **NotificationCenter** | Activity inbox, Unread tabs, Deep links | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Filter tabs (All, Unread, Expenses, Settlements) |
| **AccountScreen** | User profile, Google linking, Security toggle | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | Identity status badge, safe sign-out workflow |
| **SecurityLockScreen** | 4-digit PIN pad, Biometric prompt | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⚠️ N/A (Biometrics on Web) | Verified (PIN fallback) | PIN pad keypad accessible; lockout timer banner |
| **ExportModal** | CSV download & Text Summary clipboard copy | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | File download on Web; share sheet on mobile |
| **Theme / Appearance** | Light / Dark mode switching | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | 100% semantic token parity, no unreadable text |
| **Language / i18n** | 8 Locales + Arabic RTL layout mirroring | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | Fully Verified | RTL flex-direction inversion validated |

---

## 3. Viewport Specific Observations & Adaptations

### 3.1 Small Android (360px width)
- **Safe Area**: Tested with virtual navigation bar. All action buttons (`Save`, `Continue`, `Submit`) reside above bottom bar with `paddingBottom: 24dp`.
- **Typography**: Text labels wrap gracefully without clipping or truncation of crucial financial numbers. Currency amounts scale properly.

### 3.2 Large Android (412px width & Notches)
- **Status Bar Collision**: Tested on devices with centered punch-hole camera cutouts. App headers incorporate `useSafeAreaInsets().top` to prevent status bar collision.
- **High-Density Assets**: Vector icons (`lucide-react-native` and `@expo/vector-icons`) render sharp with zero pixelation.

### 3.3 Tablet (768px width)
- **Content Bounding**: Modal sheets and setup cards utilize `maxWidth: 600` centered styling to prevent uncomfortably stretched horizontal inputs.
- **Card Grids**: Group overview and category chips take advantage of wider horizontal real estate.

### 3.4 Web Browser (Desktop / Mobile Web)
- **OPFS Concurrency**: Fixed concurrency lock exception in `getDatabase()` warmup by isolating to native platforms (`Platform.OS !== 'web'`).
- **Camera Fallback**: QR scanner prompts manual 6-character group join code entry when WebRTC camera permissions are restricted.
