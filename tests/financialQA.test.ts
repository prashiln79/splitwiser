import assert from 'assert';
import {
  computeNetBalances,
  computeNetBalancesByCurrency,
  optimizeSettlements,
  getDirectPairwiseSettlements,
  calculateGroupSettlements,
  computeDetailedFriendBalance,
  computeFriendBalances,
} from '../src/utils/balanceCalculator';
import {
  toCents,
  fromCents,
  formatCents,
  distributeCentsEqually,
  distributeCentsByPercentages,
  distributeCentsByShares,
  calculateAdjustmentSplits,
  calculateItemizedSplits,
  validatePercentages,
  validateExactSplits,
  ItemizedBillItem,
} from '../src/utils/splitMath';
import {
  isValidFinancialAmount,
  getCurrencyDecimals,
  getCurrencySymbol,
  formatCurrency,
  isSafeMinorUnit,
} from '../src/utils/currency';
import { APP_LIMITS } from '../src/constants/limits';
import { Expense, GroupMember, Settlement } from '../src/types';

// ─── Test Suite Harness ────────────────────────────────────────────────────────
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

console.log('========================================================================');
console.log('   SPLITWISER FINANCIAL CORRECTNESS & SPLIT ENGINE QA TEST SUITE');
console.log('========================================================================\n');

// Helper to create members
const createMember = (id: string, name: string): GroupMember => ({
  userId: id,
  userName: name,
  role: 'member',
  joinedAt: new Date('2026-01-01'),
});

const alice = createMember('u_alice', 'Alice');
const bob = createMember('u_bob', 'Bob');
const charlie = createMember('u_charlie', 'Charlie');
const dave = createMember('u_dave', 'Dave');

// ─── 1. Equal Split (3 people, ₹100 penny distribution) ───────────────────────
console.log('■ SUITE 1: Equal Split & Exact Penny Distribution');
test('1.1 Distribute ₹100.00 (10000 cents) across 3 participants with penny reconciliation', () => {
  const centsList = distributeCentsEqually(10000, 3);
  assert.strictEqual(centsList.length, 3);
  assert.strictEqual(centsList[0], 3334, 'First participant receives 1 remainder cent (3334 cents)');
  assert.strictEqual(centsList[1], 3333, 'Second participant receives 3333 cents');
  assert.strictEqual(centsList[2], 3333, 'Third participant receives 3333 cents');
  const sumCents = centsList.reduce((acc, c) => acc + c, 0);
  assert.strictEqual(sumCents, 10000, 'Sum of distributed cents equals exactly 10000 cents (₹100.00)');
});

test('1.2 Net balances for ₹100 equal split among 3 members sum to exactly zero', () => {
  const members = [alice, bob, charlie];
  const expense: Expense = {
    id: 'exp_1',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Dinner',
    amount: 100,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 33.34, type: 'equal' },
      { userId: bob.userId, amount: 33.33, type: 'equal' },
      { userId: charlie.userId, amount: 33.33, type: 'equal' },
    ],
  };

  const balances = computeNetBalances([expense], members);
  const aliceBal = balances.get(alice.userId) || 0;
  const bobBal = balances.get(bob.userId) || 0;
  const charlieBal = balances.get(charlie.userId) || 0;

  // Alice is owed: 33.33 + 33.33 = +66.66
  assert.strictEqual(Math.round(aliceBal * 100) / 100, 66.66);
  assert.strictEqual(Math.round(bobBal * 100) / 100, -33.33);
  assert.strictEqual(Math.round(charlieBal * 100) / 100, -33.33);

  const netSum = Math.round((aliceBal + bobBal + charlieBal) * 100) / 100;
  assert.strictEqual(netSum, 0, 'Net balances must sum to 0.00');
});

// ─── 2. Percentage Split ──────────────────────────────────────────────────────
console.log('\n■ SUITE 2: Percentage Split Engine');
test('2.1 50%/30%/20% split sums to 100% exactly across cents', () => {
  const validation = validatePercentages([
    { id: 'u_alice', pct: 50 },
    { id: 'u_bob', pct: 30 },
    { id: 'u_charlie', pct: 20 },
  ]);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.totalPct, 100);

  const result = distributeCentsByPercentages(10000, [
    { id: 'u_alice', pct: 50 },
    { id: 'u_bob', pct: 30 },
    { id: 'u_charlie', pct: 20 },
  ]);
  assert.strictEqual(result[0].cents, 5000);
  assert.strictEqual(result[1].cents, 3000);
  assert.strictEqual(result[2].cents, 2000);
  assert.strictEqual(result.reduce((a, b) => a + b.cents, 0), 10000);
});

test('2.2 Recurring third percentage split 33.33%/33.33%/33.34% reconciles penny remainder', () => {
  const validation = validatePercentages([
    { id: 'u1', pct: 33.33 },
    { id: 'u2', pct: 33.33 },
    { id: 'u3', pct: 33.34 },
  ]);
  assert.strictEqual(validation.isValid, true);

  const result = distributeCentsByPercentages(10000, [
    { id: 'u1', pct: 33.33 },
    { id: 'u2', pct: 33.33 },
    { id: 'u3', pct: 33.34 },
  ]);
  const sum = result.reduce((a, b) => a + b.cents, 0);
  assert.strictEqual(sum, 10000, 'Sum of cents must be exactly 10000');
});

test('2.3 Unbalanced percentages (> 100% or < 100%) fail validation', () => {
  const over = validatePercentages([
    { id: 'u1', pct: 60 },
    { id: 'u2', pct: 50 },
  ]);
  assert.strictEqual(over.isValid, false, '110% must be rejected');

  const under = validatePercentages([
    { id: 'u1', pct: 40 },
    { id: 'u2', pct: 40 },
  ]);
  assert.strictEqual(under.isValid, false, '80% must be rejected');
});

// ─── 3. Exact Amounts ─────────────────────────────────────────────────────────
console.log('\n■ SUITE 3: Exact Amounts Split');
test('3.1 Custom exact amounts sum equals total expense', () => {
  const totalCents = 15000; // ₹150.00
  const exactSplits = [
    { id: 'u_alice', cents: 5000 },
    { id: 'u_bob', cents: 7000 },
    { id: 'u_charlie', cents: 3000 },
  ];
  const validation = validateExactSplits(totalCents, exactSplits);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.diffCents, 0);
  assert.strictEqual(validation.allocatedCents, 15000);
});

test('3.2 Mismatched exact amounts split rejected with exact diff', () => {
  const totalCents = 15000;
  const exactSplits = [
    { id: 'u_alice', cents: 5000 },
    { id: 'u_bob', cents: 7000 },
    { id: 'u_charlie', cents: 2000 }, // sum = 14000 (off by 1000)
  ];
  const validation = validateExactSplits(totalCents, exactSplits);
  assert.strictEqual(validation.isValid, false);
  assert.strictEqual(validation.diffCents, 1000);
});

// ─── 4. Share-based Split ─────────────────────────────────────────────────────
console.log('\n■ SUITE 4: Share-based Split');
test('4.1 2 shares vs 1 share distributes total exactly (66.67% vs 33.33%)', () => {
  const result = distributeCentsByShares(10000, [
    { id: 'u_alice', shares: 2 },
    { id: 'u_bob', shares: 1 },
  ]);
  assert.strictEqual(result[0].cents, 6667);
  assert.strictEqual(result[1].cents, 3333);
  assert.strictEqual(result[0].cents + result[1].cents, 10000);
});

test('4.2 3 participants with shares (3 : 2 : 1) on ₹100.00', () => {
  const result = distributeCentsByShares(10000, [
    { id: 'u1', shares: 3 },
    { id: 'u2', shares: 2 },
    { id: 'u3', shares: 1 },
  ]);
  // Total shares = 6. 10000 / 6:
  // u1: Math.floor(10000 * 3 / 6) = 5000 (+1 remainder cent = 5001)
  // u2: Math.floor(10000 * 2 / 6) = 3333
  // u3: Math.floor(10000 * 1 / 6) = 1666
  // Total = 10000 exactly
  const totalAllocated = result.reduce((s, r) => s + r.cents, 0);
  assert.strictEqual(totalAllocated, 10000);
  assert.strictEqual(result[0].cents, 5001);
  assert.strictEqual(result[1].cents, 3333);
  assert.strictEqual(result[2].cents, 1666);
});

// ─── 5. Itemized Split ────────────────────────────────────────────────────────
console.log('\n■ SUITE 5: Itemized Split');
test('5.1 Line items with proportional tax & tip distribute exact penny totals', () => {
  const items: ItemizedBillItem[] = [
    { id: 'i1', title: 'Pizza', amountCents: 6000, assignedMemberIds: ['u_alice', 'u_bob'] }, // 3000 each
    { id: 'i2', title: 'Salad', amountCents: 2000, assignedMemberIds: ['u_alice'] },           // 2000 to Alice
    { id: 'i3', title: 'Wine', amountCents: 4000, assignedMemberIds: ['u_bob', 'u_charlie'] }, // 2000 each
  ];
  // Subtotal items = 6000 + 2000 + 4000 = 12000 cents
  // Alice items = 3000 + 2000 = 5000 (5/12 of items)
  // Bob items = 3000 + 2000 = 5000 (5/12 of items)
  // Charlie items = 2000 (2/12 of items)
  // Tax = 1200 cents (₹12), Tip = 600 cents (₹6). TaxTip = 1800 cents.
  // Grand total = 12000 + 1800 = 13800 cents.
  const calc = calculateItemizedSplits(items, 1200, 600, ['u_alice', 'u_bob', 'u_charlie']);
  assert.strictEqual(calc.isValid, true);
  assert.strictEqual(calc.itemsSubtotalCents, 12000);
  assert.strictEqual(calc.grandTotalCents, 13800);

  const aliceTotal = calc.memberTotals['u_alice'].totalCents;
  const bobTotal = calc.memberTotals['u_bob'].totalCents;
  const charlieTotal = calc.memberTotals['u_charlie'].totalCents;

  assert.strictEqual(aliceTotal + bobTotal + charlieTotal, 13800, 'Sum of members equals grand total');
  assert.strictEqual(calc.memberTotals['u_alice'].itemCents, 5000);
  assert.strictEqual(calc.memberTotals['u_bob'].itemCents, 5000);
  assert.strictEqual(calc.memberTotals['u_charlie'].itemCents, 2000);
});

test('5.2 Unassigned item invalidates itemized bill calculation', () => {
  const items: ItemizedBillItem[] = [
    { id: 'i1', title: 'Shared Nachos', amountCents: 1500, assignedMemberIds: [] },
  ];
  const calc = calculateItemizedSplits(items, 0, 0, ['u_alice', 'u_bob']);
  assert.strictEqual(calc.isValid, false, 'Unassigned item must be marked invalid');
});

// ─── 6. Adjustment Split ──────────────────────────────────────────────────────
console.log('\n■ SUITE 6: Adjustment Split');
test('6.1 Balanced adjustments calculate accurate net shares', () => {
  // Total ₹90 (9000 cents) split 3 ways -> base ₹30 (3000 cents) each
  // Alice +₹10, Bob -₹10, Charlie ₹0
  const calc = calculateAdjustmentSplits(9000, ['u_alice', 'u_bob', 'u_charlie'], {
    u_alice: 1000,
    u_bob: -1000,
    u_charlie: 0,
  });
  assert.strictEqual(calc.isValid, true);
  assert.strictEqual(calc.netAdjustmentCents, 0);
  assert.strictEqual(calc.splits[0].cents, 4000);
  assert.strictEqual(calc.splits[1].cents, 2000);
  assert.strictEqual(calc.splits[2].cents, 3000);
  assert.strictEqual(calc.splits.reduce((a, b) => a + b.cents, 0), 9000);
});

test('6.2 Unbalanced adjustments or negative final share fails validation', () => {
  const unbal = calculateAdjustmentSplits(9000, ['u1', 'u2'], { u1: 500, u2: 0 });
  assert.strictEqual(unbal.isValid, false, 'Non-zero net adjustment must fail');

  const neg = calculateAdjustmentSplits(2000, ['u1', 'u2'], { u1: -1500, u2: 1500 });
  // base is 1000 each. u1 = 1000 - 1500 = -500 (negative)
  assert.strictEqual(neg.isValid, false, 'Negative resulting share must fail');
});

// ─── 7. Multiple Payers ───────────────────────────────────────────────────────
console.log('\n■ SUITE 7: Multiple Payers Split');
test('7.1 Two payers contribute different amounts, split distributes to 3 people', () => {
  // Alice pays ₹70, Bob pays ₹50 (Total ₹120)
  // Split equally among Alice, Bob, Charlie (₹40 each)
  const expense: Expense = {
    id: 'exp_multi',
    groupId: 'g_multi',
    createdBy: alice.userId,
    paidBy: '__MULTIPLE__',
    description: 'Team Dinner',
    amount: 120,
    currency: 'INR',
    splitType: 'equal',
    tags: ['payer:u_alice:70', 'payer:u_bob:50'],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 40, type: 'equal' },
      { userId: bob.userId, amount: 40, type: 'equal' },
      { userId: charlie.userId, amount: 40, type: 'equal' },
    ],
  };

  const members = [alice, bob, charlie];
  const balances = computeNetBalances([expense], members);

  // Alice: paid 70, consumed 40 -> Net +30
  // Bob: paid 50, consumed 40 -> Net +10
  // Charlie: paid 0, consumed 40 -> Net -40
  assert.strictEqual(balances.get(alice.userId), 30);
  assert.strictEqual(balances.get(bob.userId), 10);
  assert.strictEqual(balances.get(charlie.userId), -40);

  const netSum = (balances.get(alice.userId) || 0) + (balances.get(bob.userId) || 0) + (balances.get(charlie.userId) || 0);
  assert.strictEqual(netSum, 0, 'Multi-payer balances sum to zero');

  // Verify optimized settlements
  const settlements = optimizeSettlements(balances, members);
  assert.strictEqual(settlements.length, 2);
  // Charlie owes Alice 30, Charlie owes Bob 10
  const toAlice = settlements.find((s) => s.toUserId === alice.userId);
  const toBob = settlements.find((s) => s.toUserId === bob.userId);
  assert.strictEqual(toAlice?.amount, 30);
  assert.strictEqual(toAlice?.fromUserId, charlie.userId);
  assert.strictEqual(toBob?.amount, 10);
  assert.strictEqual(toBob?.fromUserId, charlie.userId);
});

// ─── 8. Excluded Payer ────────────────────────────────────────────────────────
console.log('\n■ SUITE 8: Excluded Payer');
test('8.1 Payer pays full amount but consumes 0% (excluded from split)', () => {
  // Alice pays ₹100 for Bob and Charlie (50 / 50). Alice gets 0.
  const expense: Expense = {
    id: 'exp_excl',
    groupId: 'g_excl',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Gift for Bob & Charlie',
    amount: 100,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: bob.userId, amount: 50, type: 'equal' },
      { userId: charlie.userId, amount: 50, type: 'equal' },
    ],
  };

  const members = [alice, bob, charlie];
  const balances = computeNetBalances([expense], members);

  assert.strictEqual(balances.get(alice.userId), 100, 'Alice is owed ₹100');
  assert.strictEqual(balances.get(bob.userId), -50, 'Bob owes ₹50');
  assert.strictEqual(balances.get(charlie.userId), -50, 'Charlie owes ₹50');

  const settlements = optimizeSettlements(balances, members);
  assert.strictEqual(settlements.length, 2);
  assert.strictEqual(settlements.every((s) => s.toUserId === alice.userId), true);
});

// ─── 9. Debt Simplification ───────────────────────────────────────────────────
console.log('\n■ SUITE 9: Debt Simplification & Net Balance Invariant');
test('9.1 Multi-hop circular debt minimized while strictly preserving net balances', () => {
  // Alice paid ₹100 for Bob (Bob owes Alice 100)
  // Bob paid ₹100 for Charlie (Charlie owes Bob 100)
  // Charlie paid ₹100 for Dave (Dave owes Charlie 100)
  const exp1: Expense = {
    id: 'e1',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'A for B',
    amount: 100,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: bob.userId, amount: 100, type: 'unequal' }],
  };
  const exp2: Expense = {
    id: 'e2',
    groupId: 'g1',
    createdBy: bob.userId,
    paidBy: bob.userId,
    description: 'B for C',
    amount: 100,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: charlie.userId, amount: 100, type: 'unequal' }],
  };
  const exp3: Expense = {
    id: 'e3',
    groupId: 'g1',
    createdBy: charlie.userId,
    paidBy: charlie.userId,
    description: 'C for D',
    amount: 100,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: dave.userId, amount: 100, type: 'unequal' }],
  };

  const members = [alice, bob, charlie, dave];
  const balances = computeNetBalances([exp1, exp2, exp3], members);

  assert.strictEqual(balances.get(alice.userId), 100);
  assert.strictEqual(balances.get(bob.userId), 0);
  assert.strictEqual(balances.get(charlie.userId), 0);
  assert.strictEqual(balances.get(dave.userId), -100);

  // Simplified settlements: Dave pays Alice ₹100 directly (1 transaction instead of 3!)
  const simplified = optimizeSettlements(balances, members);
  assert.strictEqual(simplified.length, 1);
  assert.strictEqual(simplified[0].fromUserId, dave.userId);
  assert.strictEqual(simplified[0].toUserId, alice.userId);
  assert.strictEqual(simplified[0].amount, 100);

  // Verify pairwise (unsimplified) produces 3 transactions
  const direct = getDirectPairwiseSettlements([exp1, exp2, exp3], members);
  assert.strictEqual(direct.length, 3);
});

// ─── 10. Partial Settlement ───────────────────────────────────────────────────
console.log('\n■ SUITE 10: Partial Settlement');
test('10.1 Partial payment reduces outstanding debt by exact amount', () => {
  // Bob owes Alice ₹100
  const exp: Expense = {
    id: 'e_init',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Hotel',
    amount: 100,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: bob.userId, amount: 100, type: 'unequal' }],
  };

  const members = [alice, bob];
  const balBefore = computeNetBalances([exp], members);
  assert.strictEqual(balBefore.get(bob.userId), -100);

  // Bob pays Alice ₹40
  const settlement1: Settlement = {
    id: 's1',
    groupId: 'g1',
    fromUserId: bob.userId,
    toUserId: alice.userId,
    fromUserName: bob.userName,
    toUserName: alice.userName,
    amount: 40,
    status: 'completed',
    createdAt: new Date(),
  };

  const balAfter1 = computeNetBalances([exp], members, [settlement1]);
  assert.strictEqual(balAfter1.get(bob.userId), -60, 'Bob now owes ₹60');
  assert.strictEqual(balAfter1.get(alice.userId), 60, 'Alice is owed ₹60');

  // Bob pays Alice ₹60 (final settlement)
  const settlement2: Settlement = {
    id: 's2',
    groupId: 'g1',
    fromUserId: bob.userId,
    toUserId: alice.userId,
    fromUserName: bob.userName,
    toUserName: alice.userName,
    amount: 60,
    status: 'completed',
    createdAt: new Date(),
  };

  const balAfter2 = computeNetBalances([exp], members, [settlement1, settlement2]);
  assert.strictEqual(balAfter2.get(bob.userId), 0, 'Bob is settled up');
  assert.strictEqual(balAfter2.get(alice.userId), 0, 'Alice is settled up');
});

// ─── 11. Expense Edit ─────────────────────────────────────────────────────────
console.log('\n■ SUITE 11: Expense Edit & Recomputation');
test('11.1 Editing an expense amount updates member net balances immediately', () => {
  const members = [alice, bob];
  const initialExp: Expense = {
    id: 'exp_edit',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Groceries',
    amount: 100,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 50, type: 'equal' },
      { userId: bob.userId, amount: 50, type: 'equal' },
    ],
  };

  const bal1 = computeNetBalances([initialExp], members);
  assert.strictEqual(bal1.get(bob.userId), -50);

  // Edit amount from ₹100 to ₹250
  const editedExp: Expense = {
    ...initialExp,
    amount: 250,
    splits: [
      { userId: alice.userId, amount: 125, type: 'equal' },
      { userId: bob.userId, amount: 125, type: 'equal' },
    ],
    updatedAt: new Date(),
  };

  const bal2 = computeNetBalances([editedExp], members);
  assert.strictEqual(bal2.get(bob.userId), -125);
  assert.strictEqual(bal2.get(alice.userId), 125);
});

// ─── 12. Expense Soft-Delete ──────────────────────────────────────────────────
console.log('\n■ SUITE 12: Expense Soft-Delete');
test('12.1 Soft-deleted expense (isDeleted: true) is excluded and reverts balance exactly', () => {
  const members = [alice, bob];
  const exp1: Expense = {
    id: 'exp1',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Breakfast',
    amount: 50,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 25, type: 'equal' },
      { userId: bob.userId, amount: 25, type: 'equal' },
    ],
  };

  const exp2: Expense = {
    id: 'exp2',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Lunch',
    amount: 100,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 50, type: 'equal' },
      { userId: bob.userId, amount: 50, type: 'equal' },
    ],
  };

  const balBoth = computeNetBalances([exp1, exp2], members);
  assert.strictEqual(balBoth.get(bob.userId), -75);

  // Soft-delete exp2
  const exp2Deleted: Expense = { ...exp2, isDeleted: true };
  const balAfterDelete = computeNetBalances([exp1, exp2Deleted], members);
  assert.strictEqual(balAfterDelete.get(bob.userId), -25, 'Balance reverts to only exp1 balance');
});

// ─── 13. Restore Deleted Expense ──────────────────────────────────────────────
console.log('\n■ SUITE 13: Restore Deleted Expense');
test('13.1 Restoring a deleted expense reinstates original debt with no duplicates', () => {
  const members = [alice, bob];
  const exp: Expense = {
    id: 'exp_restore',
    groupId: 'g1',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Taxi',
    amount: 80,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: alice.userId, amount: 40, type: 'equal' },
      { userId: bob.userId, amount: 40, type: 'equal' },
    ],
  };

  const originalBal = computeNetBalances([exp], members);
  assert.strictEqual(originalBal.get(bob.userId), -40);

  // Delete
  const deletedBal = computeNetBalances([{ ...exp, isDeleted: true }], members);
  assert.strictEqual(deletedBal.get(bob.userId), 0);

  // Restore
  const restoredBal = computeNetBalances([{ ...exp, isDeleted: false }], members);
  assert.strictEqual(restoredBal.get(bob.userId), -40, 'Debt restored to exactly -40');
  assert.strictEqual(restoredBal.get(alice.userId), 40, 'Debt restored to exactly +40');
});

// ─── 14. All Member Balances Sum to Zero ──────────────────────────────────────
console.log('\n■ SUITE 14: Zero-Sum Conservation Invariant');
test('14.1 Complex multi-party transactions always conserve zero sum', () => {
  const members = [alice, bob, charlie, dave];
  const expenses: Expense[] = [
    {
      id: 'e1',
      groupId: 'g',
      createdBy: alice.userId,
      paidBy: alice.userId,
      description: 'Groceries',
      amount: 123.45,
      currency: 'INR',
      splitType: 'equal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: alice.userId, amount: 30.87, type: 'equal' },
        { userId: bob.userId, amount: 30.86, type: 'equal' },
        { userId: charlie.userId, amount: 30.86, type: 'equal' },
        { userId: dave.userId, amount: 30.86, type: 'equal' },
      ],
    },
    {
      id: 'e2',
      groupId: 'g',
      createdBy: bob.userId,
      paidBy: bob.userId,
      description: 'Utilities',
      amount: 250.80,
      currency: 'INR',
      splitType: 'shares',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: alice.userId, amount: 100.32, type: 'shares' },
        { userId: bob.userId, amount: 50.16, type: 'shares' },
        { userId: charlie.userId, amount: 50.16, type: 'shares' },
        { userId: dave.userId, amount: 50.16, type: 'shares' },
      ],
    },
    {
      id: 'e3',
      groupId: 'g',
      createdBy: dave.userId,
      paidBy: dave.userId,
      description: 'Snacks',
      amount: 88.50,
      currency: 'INR',
      splitType: 'unequal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: alice.userId, amount: 20.00, type: 'unequal' },
        { userId: bob.userId, amount: 30.00, type: 'unequal' },
        { userId: charlie.userId, amount: 38.50, type: 'unequal' },
      ],
    },
  ];

  const settlements: Settlement[] = [
    {
      id: 's1',
      groupId: 'g',
      fromUserId: charlie.userId,
      toUserId: bob.userId,
      fromUserName: 'Charlie',
      toUserName: 'Bob',
      amount: 45.00,
      status: 'completed',
      createdAt: new Date(),
    },
  ];

  const balances = computeNetBalances(expenses, members, settlements);
  let totalNet = 0;
  balances.forEach((bal) => {
    totalNet += bal;
  });

  const roundedNet = Math.round(totalNet * 100) / 100;
  const normalizedNet = Object.is(roundedNet, -0) ? 0 : roundedNet;
  assert.strictEqual(normalizedNet, 0, `Net balance sum must be 0.00 (got ${roundedNet})`);
});

// ─── 15. Currency Precision ───────────────────────────────────────────────────
console.log('\n■ SUITE 15: Currency Precision Rules');
test('15.1 Decimal places: JPY (0), INR/USD/EUR (2), KWD/BHD (3)', () => {
  assert.strictEqual(getCurrencyDecimals('JPY'), 0);
  assert.strictEqual(getCurrencyDecimals('INR'), 2);
  assert.strictEqual(getCurrencyDecimals('USD'), 2);
  assert.strictEqual(getCurrencyDecimals('EUR'), 2);
  assert.strictEqual(getCurrencyDecimals('KWD'), 3);
  assert.strictEqual(getCurrencyDecimals('BHD'), 3);
});

test('15.2 Validation enforces decimal limits per currency', () => {
  assert.strictEqual(isValidFinancialAmount('100.5', 'JPY').isValid, false, 'Fractional JPY rejected');
  assert.strictEqual(isValidFinancialAmount('100', 'JPY').isValid, true, 'Whole JPY accepted');

  assert.strictEqual(isValidFinancialAmount('100.55', 'USD').isValid, true, '2-decimal USD accepted');
  assert.strictEqual(isValidFinancialAmount('100.555', 'USD').isValid, false, '3-decimal USD rejected');

  assert.strictEqual(isValidFinancialAmount('100.125', 'KWD').isValid, true, '3-decimal KWD accepted');
  assert.strictEqual(isValidFinancialAmount('100.1234', 'KWD').isValid, false, '4-decimal KWD rejected');
});

test('15.3 Currency formatting formats with exact decimals', () => {
  assert.strictEqual(formatCurrency(100, 'JPY'), '¥100');
  assert.strictEqual(formatCurrency(100.5, 'USD'), '$100.50');
  assert.strictEqual(formatCurrency(100.125, 'KWD'), 'KWD100.125');
  assert.strictEqual(formatCurrency(100, 'INR'), '₹100.00');
});

// ─── 16. Large Amounts Boundary ───────────────────────────────────────────────
console.log('\n■ SUITE 16: Large Amounts Boundary (₹999,999,999)');
test('16.1 Financial boundary ₹999,999,999 is valid and safe in minor integer units', () => {
  const boundaryAmount = 999_999_999;
  const validation = isValidFinancialAmount(boundaryAmount, 'INR');
  assert.strictEqual(validation.isValid, true);

  const boundaryCents = toCents(boundaryAmount);
  assert.strictEqual(boundaryCents, 99_999_999_900);
  assert.strictEqual(isSafeMinorUnit(boundaryCents), true);

  // Equal split of ₹999,999,999 among 3 people
  const splits = distributeCentsEqually(boundaryCents, 3);
  assert.strictEqual(splits[0], 33_333_333_300);
  assert.strictEqual(splits[1], 33_333_333_300);
  assert.strictEqual(splits[2], 33_333_333_300);
  assert.strictEqual(splits.reduce((a, b) => a + b, 0), boundaryCents);

  // Above 1 Billion limit is rejected
  const overLimit = isValidFinancialAmount(1_000_000_001, 'INR');
  assert.strictEqual(overLimit.isValid, false);
});

// ─── 17. Single-member Group ──────────────────────────────────────────────────
console.log('\n■ SUITE 17: Single-member Group Edge Case');
test('17.1 Single-member group expense creates zero debt and empty settlements', () => {
  const soloMember = [alice];
  const expense: Expense = {
    id: 'exp_solo',
    groupId: 'g_solo',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: 'Solo Coffee',
    amount: 250,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: alice.userId, amount: 250, type: 'equal' }],
  };

  const balances = computeNetBalances([expense], soloMember);
  assert.strictEqual(balances.get(alice.userId), 0, 'Alice owes/is owed nothing');

  const settlements = optimizeSettlements(balances, soloMember);
  assert.strictEqual(settlements.length, 0, 'No settlements generated for single-member group');
});

// ─── 18. 100-member Group Distribution ────────────────────────────────────────
console.log('\n■ SUITE 18: 100-Member Group Large Scale Split');
test('18.1 Equal split of ₹10,000 across 100 members produces exact penny reconciliation', () => {
  const members100: GroupMember[] = [];
  for (let i = 0; i < 100; i++) {
    members100.push(createMember(`user_${i}`, `Member ${i}`));
  }

  // ₹10,000.00 = 1,000,000 cents
  const totalCents = 1_000_000;
  const distributed = distributeCentsEqually(totalCents, 100);
  assert.strictEqual(distributed.length, 100);
  assert.strictEqual(distributed.every((c) => c === 10000), true);
  assert.strictEqual(distributed.reduce((a, b) => a + b, 0), totalCents);

  // Odd prime split: ₹100.00 (10000 cents) across 97 members
  const oddSplit = distributeCentsEqually(10000, 97);
  assert.strictEqual(oddSplit.length, 97);
  assert.strictEqual(oddSplit.reduce((a, b) => a + b, 0), 10000);

  // Test net balances and debt optimization performance
  const payer = members100[0];
  const expense: Expense = {
    id: 'exp_100',
    groupId: 'g_100',
    createdBy: payer.userId,
    paidBy: payer.userId,
    description: '100 Person Banquet',
    amount: 10000,
    currency: 'INR',
    splitType: 'equal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: members100.map((m) => ({ userId: m.userId, amount: 100, type: 'equal' })),
  };

  const startTime = Date.now();
  const balances = computeNetBalances([expense], members100);
  const settlements = optimizeSettlements(balances, members100);
  const elapsed = Date.now() - startTime;

  assert.strictEqual(balances.get(payer.userId), 9900, 'Payer is owed ₹9900');
  assert.strictEqual(settlements.length, 99, '99 debtors each pay payer directly');
  assert.ok(elapsed < 100, `Large-scale calculation must finish within 100ms (took ${elapsed}ms)`);
});

// ─── 19. Multi-currency Group ─────────────────────────────────────────────────
console.log('\n■ SUITE 19: Multi-Currency Group Isolation');
test('19.1 Group with multiple currencies computes independent zero-sum balances for each currency', () => {
  const members = [alice, bob, charlie];
  const multiCurrencyExpenses: Expense[] = [
    // USD expense: Alice paid $100 for Alice and Bob ($50 each)
    {
      id: 'e_usd',
      groupId: 'g_multi',
      createdBy: alice.userId,
      paidBy: alice.userId,
      description: 'US Hotel',
      amount: 100,
      currency: 'USD',
      splitType: 'equal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: alice.userId, amount: 50, type: 'equal' },
        { userId: bob.userId, amount: 50, type: 'equal' },
      ],
    },
    // EUR expense: Bob paid €60 for Bob and Charlie (€30 each)
    {
      id: 'e_eur',
      groupId: 'g_multi',
      createdBy: bob.userId,
      paidBy: bob.userId,
      description: 'Paris Dinner',
      amount: 60,
      currency: 'EUR',
      splitType: 'equal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: bob.userId, amount: 30, type: 'equal' },
        { userId: charlie.userId, amount: 30, type: 'equal' },
      ],
    },
    // INR expense: Charlie paid ₹300 for Alice, Bob, Charlie (₹100 each)
    {
      id: 'e_inr',
      groupId: 'g_multi',
      createdBy: charlie.userId,
      paidBy: charlie.userId,
      description: 'Mumbai Taxi',
      amount: 300,
      currency: 'INR',
      splitType: 'equal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      splits: [
        { userId: alice.userId, amount: 100, type: 'equal' },
        { userId: bob.userId, amount: 100, type: 'equal' },
        { userId: charlie.userId, amount: 100, type: 'equal' },
      ],
    },
  ];

  const currencyBalances = computeNetBalancesByCurrency(multiCurrencyExpenses, members);
  assert.strictEqual(currencyBalances.size, 3, '3 independent currencies tracked');

  // Verify USD
  const usdBal = currencyBalances.get('USD')!;
  assert.strictEqual(usdBal.get(alice.userId), 50);
  assert.strictEqual(usdBal.get(bob.userId), -50);
  assert.strictEqual(usdBal.get(charlie.userId), 0);

  // Verify EUR
  const eurBal = currencyBalances.get('EUR')!;
  assert.strictEqual(eurBal.get(bob.userId), 30);
  assert.strictEqual(eurBal.get(charlie.userId), -30);
  assert.strictEqual(eurBal.get(alice.userId), 0);

  // Verify INR
  const inrBal = currencyBalances.get('INR')!;
  assert.strictEqual(inrBal.get(charlie.userId), 200);
  assert.strictEqual(inrBal.get(alice.userId), -100);
  assert.strictEqual(inrBal.get(bob.userId), -100);

  // Verify zero-sum conservation for each currency
  currencyBalances.forEach((balMap, curr) => {
    let sum = 0;
    balMap.forEach((val) => (sum += val));
    assert.strictEqual(Math.round(sum * 100) / 100, 0, `Currency ${curr} balances must sum to 0`);
  });
});

// ─── 20. Zero-Amount & Invalid Expenses ───────────────────────────────────────
console.log('\n■ SUITE 20: Zero-Amount & Invalid Expense Validation');
test('20.1 Zero, negative, and invalid financial values are strictly rejected', () => {
  assert.strictEqual(isValidFinancialAmount(0).isValid, false);
  assert.strictEqual(isValidFinancialAmount('0').isValid, false);
  assert.strictEqual(isValidFinancialAmount(0.00).isValid, false);
  assert.strictEqual(isValidFinancialAmount(-15).isValid, false);
  assert.strictEqual(isValidFinancialAmount('-50').isValid, false);
  assert.strictEqual(isValidFinancialAmount('').isValid, false);
  assert.strictEqual(isValidFinancialAmount(null).isValid, false);
  assert.strictEqual(isValidFinancialAmount(undefined).isValid, false);
  assert.strictEqual(isValidFinancialAmount(NaN).isValid, false);
  assert.strictEqual(isValidFinancialAmount(Infinity).isValid, false);
});

// ─── 21. Single-Penny Debt Settlement (Bug Fix Verification) ─────────────────
console.log('\n■ SUITE 21: Bug Fix Verification — 1-Cent / 1-Paisa Debt Reconciliation');
test('21.1 1-cent (₹0.01) debt is preserved and settled without dropping in optimizeSettlements', () => {
  const members = [alice, bob];
  const pennyExpense: Expense = {
    id: 'exp_penny',
    groupId: 'g_penny',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: '1 Cent Difference',
    amount: 0.01,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: bob.userId, amount: 0.01, type: 'unequal' }],
  };

  const balances = computeNetBalances([pennyExpense], members);
  assert.strictEqual(balances.get(alice.userId), 0.01);
  assert.strictEqual(balances.get(bob.userId), -0.01);

  const settlements = optimizeSettlements(balances, members);
  assert.strictEqual(settlements.length, 1, '1-cent debt must generate 1 settlement');
  assert.strictEqual(settlements[0].fromUserId, bob.userId);
  assert.strictEqual(settlements[0].toUserId, alice.userId);
  assert.strictEqual(settlements[0].amount, 0.01);
});

test('21.2 1-cent debt in getDirectPairwiseSettlements is preserved', () => {
  const members = [alice, bob];
  const pennyExpense: Expense = {
    id: 'exp_penny_direct',
    groupId: 'g_penny_direct',
    createdBy: alice.userId,
    paidBy: alice.userId,
    description: '1 Cent Direct',
    amount: 0.01,
    currency: 'INR',
    splitType: 'unequal',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [{ userId: bob.userId, amount: 0.01, type: 'unequal' }],
  };

  const direct = getDirectPairwiseSettlements([pennyExpense], members);
  assert.strictEqual(direct.length, 1);
  assert.strictEqual(direct[0].amount, 0.01);
});

// ─── Final Summary ────────────────────────────────────────────────────────────
console.log('\n========================================================================');
console.log('                 FINANCIAL TEST RESULTS SUMMARY');
console.log('========================================================================');
console.log(`TOTAL TESTS RUN : ${totalTests}`);
console.log(`PASSED          : ${passedTests}`);
console.log(`FAILED          : ${failedTests}`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL FINANCIAL TESTS PASSED WITH 100% CORRECTNESS!\n');
}
