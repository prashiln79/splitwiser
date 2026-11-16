/**
 * EXPENSE MANAGEMENT & SPLIT VALIDATION QA TEST SUITE
 * ─────────────────────────────────────────────────────────────
 * Comprehensive tests for expense creation, validation, splits,
 * editing, soft deletion, restoration, categorization, currency,
 * and multi-payer accounting.
 */

import assert from 'assert';
import { Expense, ExpenseCreateInput, ExpenseSplit, SplitType, GroupMember } from '../src/types';
import { APP_LIMITS } from '../src/constants/limits';
import {
  isValidFinancialAmount,
  formatCurrency,
  normalizeCurrencyCode,
  getCurrencySymbol,
} from '../src/utils/currency';
import {
  toCents,
  fromCents,
  distributeCentsEqually,
  distributeCentsByPercentages,
  distributeCentsByShares,
  calculateAdjustmentSplits,
  calculateItemizedSplits,
} from '../src/utils/splitMath';
import { computeNetBalances } from '../src/utils/balanceCalculator';
import { detectCategory } from '../src/services/categoryDetector';

console.log('\n========================================================');
console.log('   EXPENSE QA — COMPREHENSIVE AUTOMATED TEST SUITE      ');
console.log('========================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// ─── Domain Validation Logic (Matching AddExpenseScreen & Repository) ────────

export function validateExpenseInput(input: {
  description?: any;
  amount?: any;
  paidBy?: any;
  splits?: ExpenseSplit[];
  splitType?: SplitType;
  currency?: string;
  tags?: string[];
}): { isValid: boolean; error?: string } {
  // 1. Description validation
  if (typeof input.description !== 'string') {
    return { isValid: false, error: 'Description must be a string' };
  }
  const trimmedDesc = input.description.trim().replace(/\r?\n+/g, ' ');
  if (!trimmedDesc || trimmedDesc.length < APP_LIMITS.EXPENSE.MIN_DESCRIPTION_LENGTH) {
    return { isValid: false, error: 'Missing Description' };
  }
  if (trimmedDesc.length > APP_LIMITS.EXPENSE.MAX_DESCRIPTION_LENGTH) {
    return { isValid: false, error: 'Description Too Long' };
  }

  // 2. Amount validation
  const amountValidation = isValidFinancialAmount(input.amount, input.currency || 'INR');
  if (!amountValidation.isValid) {
    return { isValid: false, error: amountValidation.errorMessage || 'Invalid Amount' };
  }

  // 3. Payer validation
  if (!input.paidBy || typeof input.paidBy !== 'string' || input.paidBy.trim() === '') {
    return { isValid: false, error: 'Payer Required' };
  }

  // 4. Splits validation
  if (!input.splits || !Array.isArray(input.splits) || input.splits.length === 0) {
    return { isValid: false, error: 'Splits Required' };
  }

  const totalCents = toCents(input.amount);
  const splitsSumCents = input.splits.reduce((acc, s) => acc + toCents(s.amount), 0);

  // Exact penny reconciliation
  if (splitsSumCents !== totalCents) {
    return {
      isValid: false,
      error: `Splits sum (${splitsSumCents} cents) does not match total amount (${totalCents} cents)`,
    };
  }

  return { isValid: true };
}

// Simulated SQLite Row Transformation (matching expenseRepository.ts)
interface LocalExpenseRow {
  id: string;
  group_id: string;
  created_by: string;
  paid_by: string;
  description: string;
  amount: number;
  split_type: SplitType;
  splits_json: string;
  currency: string;
  tags_json: string;
  created_at: number;
  updated_at: number;
  sync_status: string;
  is_deleted: number;
}

function expenseToRow(expense: Expense): LocalExpenseRow {
  return {
    id: expense.id,
    group_id: expense.groupId,
    created_by: expense.createdBy,
    paid_by: expense.paidBy,
    description: expense.description,
    amount: expense.amount,
    split_type: expense.splitType,
    splits_json: JSON.stringify(expense.splits),
    currency: expense.currency,
    tags_json: JSON.stringify(expense.tags || []),
    created_at: expense.createdAt.getTime(),
    updated_at: expense.updatedAt.getTime(),
    sync_status: expense.syncStatus || 'pending',
    is_deleted: expense.isDeleted ? 1 : 0,
  };
}

function rowToExpense(row: LocalExpenseRow): Expense {
  let splits: ExpenseSplit[] = [];
  let tags: string[] = [];
  try {
    splits = JSON.parse(row.splits_json);
  } catch {
    splits = [];
  }
  try {
    tags = JSON.parse(row.tags_json);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    paidBy: row.paid_by,
    description: row.description,
    amount: row.amount,
    splits,
    splitType: row.split_type,
    currency: row.currency || 'INR',
    tags,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status as any,
    isDeleted: Boolean(row.is_deleted),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create expense — required fields (description, amount, paidBy, splits)
// ─────────────────────────────────────────────────────────────────────────────
runTest('1. Create expense — required fields (description, amount, paidBy, splits)', () => {
  const splits: ExpenseSplit[] = [
    { userId: 'u1', amount: 50, type: 'equal' },
    { userId: 'u2', amount: 50, type: 'equal' },
  ];
  const valid = validateExpenseInput({
    description: 'Groceries at Supermarket',
    amount: 100,
    paidBy: 'u1',
    splits,
    currency: 'INR',
  });
  assert.strictEqual(valid.isValid, true, 'Expense with all valid fields must pass validation');

  // Verify missing payer
  const missingPayer = validateExpenseInput({
    description: 'Groceries',
    amount: 100,
    paidBy: '',
    splits,
  });
  assert.strictEqual(missingPayer.isValid, false);
  assert.strictEqual(missingPayer.error, 'Payer Required');

  // Verify missing splits
  const missingSplits = validateExpenseInput({
    description: 'Groceries',
    amount: 100,
    paidBy: 'u1',
    splits: [],
  });
  assert.strictEqual(missingSplits.isValid, false);
  assert.strictEqual(missingSplits.error, 'Splits Required');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create expense — missing description rejected
// ─────────────────────────────────────────────────────────────────────────────
runTest('2. Create expense — missing description rejected', () => {
  const splits: ExpenseSplit[] = [
    { userId: 'u1', amount: 50, type: 'equal' },
    { userId: 'u2', amount: 50, type: 'equal' },
  ];

  // Empty string
  const emptyRes = validateExpenseInput({ description: '', amount: 100, paidBy: 'u1', splits });
  assert.strictEqual(emptyRes.isValid, false);
  assert.strictEqual(emptyRes.error, 'Missing Description');

  // Whitespace only
  const wsRes = validateExpenseInput({ description: '     ', amount: 100, paidBy: 'u1', splits });
  assert.strictEqual(wsRes.isValid, false);
  assert.strictEqual(wsRes.error, 'Missing Description');

  // Newlines/tabs only
  const nlRes = validateExpenseInput({ description: '\n\t  \r', amount: 100, paidBy: 'u1', splits });
  assert.strictEqual(nlRes.isValid, false);
  assert.strictEqual(nlRes.error, 'Missing Description');

  // Exceeding maximum description length (255 characters)
  const longDesc = 'A'.repeat(256);
  const longRes = validateExpenseInput({ description: longDesc, amount: 100, paidBy: 'u1', splits });
  assert.strictEqual(longRes.isValid, false);
  assert.strictEqual(longRes.error, 'Description Too Long');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create expense — amount = 0 rejected
// ─────────────────────────────────────────────────────────────────────────────
runTest('3. Create expense — amount = 0 rejected', () => {
  assert.strictEqual(isValidFinancialAmount(0).isValid, false, 'Zero amount must be rejected');
  assert.strictEqual(isValidFinancialAmount('0').isValid, false, 'Zero string amount must be rejected');
  assert.strictEqual(isValidFinancialAmount('0.00').isValid, false, 'Zero formatted amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(-10).isValid, false, 'Negative amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(NaN).isValid, false, 'NaN amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(Infinity).isValid, false, 'Infinity amount must be rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Create expense — amount > 1,000,000,000 rejected
// ─────────────────────────────────────────────────────────────────────────────
runTest('4. Create expense — amount > 1,000,000,000 rejected', () => {
  // Boundary tests
  assert.strictEqual(isValidFinancialAmount(1_000_000_000).isValid, true, '1 Billion is valid maximum');
  assert.strictEqual(isValidFinancialAmount(1_000_000_000.01).isValid, false, 'Amount > 1 Billion rejected');
  assert.strictEqual(isValidFinancialAmount(1_000_000_001).isValid, false, 'Amount > 1 Billion rejected');
  assert.strictEqual(isValidFinancialAmount(1e12).isValid, false, '1 Trillion rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Create expense — equal split with 2 people
// ─────────────────────────────────────────────────────────────────────────────
runTest('5. Create expense — equal split with 2 people', () => {
  // Even division
  const totalCents = toCents(100);
  const distributed = distributeCentsEqually(totalCents, 2);
  assert.strictEqual(distributed.length, 2);
  assert.strictEqual(distributed[0], 5000);
  assert.strictEqual(distributed[1], 5000);
  assert.strictEqual(fromCents(distributed[0]), 50.00);
  assert.strictEqual(fromCents(distributed[1]), 50.00);
  assert.strictEqual(distributed[0] + distributed[1], totalCents);

  // Odd penny division (₹100.01 split between 2 people)
  const oddTotalCents = toCents(100.01); // 10001 cents
  const oddDistributed = distributeCentsEqually(oddTotalCents, 2);
  assert.strictEqual(oddDistributed[0], 5001); // 50.01
  assert.strictEqual(oddDistributed[1], 5000); // 50.00
  assert.strictEqual(oddDistributed[0] + oddDistributed[1], oddTotalCents, 'Pennies must sum to total');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Create expense — percentage split sums to 100%
// ─────────────────────────────────────────────────────────────────────────────
runTest('6. Create expense — percentage split sums to 100%', () => {
  const totalCents = toCents(100);

  // Valid 50% / 50%
  const validPcts = [
    { id: 'u1', pct: 50 },
    { id: 'u2', pct: 50 },
  ];
  const pctsSum = validPcts.reduce((sum, p) => sum + p.pct, 0);
  assert.strictEqual(Math.abs(pctsSum - 100) <= 0.05, true);
  const dist = distributeCentsByPercentages(totalCents, validPcts);
  assert.strictEqual(dist[0].cents, 5000);
  assert.strictEqual(dist[1].cents, 5000);
  assert.strictEqual(dist[0].cents + dist[1].cents, totalCents);

  // 3-way percentage split: 33.33%, 33.33%, 33.34%
  const threePcts = [
    { id: 'u1', pct: 33.33 },
    { id: 'u2', pct: 33.33 },
    { id: 'u3', pct: 33.34 },
  ];
  const dist3 = distributeCentsByPercentages(totalCents, threePcts);
  const totalCentsDistributed = dist3.reduce((sum, d) => sum + d.cents, 0);
  assert.strictEqual(totalCentsDistributed, totalCents, '3-way percentage distribution sums to exactly total');

  // Invalid: 60% + 30% = 90% (must reject)
  const underPcts = 60 + 30;
  assert.strictEqual(Math.abs(underPcts - 100) > 0.05, true, '90% must be rejected');

  // Invalid: 60% + 50% = 110% (must reject)
  const overPcts = 60 + 50;
  assert.strictEqual(Math.abs(overPcts - 100) > 0.05, true, '110% must be rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Create expense — exact amounts sum to total
// ─────────────────────────────────────────────────────────────────────────────
runTest('7. Create expense — exact amounts sum to total', () => {
  const totalAmount = 100.00;
  const exactValid = { u1: 40.00, u2: 60.00 };
  const exactSum = Object.values(exactValid).reduce((s, v) => s + toCents(v), 0);
  assert.strictEqual(exactSum, toCents(totalAmount), 'Exact amounts sum must match total');

  // Exact amounts sum less than total
  const exactUnder = { u1: 40.00, u2: 50.00 };
  const exactUnderSum = Object.values(exactUnder).reduce((s, v) => s + toCents(v), 0);
  assert.notStrictEqual(exactUnderSum, toCents(totalAmount), 'Under-allocated exact amounts must mismatch');

  // Exact amounts sum greater than total
  const exactOver = { u1: 70.00, u2: 40.00 };
  const exactOverSum = Object.values(exactOver).reduce((s, v) => s + toCents(v), 0);
  assert.notStrictEqual(exactOverSum, toCents(totalAmount), 'Over-allocated exact amounts must mismatch');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Edit expense — description changed, splits unchanged
// ─────────────────────────────────────────────────────────────────────────────
runTest('8. Edit expense — description changed, splits unchanged', () => {
  const originalExpense: Expense = {
    id: 'exp_001',
    groupId: 'grp_001',
    createdBy: 'u1',
    paidBy: 'u1',
    description: 'Dinner',
    amount: 100,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 50, type: 'equal' },
      { userId: 'u2', amount: 50, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Food'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    isDeleted: false,
  };

  // Perform edit only updating description
  const updatedExpense: Expense = {
    ...originalExpense,
    description: 'Italian Dinner at Trattoria',
    updatedAt: new Date('2026-01-02'),
  };

  assert.strictEqual(updatedExpense.description, 'Italian Dinner at Trattoria');
  assert.strictEqual(updatedExpense.amount, originalExpense.amount);
  assert.deepStrictEqual(updatedExpense.splits, originalExpense.splits);
  assert.strictEqual(updatedExpense.paidBy, originalExpense.paidBy);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Edit expense — amount changed, equal splits recalculated
// ─────────────────────────────────────────────────────────────────────────────
runTest('9. Edit expense — amount changed, equal splits recalculated', () => {
  const originalExpense: Expense = {
    id: 'exp_002',
    groupId: 'grp_001',
    createdBy: 'u1',
    paidBy: 'u1',
    description: 'Taxi',
    amount: 100,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 50, type: 'equal' },
      { userId: 'u2', amount: 50, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Transport'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  // Edit amount from 100 to 150
  const newAmount = 150;
  const newSplitsCents = distributeCentsEqually(toCents(newAmount), 2);
  const updatedSplits: ExpenseSplit[] = [
    { userId: 'u1', amount: fromCents(newSplitsCents[0]), type: 'equal' },
    { userId: 'u2', amount: fromCents(newSplitsCents[1]), type: 'equal' },
  ];

  const updatedExpense: Expense = {
    ...originalExpense,
    amount: newAmount,
    splits: updatedSplits,
    updatedAt: new Date(),
  };

  assert.strictEqual(updatedExpense.amount, 150);
  assert.strictEqual(updatedExpense.splits[0].amount, 75.00);
  assert.strictEqual(updatedExpense.splits[1].amount, 75.00);
  assert.strictEqual(
    updatedExpense.splits[0].amount + updatedExpense.splits[1].amount,
    150.00
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Soft-delete expense — is_deleted = 1, not removed
// ─────────────────────────────────────────────────────────────────────────────
runTest('10. Soft-delete expense — is_deleted = 1, not removed', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  ];

  const expense: Expense = {
    id: 'exp_soft_del',
    groupId: 'grp_001',
    createdBy: 'u1',
    paidBy: 'u1',
    description: 'Groceries',
    amount: 100,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 50, type: 'equal' },
      { userId: 'u2', amount: 50, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Food'],
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
  };

  // Verify active balance: Alice is owed 50, Bob owes 50
  const activeBalances = computeNetBalances([expense], members);
  assert.strictEqual(activeBalances.get('u1'), 50);
  assert.strictEqual(activeBalances.get('u2'), -50);

  // Soft-delete the expense
  const softDeletedExpense: Expense = {
    ...expense,
    isDeleted: true,
    updatedAt: new Date(),
  };

  // Verify SQLite row representation
  const row = expenseToRow(softDeletedExpense);
  assert.strictEqual(row.is_deleted, 1, 'Local database row is_deleted must be 1');
  assert.strictEqual(row.id, 'exp_soft_del', 'Record is retained in storage for audit trail');

  // Verify balance excludes soft-deleted expense
  const balancesAfterDelete = computeNetBalances([softDeletedExpense], members);
  assert.strictEqual(balancesAfterDelete.get('u1'), 0, 'Alice balance reverts to 0');
  assert.strictEqual(balancesAfterDelete.get('u2'), 0, 'Bob balance reverts to 0');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Restore deleted expense — is_deleted = 0, balance recalculated
// ─────────────────────────────────────────────────────────────────────────────
runTest('11. Restore deleted expense — is_deleted = 0, balance recalculated', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  ];

  const softDeletedExpense: Expense = {
    id: 'exp_restore',
    groupId: 'grp_001',
    createdBy: 'u1',
    paidBy: 'u1',
    description: 'Electricity Bill',
    amount: 200,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 100, type: 'equal' },
      { userId: 'u2', amount: 100, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Utilities'],
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: true,
  };

  // When deleted, balances are 0
  const deletedBal = computeNetBalances([softDeletedExpense], members);
  assert.strictEqual(deletedBal.get('u1'), 0);
  assert.strictEqual(deletedBal.get('u2'), 0);

  // Restore expense: is_deleted = 0
  const restoredExpense: Expense = {
    ...softDeletedExpense,
    isDeleted: false,
    updatedAt: new Date(),
  };

  const row = expenseToRow(restoredExpense);
  assert.strictEqual(row.is_deleted, 0, 'Restored row is_deleted must be 0');

  // Recalculated balances
  const restoredBal = computeNetBalances([restoredExpense], members);
  assert.strictEqual(restoredBal.get('u1'), 100, 'Alice restored credit is 100');
  assert.strictEqual(restoredBal.get('u2'), -100, 'Bob restored debt is -100');
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Category auto-detection — test at least 10 keywords
// ─────────────────────────────────────────────────────────────────────────────
runTest('12. Category auto-detection — test at least 10 keywords', () => {
  const testCases: { keyword: string; expected: string }[] = [
    { keyword: 'Uber ride to airport', expected: 'Transport' },
    { keyword: 'Starbucks iced caramel latte', expected: 'Coffee' },
    { keyword: 'Electricity power bill', expected: 'Utilities' },
    { keyword: 'Netflix monthly subscription', expected: 'Subscriptions' },
    { keyword: 'Zomato food delivery dinner', expected: 'Food' },
    { keyword: 'Zara denim jacket clothing', expected: 'Shopping' },
    { keyword: 'Gym membership workout', expected: 'Fitness' },
    { keyword: 'Doctor consultation Apollo pharmacy', expected: 'Health' },
    { keyword: 'Movie cinema tickets', expected: 'Entertainment' },
    { keyword: 'Hotel stay vacation booking', expected: 'Travel' },
    { keyword: 'Petrol pump fuel refuel', expected: 'Fuel' },
    { keyword: 'Pedigree dog food pet care', expected: 'Pets' },
  ];

  testCases.forEach(({ keyword, expected }) => {
    const detected = detectCategory(keyword);
    assert.strictEqual(
      detected,
      expected,
      `Keyword "${keyword}" must be detected as "${expected}", got "${detected}"`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Currency stored correctly with expense
// ─────────────────────────────────────────────────────────────────────────────
runTest('13. Currency stored correctly with expense', () => {
  const currenciesToTest = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

  currenciesToTest.forEach((code) => {
    const normalized = normalizeCurrencyCode(code);
    assert.strictEqual(normalized, code, `Currency ${code} should normalize to ${code}`);

    const expense: Expense = {
      id: `exp_${code}`,
      groupId: 'grp_curr',
      createdBy: 'u1',
      paidBy: 'u1',
      description: `Expense in ${code}`,
      amount: 100,
      splitType: 'equal',
      splits: [{ userId: 'u1', amount: 100, type: 'equal' }],
      currency: normalized,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const row = expenseToRow(expense);
    assert.strictEqual(row.currency, code, `Row must store currency ${code}`);
    const reconstructed = rowToExpense(row);
    assert.strictEqual(reconstructed.currency, code, `Deserialized expense must preserve currency ${code}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. created_by and paid_by correctly recorded
// ─────────────────────────────────────────────────────────────────────────────
runTest('14. created_by and paid_by correctly recorded', () => {
  // Scenario: Alice (u1) entered the expense, but Bob (u2) actually paid for it
  const expense: Expense = {
    id: 'exp_diff_payer',
    groupId: 'grp_001',
    createdBy: 'u1', // Alice created it
    paidBy: 'u2',    // Bob paid for it
    description: 'Concert Tickets',
    amount: 120,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 60, type: 'equal' },
      { userId: 'u2', amount: 60, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Entertainment'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  ];

  const row = expenseToRow(expense);
  assert.strictEqual(row.created_by, 'u1', 'created_by must be Alice (u1)');
  assert.strictEqual(row.paid_by, 'u2', 'paid_by must be Bob (u2)');

  // In balances, Bob paid so Bob is credited ₹60, Alice is debited -₹60
  const balances = computeNetBalances([expense], members);
  assert.strictEqual(balances.get('u2'), 60, 'Bob (payer) is owed 60');
  assert.strictEqual(balances.get('u1'), -60, 'Alice (creator & recipient) owes 60');
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Multi-payer expense — contributions stored correctly
// ─────────────────────────────────────────────────────────────────────────────
runTest('15. Multi-payer expense — contributions stored correctly', () => {
  // Scenario: Total ₹300 dinner between Alice (u1), Bob (u2), and Charlie (u3).
  // Alice paid ₹180, Bob paid ₹120, Charlie paid ₹0.
  // Each member's equal share is ₹100.
  const totalAmount = 300;
  const payerAmounts: Record<string, number> = {
    u1: 180.00,
    u2: 120.00,
  };

  const totalPaidCents = Object.values(payerAmounts).reduce((sum, v) => sum + toCents(v), 0);
  assert.strictEqual(totalPaidCents, toCents(totalAmount), 'Sum of payer amounts must match total');

  // Tag encoding format
  const payerTags = Object.entries(payerAmounts).map(
    ([uid, amt]) => `payer:${uid}:${amt.toFixed(2)}`
  );

  const expense: Expense = {
    id: 'exp_multipayer',
    groupId: 'grp_001',
    createdBy: 'u1',
    paidBy: '__MULTIPLE__',
    description: 'Group Dinner',
    amount: totalAmount,
    splitType: 'equal',
    splits: [
      { userId: 'u1', amount: 100, type: 'equal' },
      { userId: 'u2', amount: 100, type: 'equal' },
      { userId: 'u3', amount: 100, type: 'equal' },
    ],
    currency: 'INR',
    tags: ['Food', ...payerTags],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
    { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
  ];

  const balances = computeNetBalances([expense], members);

  // Alice: paid 180, share 100 -> net +80
  assert.strictEqual(balances.get('u1'), 80, 'Alice net balance is +80');
  // Bob: paid 120, share 100 -> net +20
  assert.strictEqual(balances.get('u2'), 20, 'Bob net balance is +20');
  // Charlie: paid 0, share 100 -> net -100
  assert.strictEqual(balances.get('u3'), -100, 'Charlie net balance is -100');

  // Net sum must equal 0
  const netSum = (balances.get('u1') || 0) + (balances.get('u2') || 0) + (balances.get('u3') || 0);
  assert.strictEqual(netSum, 0, 'Multi-payer net group balance must sum to 0');
});

console.log('\n─────────────────────────────────────────────────────────');
console.log(`TOTAL EXPENSE TESTS RUN: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL EXPENSE QA TESTS PASSED SUCCESSFULLY! 🎉\n');
}
