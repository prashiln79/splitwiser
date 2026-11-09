# Testing Strategy & Automated Test Suites: Splitwiser

This document details the test runner architecture, automated test suites, coverage areas, and guidelines for adding new tests.

---

## 1. Testing Philosophy & Architecture

Splitwiser prioritizes **zero-regression financial safety** and deterministic business logic validation.

### Key Tenets
1. **Zero Drift**: Financial split math, balance calculations, and debt simplifications must be proven by exhaustive unit assertions with integer arithmetic verification.
2. **Fast Execution**: Tests execute via `npx tsx` directly against TypeScript source files using Node.js native `assert` modules, completing the full test run across all 6 suites in under 3 seconds.
3. **Continuous Verification**: All changes must pass both `npm run ts:check` (strict TypeScript compilation with 0 errors) and `npm test` before deployment.

---

## 2. Test Suites Inventory

| Suite Command | File | Test Cases | Domain & Scope |
|---|---|---|---|
| `npm run test:balances` | `tests/balanceCalculator.test.ts` | 12 Scenarios | Single payer, multi-payer tags, bilateral balances, cross-group friend balances, settlements, soft-delete isolation. |
| `npm run test:covers` | `tests/coverPhoto.test.ts` | 6 Scenarios | Category presets, deterministic hashing fallback, catalog integrity (29 presets), smart category detection. |
| `npm run test:settings` | `tests/groupSettings.test.ts` | 7 Scenarios | 7 group types, notification defaults, simplified vs direct pairwise debts, CSV export RFC-4180 compliance, text summary, date filters. |
| `npm run test:splitmath` | `tests/splitMath.test.ts` | 30+ Assertions | Minor-unit conversions, remainder penny distribution, equal, unequal, percentage, shares, adjustments, itemized taxes & tips. |
| `npm run test:categories` | `tests/categoryDetector.test.ts` | 156 Test Cases | 23 canonical categories, merchant brands, multilingual tokens (10 languages), regional Hinglish vocabulary, manual override locking. |
| `npm run test:profilephoto`| `tests/profilePhoto.test.ts` | 10 Scenarios | Initial Google photo sync, no-photo fallback, custom photo priority, subsequent Google login protection, URL validation. |

**Total Automated Assertions**: Over 220 automated test cases with 100% pass rate.

---

## 3. Running Test Suites

### Run All Tests
```bash
npm test
```

### Run Strict TypeScript Type Check
```bash
npm run ts:check
```

### Run Individual Test Suites
```bash
npm run test:balances
npm run test:covers
npm run test:settings
npm run test:splitmath
npm run test:categories
npm run test:profilephoto
```

---

## 4. Test Scenario Summaries

### 4.1 Balance Calculations (`tests/balanceCalculator.test.ts`)
- **Scenario 1**: Alice pays ₹1000 for Alice and Bob $\to$ Bob owes Alice ₹500.
- **Scenario 2**: Bob pays ₹1000 for Alice and Bob $\to$ Alice owes Bob ₹500 (negative balance -500).
- **Scenario 3**: Multi-expense net balance consolidation.
- **Scenario 4 & 5**: Bilateral cross-group debt combination with direct expenses:
  $$\text{Goa Trip (+₹1200)} - \text{Apt (-₹300)} + \text{Direct (+₹250)} = \text{Net +₹1150}$$
- **Scenario 6**: Partial settlement reduces remaining balance accurately.
- **Scenario 7**: Full settlement results in exact ₹0 balance.
- **Scenario 8**: Soft-deleted expense (`isDeleted: true`) is strictly excluded from balance calculation.
- **Scenario 9**: Third-party payer in a group does not create bilateral debt between uninvolved members.
- **Scenario 10**: Multi-payer expense (Alice paid ₹600, Bob paid ₹400 for a ₹1000 expense split ₹500 each) correctly yields Alice net +₹100 and Bob net -₹100.

### 4.2 Split Math Engine (`tests/splitMath.test.ts`)
- **Penny Distribution**: ₹100 split 3 ways yields [₹33.34, ₹33.33, ₹33.33] summing to exactly 10000 cents.
- **Percentages**: 50%, 30%, 20% on ₹100 yields [₹50.00, ₹30.00, ₹20.00] with zero drift.
- **Shares**: 2 shares vs 1 share on ₹100 yields [₹66.67, ₹33.33].
- **Adjustments**: Offsets netting to ₹0 are validated; unbalanced offsets throw validation errors.
- **Itemized Bill**: Proportional tax and tip distribution based on individual food subtotals.

### 4.3 Profile Photo & Google Sync (`tests/profilePhoto.test.ts`)
- **Test 1**: Initial Google login captures photo URL and sets active `imageUrl`.
- **Test 2**: Login without photo falls back to initials (`photoSource: 'none'`).
- **Test 3**: Custom upload takes highest priority over Google photo.
- **Test 4**: Subsequent Google login refreshes `googlePhotoUrl` without overwriting an active custom avatar.
- **Test 5**: External Google photo updates sync when `photoSource === 'google'`.
- **Test 6**: Switching back to Google picture restores Google photo without deleting custom URL.
- **Test 7 & 8**: Removing custom photo falls back to Google photo if present, or initials.
- **Test 9**: Email/password users manage custom avatars independently.
- **Test 10**: Broken or empty URLs fallback cleanly to initials.

---

## 5. Guidelines for Writing New Tests

1. Create test files under `tests/` with the `.test.ts` extension.
2. Use Node.js built-in `assert` for assertions:
   ```typescript
   import assert from 'assert';
   assert.strictEqual(actual, expected, 'Descriptive message');
   ```
3. Add a dedicated npm script in `package.json` (`test:<domain>`) and append it to the main `npm test` pipeline.
4. Always test both valid scenarios and edge cases (e.g. 0 count, negative inputs, null values, invalid strings).

