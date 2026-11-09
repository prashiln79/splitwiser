import {
  toCents,
  fromCents,
  distributeCentsEqually,
  distributeCentsByShares,
  distributeCentsByPercentages,
  calculateAdjustmentSplits,
  calculateItemizedSplits,
  ItemizedBillItem,
} from '../src/utils/splitMath';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${msg}`);
}

console.log('--- STARTING SPLIT MATH UNIT TESTS ---');

// 1. Minor Units Conversion
assert(toCents('1200.00') === 120000, 'toCents string "1200.00" converts to 120000 minor units');
assert(toCents(12.34) === 1234, 'toCents number 12.34 converts to 1234 minor units');
assert(fromCents(1234) === 12.34, 'fromCents 1234 converts back to 12.34');
assert(toCents('₹1,200.50') === 120050, 'toCents handles currency symbols and commas');

// 2. Equal Distribution with Remainder Cents
const equal100by3 = distributeCentsEqually(10000, 3);
assert(equal100by3.length === 3, 'distributeCentsEqually returns 3 shares');
assert(equal100by3[0] === 3334, 'Member 1 gets 3334 cents');
assert(equal100by3[1] === 3333, 'Member 2 gets 3333 cents');
assert(equal100by3[2] === 3333, 'Member 3 gets 3333 cents');
assert(
  equal100by3.reduce((a, b) => a + b, 0) === 10000,
  'Sum of equal shares equals exactly 10000 cents (₹100.00)'
);

// 3. Shares Distribution
const sharesResult = distributeCentsByShares(10000, [
  { id: 'u1', shares: 2 },
  { id: 'u2', shares: 1 },
]);
assert(sharesResult[0].cents === 6667, 'u1 with 2 shares gets 6667 cents');
assert(sharesResult[1].cents === 3333, 'u2 with 1 share gets 3333 cents');
assert(
  sharesResult.reduce((a, b) => a + b.cents, 0) === 10000,
  'Sum of shares equals exactly 10000 cents'
);

// 4. Percentage Distribution
const pctResult = distributeCentsByPercentages(10000, [
  { id: 'u1', pct: 50 },
  { id: 'u2', pct: 30 },
  { id: 'u3', pct: 20 },
]);
assert(pctResult[0].cents === 5000, '50% of 10000 is 5000');
assert(pctResult[1].cents === 3000, '30% of 10000 is 3000');
assert(pctResult[2].cents === 2000, '20% of 10000 is 2000');
assert(
  pctResult.reduce((a, b) => a + b.cents, 0) === 10000,
  'Sum of percentage shares equals exactly 10000 cents'
);

// 5. Adjustment Split
const adjValid = calculateAdjustmentSplits(9000, ['u1', 'u2', 'u3'], {
  u1: 1000, // +10.00
  u2: -1000, // -10.00
  u3: 0,
});
assert(adjValid.isValid === true, 'Balanced adjustments are valid');
assert(adjValid.netAdjustmentCents === 0, 'Net adjustments sum to 0');
assert(adjValid.splits[0].cents === 4000, 'u1 share: 3000 + 1000 = 4000');
assert(adjValid.splits[1].cents === 2000, 'u2 share: 3000 - 1000 = 2000');
assert(adjValid.splits[2].cents === 3000, 'u3 share: 3000 + 0 = 3000');

const adjInvalidNet = calculateAdjustmentSplits(9000, ['u1', 'u2'], {
  u1: 500,
  u2: 0,
});
assert(adjInvalidNet.isValid === false, 'Unbalanced adjustments fail validation');

const adjNegative = calculateAdjustmentSplits(1000, ['u1', 'u2'], {
  u1: -1500,
  u2: 1500,
});
assert(adjNegative.isValid === false, 'Adjustments producing negative shares fail validation');

// 6. Itemized Split with Proportional Tax & Tip
const items: ItemizedBillItem[] = [
  { id: 'i1', title: 'Pizza', amountCents: 6000, assignedMemberIds: ['u1', 'u2'] }, // 3000 each
  { id: 'i2', title: 'Pasta', amountCents: 3000, assignedMemberIds: ['u2'] }, // 3000 to u2
];
// u1 items = 3000, u2 items = 6000 (total items = 9000). u1 is 1/3, u2 is 2/3.
// Tax + Tip = 1500. u1 taxTip = 500, u2 taxTip = 1000.
// u1 grand = 3500, u2 grand = 7000. Total = 10500.
const itemizedResult = calculateItemizedSplits(items, 1000, 500, ['u1', 'u2']);
assert(itemizedResult.isValid === true, 'Itemized bill calculation is valid');
assert(itemizedResult.memberTotals['u1'].itemCents === 3000, 'u1 item subtotal is 3000 cents');
assert(itemizedResult.memberTotals['u2'].itemCents === 6000, 'u2 item subtotal is 6000 cents');
assert(itemizedResult.memberTotals['u1'].taxTipCents === 500, 'u1 tax+tip is 500 cents (1/3)');
assert(itemizedResult.memberTotals['u2'].taxTipCents === 1000, 'u2 tax+tip is 1000 cents (2/3)');
assert(itemizedResult.memberTotals['u1'].totalCents === 3500, 'u1 total is 3500 cents');
assert(itemizedResult.memberTotals['u2'].totalCents === 7000, 'u2 total is 7000 cents');
assert(itemizedResult.grandTotalCents === 10500, 'Itemized grand total is exactly 10500 cents');

console.log('ALL SPLIT MATH UNIT TESTS PASSED!');

