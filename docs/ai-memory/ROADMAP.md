# Product Roadmap: Splitwiser

This document tracks the prioritized engineering and product roadmap, organized by release milestone.

---

## v2.1 — Receipt Intelligence & Smart Capture

| Feature | Priority | Status | Description |
|---|---|---|---|
| **Receipt OCR Parser** | P0 | Planned | Integrate on-device Gemini API (or Google Vision) to extract line items, merchant name, total amount, and category directly from a photo. |
| **Itemized Bill Auto-Fill** | P0 | Planned | Auto-populate the Itemized Split configuration from OCR extracted line items, eliminating manual entry. |
| **Camera Improvements** | P1 | Partial | Improve camera exposure auto-focus and crop guide overlay for consistent receipt positioning. |

---

## v2.2 — Push Notifications & Activity Feed

| Feature | Priority | Status | Description |
|---|---|---|---|
| **FCM Push Notifications** | P0 | Planned | Deploy Firebase Cloud Functions to dispatch FCM push payloads when: group expenses are added, settlements are recorded, reminders are triggered. |
| **FCM Topic Subscriptions** | P1 | Planned | Subscribe users to per-group topics for minimal server fan-out. |
| **Activity Feed Screen** | P1 | Planned | Dedicated timeline screen showing recent activity across all groups (new expenses, edits, settlements, member join/leave events). |

---

## v2.3 — Multi-Currency & Live FX Rates

| Feature | Priority | Status | Description |
|---|---|---|---|
| **Per-Expense Currency Override** | P0 | Planned | Allow individual expenses to be recorded in a foreign currency (e.g. a USD hotel bill inside an INR group). |
| **Live FX Rate API** | P0 | Planned | Integrate exchange rate provider (e.g. Open Exchange Rates or Fixer.io) for real-time currency conversions. |
| **Currency Conversion in Balance View** | P1 | Planned | Display balances consolidated in the group's base currency after applying live exchange rate conversions. |

---

## v2.4 — Enhanced Reports & PDF Export

| Feature | Priority | Status | Description |
|---|---|---|---|
| **PDF Receipt Generation** | P1 | Planned | Generate a fully formatted PDF group financial report suitable for e-mailing or saving to files. |
| **Advanced Analytics Screen** | P1 | Planned | Expand `StatisticsScreen` with: filterable date ranges, per-category monthly comparisons, year-over-year trend analysis. |

---

## v2.5 — Recurring Expenses & Reminders

| Feature | Priority | Status | Description |
|---|---|---|---|
| **Recurring Expense Templates** | P2 | Planned | Auto-create monthly recurring expenses (rent, Wi-Fi, electricity) on a defined schedule (daily, weekly, monthly). |
| **Smart Debt Reminders** | P2 | Planned | Automatically send payment reminders to group members with unsettled balances older than a user-defined threshold. |
| **Reminder Configuration** | P2 | Planned | Configure reminder frequency (3 days, 1 week, 2 weeks) with mute options. |

---

## v3.0 — Payments, Social & Automation

| Feature | Priority | Status | Description |
|---|---|---|---|
| **UPI/PhonePe/GPay Deep Link** | P2 | Planned | Auto-generate a UPI payment deep link when recording a settlement, allowing one-tap payment launch. |
| **WhatsApp/Telegram Bot** | P3 | Planned | Record expenses from WhatsApp or Telegram group chats via a @SplitBot integration. |
| **AI Expense Coach** | P3 | Planned | Personalized spending insights: "You spent 40% more on dining this month vs. last month". |
