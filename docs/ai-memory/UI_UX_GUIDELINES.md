# UI & UX Guidelines: Splitwiser Design System

This document specifies the visual identity, design tokens, component styling, motion, and interaction standards across Splitwiser.

---

## 1. Brand Identity & Color Palette

The Splitwiser visual language is anchored in an **Emerald Green** palette inspired by clean personal finance apps, complemented by modern neutral grays and high-contrast semantic accents.

### Primary Emerald Tones
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#059669` | Primary action buttons, active tab icons, links, positive balance highlights |
| `primaryDark` | `#065F46` | Header text, active press states, brand logos |
| `primaryLight` | `#ECFDF5` | Tag backgrounds, subtle button tints, selected option card backgrounds |
| `primaryBorder` | `#A7F3D0` | Subtle active borders, focus rings |

### Semantic Financial Colors
| Meaning | Hex | Token | Usage |
|---|---|---|---|
| **Lent / Positive Balance** | `#059669` | `positiveGreen` | "You are owed ₹1,200", received settlements, creditors |
| **Borrowed / Negative Balance** | `#EA580C` | `negativeOrange` | "You owe ₹500", pending debts, debtors |
| **Critical / Destructive** | `#DC2626` | `errorRed` | Delete expense, remove member, cancel actions |
| **Warning / Notice** | `#D97706` | `warningAmber` | Unsettled debt warnings, sync retry states |
| **Neutral / Settled** | `#6B7280` | `settledGray` | "All settled up", zero balance labels, timestamps |
| **Informational** | `#0284C7` | `infoBlue` | Friend requests, Google account sync indicators |

### Neutral Scale
| Token | Hex | Usage |
|---|---|---|
| `bgPrimary` | `#FFFFFF` | Card backgrounds, sheet modals, input surfaces |
| `bgSecondary` | `#F9FAFB` | Main screen background, subtle grouped list surfaces |
| `borderLight` | `#E5E7EB` | Hairline dividers, card outlines |
| `textPrimary` | `#111827` | Headings, primary titles, bill amounts |
| `textSecondary` | `#4B5563` | Subtitles, descriptions, secondary metadata |
| `textMuted` | `#9CA3AF` | Form placeholders, timestamps, inactive icons |

---

## 2. Typography Scale

Splitwiser relies on native system font stacks (`San Francisco` on iOS, `Roboto` on Android) for maximum legibility and zero font bundle overhead.

| Style Name | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `Display` | 28px | 34px | `800` (Bold) | Main screen hero balances, large headers |
| `Title 1` | 22px | 28px | `700` (Bold) | Screen titles, group names |
| `Title 2` | 18px | 24px | `700` (Bold) | Section headers, card titles, modal titles |
| `Subtitle` | 15px | 20px | `600` (Semi-bold) | Expense titles, member names, list headings |
| `Body` | 14px | 20px | `400` / `500` | Descriptions, metadata, secondary rows |
| `Caption` | 12px | 16px | `500` / `600` | Timestamps, badge labels, split shares |
| `Amount Large` | 32px | 38px | `800` (Bold) | Amount input screen, prominent balance displays |

---

## 3. Component Design Standards

### Avatars (`MemberAvatar` / `ProfileAvatar`)
- **Geometry**: Perfect circle (`borderRadius: size / 2`).
- **Standard Sizing**:
  - `24px` / `28px`: Compact inline badges, payer rows.
  - `36px` / `40px`: Expense list items, friend cards.
  - `48px` / `64px`: Group member cards, account screen header.
  - `80px` / `96px`: Profile photo modal preview, edit profile card.
- **Fallbacks**:
  - Valid image URL: Renders cached network image.
  - Loading error or missing URL: Renders colored circular initials avatar. Initials are generated from user's full name (first letter of first and last name, or single initial).
  - Background color is deterministically derived from user's UID or name for visual consistency.

### Group Cover Header (`GroupCoverHeader`)
- **Aspect Ratio**: 16:9 widescreen layout.
- **Scrolling Behavior**: The cover header is embedded directly inside the screen's main `ScrollView`. It scrolls naturally with the content rather than staying pinned, preserving valuable screen real estate on mobile viewports.
- **Overlay**: Subtle bottom dark gradient overlay (`rgba(0,0,0,0.4)`) ensures white group titles and category badges maintain high contrast over any background photograph.

### Modals & Bottom Sheets
- **Backdrop**: Semi-transparent dark overlay (`rgba(0,0,0,0.5)`).
- **Corner Radius**: Top corners curved (`borderTopLeftRadius: 20`, `borderTopRightRadius: 20`) for bottom sheets; fully curved (`borderRadius: 16`) for center dialogs.
- **Dismissibility**: Tap outside the card or swipe down smoothly dismisses the modal.

---

## 4. Haptic Feedback System (`hapticsService`)

Splitwiser incorporates comprehensive tactile feedback across all major touchpoints using `expo-haptics`.

### Haptic Trigger Map
| Action | Feedback Type | Code Reference |
|---|---|---|
| **Tab Change** | Light Impact | `hapticsService.impact(ImpactFeedbackStyle.Light)` |
| **Button Tap / Primary Action** | Medium Impact | `hapticsService.impact(ImpactFeedbackStyle.Medium)` |
| **Amount Keypad Tap** | Selection Change | `hapticsService.selection()` |
| **Save Expense / Settlement** | Success Notification | `hapticsService.notification(NotificationFeedbackType.Success)` |
| **Validation Error (e.g. Unbalanced Split)** | Error Notification | `hapticsService.notification(NotificationFeedbackType.Error)` |
| **Delete / Destructive Dialog** | Heavy Impact | `hapticsService.impact(ImpactFeedbackStyle.Heavy)` |

### User Configuration
- Haptics can be toggled on/off globally in **Account → Appearance / Haptic Feedback**.
- When disabled, `hapticsService.isEnabled()` returns `false` and all vibration triggers are silently suppressed without disrupting execution flow.

---

## 5. Dark Mode & Theming Support

The app provides dynamic theme switching across three modes:
1. `system`: Automatically matches OS appearance settings.
2. `light`: Enforces clean emerald and light gray backgrounds.
3. `dark`: Enforces high-contrast slate dark backgrounds (`#0F172A`, `#1E293B`) with emerald highlights.
All screens consume tokens from `useAppTheme()` to guarantee consistent contrast ratios (minimum 4.5:1 for normal text).

