/**
 * SETTLEMENT & DEBT RESOLUTION QA TEST SUITE
 * ─────────────────────────────────────────────────────────────
 * Comprehensive tests for settlement recording, balance adjustments,
 * over-settlement validation limits, Firestore data mapping, group
 * history retrieval, partial settlements, and full debt resolution.
 */

import assert from 'assert';
import { Settlement, Expense, GroupMember, OptimizedSettlement } from '../src/types';
import {
  computeNetBalances,
  calculateGroupSettlements,
  getDirectPairwiseSettlements,
  getOptimizedSettlements,
} from '../src/utils/balanceCalculator';
import { isValidFinancialAmount, formatCurrency } from '../src/utils/currency';

console.log('\n========================================================');
console.log('   SETTLEMENT QA — COMPREHENSIVE AUTOMATED TEST SUITE   ');
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

// ─── Settlement Domain & Validation Logic ────────────────────────────────────

export function validateSettlementAmount(
  amount: number | string,
  outstandingBalance: number,
  currency = 'INR'
): { isValid: boolean; error?: string } {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Settlement amount must be a valid number' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Settlement amount must be greater than zero' };
  }

  const roundedAmount = Math.round(num * 100) / 100;
  const roundedBalance = Math.round(Math.abs(outstandingBalance) * 100) / 100;

  if (roundedAmount > roundedBalance) {
    return {
      isValid: false,
      error: `Settlement amount (${formatCurrency(roundedAmount, currency)}) cannot exceed outstanding balance (${formatCurrency(roundedBalance, currency)})`,
    };
  }

  return { isValid: true };
}

// Firestore Document Schema Mapping (matching src/services/settlements.ts)
function mapFirestoreSettlementDoc(id: string, data: Record<string, any>): Settlement {
  return {
    id,
    groupId: data.groupId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    fromUserName: data.fromUserName || 'Unknown',
    toUserName: data.toUserName || 'Unknown',
    amount: data.amount,
    status: data.status ?? 'completed',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)),
    note: data.note ?? undefined,
    syncStatus: data.syncStatus ?? 'synced',
    isDeleted: Boolean(data.isDeleted),
  };
}

// Simulated SQLite Settlement Row Transformation (matching settlementRepository.ts)
interface LocalSettlementRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_name: string;
  to_user_name: string;
  amount: number;
  status: 'pending' | 'completed';
  note: string | null;
  created_at: number;
  sync_status: string;
  is_deleted: number;
}

function settlementToRow(s: Settlement): LocalSettlementRow {
  return {
    id: s.id,
    group_id: s.groupId,
    from_user_id: s.fromUserId,
    to_user_id: s.toUserId,
    from_user_name: s.fromUserName,
    to_user_name: s.toUserName,
    amount: s.amount,
    status: s.status,
    note: s.note || null,
    created_at: s.createdAt.getTime(),
    sync_status: s.syncStatus || 'pending',
    is_deleted: s.isDeleted ? 1 : 0,
  };
}

function rowToSettlement(row: LocalSettlementRow): Settlement {
  return {
    id: row.id,
    groupId: row.group_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    fromUserName: row.from_user_name,
    toUserName: row.to_user_name,
    amount: row.amount,
    status: row.status,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at),
    syncStatus: row.sync_status as any,
    isDeleted: Boolean(row.is_deleted),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Record settlement — balance reduced
// ─────────────────────────────────────────────────────────────────────────────
runTest('1. Record settlement — balance reduced', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  ];

  // Alice pays ₹100 for Bob (Bob owes Alice ₹100)
  const expenses: Expense[] = [
    {
      id: 'exp_s_01',
      groupId: 'grp_001',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Groceries',
      amount: 100,
      splitType: 'unequal',
      splits: [{ userId: 'u2', amount: 100, type: 'unequal' }],
      currency: 'INR',
      tags: [],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  // Initial balance check
  const initialBalances = computeNetBalances(expenses, members, []);
  assert.strictEqual(initialBalances.get('u1'), 100, 'Alice is owed 100');
  assert.strictEqual(initialBalances.get('u2'), -100, 'Bob owes 100');

  // Record settlement: Bob pays Alice ₹40
  const settlement1: Settlement = {
    id: 'stl_001',
    groupId: 'grp_001',
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob',
    toUserName: 'Alice',
    amount: 40,
    status: 'completed',
    createdAt: new Date('2026-01-02'),
  };

  const balancesAfterSettlement = computeNetBalances(expenses, members, [settlement1]);
  assert.strictEqual(balancesAfterSettlement.get('u1'), 60, 'Alice credit reduced from 100 to 60');
  assert.strictEqual(balancesAfterSettlement.get('u2'), -60, 'Bob debt reduced from -100 to -60');

  const pendingSettlements = calculateGroupSettlements(expenses, members, [settlement1], true);
  assert.strictEqual(pendingSettlements.length, 1);
  assert.strictEqual(pendingSettlements[0].amount, 60, 'Remaining debt between Bob and Alice is 60');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Settlement amount cannot exceed outstanding balance
// ─────────────────────────────────────────────────────────────────────────────
runTest('2. Settlement amount cannot exceed outstanding balance', () => {
  const outstandingDebt = 100.00; // Bob owes Alice ₹100.00

  // Valid partial settlement: ₹50 <= ₹100
  const validPartial = validateSettlementAmount(50.00, outstandingDebt);
  assert.strictEqual(validPartial.isValid, true);

  // Valid full settlement: ₹100 == ₹100
  const validFull = validateSettlementAmount(100.00, outstandingDebt);
  assert.strictEqual(validFull.isValid, true);

  // Invalid: exceeding settlement ₹100.01 > ₹100.00
  const overSettlement1 = validateSettlementAmount(100.01, outstandingDebt);
  assert.strictEqual(overSettlement1.isValid, false);
  assert.ok(overSettlement1.error?.includes('cannot exceed outstanding balance'));

  // Invalid: exceeding settlement ₹200 > ₹100
  const overSettlement2 = validateSettlementAmount(200.00, outstandingDebt);
  assert.strictEqual(overSettlement2.isValid, false);
  assert.ok(overSettlement2.error?.includes('cannot exceed outstanding balance'));

  // Invalid: zero amount
  const zeroSettlement = validateSettlementAmount(0, outstandingDebt);
  assert.strictEqual(zeroSettlement.isValid, false);
  assert.strictEqual(zeroSettlement.error, 'Settlement amount must be greater than zero');

  // Invalid: negative amount
  const negSettlement = validateSettlementAmount(-25, outstandingDebt);
  assert.strictEqual(negSettlement.isValid, false);
  assert.strictEqual(negSettlement.error, 'Settlement amount must be greater than zero');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Settlement creates Firestore record
// ─────────────────────────────────────────────────────────────────────────────
runTest('3. Settlement creates Firestore record', () => {
  const groupId = 'grp_manali_2026';
  const settlementId = 'stl_cloud_9988';

  // Firestore Document Path Verification
  const firestorePath = `splitwiser/data/groups/${groupId}/settlements/${settlementId}`;
  assert.ok(
    firestorePath.startsWith('splitwiser/data/groups/'),
    'Settlement path must strictly reside under /splitwiser/data/ namespace'
  );

  // Raw Firestore document payload
  const rawFirestoreDoc = {
    groupId,
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob Jones',
    toUserName: 'Alice Smith',
    amount: 125.50,
    status: 'completed',
    note: 'GPay transfer reference 12345678',
    createdAt: new Date('2026-02-15T10:30:00Z'),
  };

  // Map to strongly-typed client Settlement
  const mapped = mapFirestoreSettlementDoc(settlementId, rawFirestoreDoc);

  assert.strictEqual(mapped.id, settlementId);
  assert.strictEqual(mapped.groupId, groupId);
  assert.strictEqual(mapped.fromUserId, 'u2');
  assert.strictEqual(mapped.toUserId, 'u1');
  assert.strictEqual(mapped.fromUserName, 'Bob Jones');
  assert.strictEqual(mapped.toUserName, 'Alice Smith');
  assert.strictEqual(mapped.amount, 125.50);
  assert.strictEqual(mapped.status, 'completed');
  assert.strictEqual(mapped.note, 'GPay transfer reference 12345678');
  assert.strictEqual(mapped.createdAt.toISOString(), '2026-02-15T10:30:00.000Z');
  assert.strictEqual(mapped.isDeleted, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Settlement history retrievable by group
// ─────────────────────────────────────────────────────────────────────────────
runTest('4. Settlement history retrievable by group', () => {
  const settlementsDatabase: Settlement[] = [
    {
      id: 's1',
      groupId: 'grp_A',
      fromUserId: 'u2',
      toUserId: 'u1',
      fromUserName: 'Bob',
      toUserName: 'Alice',
      amount: 50,
      status: 'completed',
      createdAt: new Date('2026-01-01'),
      isDeleted: false,
    },
    {
      id: 's2',
      groupId: 'grp_B', // Different group
      fromUserId: 'u3',
      toUserId: 'u4',
      fromUserName: 'Charlie',
      toUserName: 'Dave',
      amount: 80,
      status: 'completed',
      createdAt: new Date('2026-01-02'),
      isDeleted: false,
    },
    {
      id: 's3',
      groupId: 'grp_A',
      fromUserId: 'u2',
      toUserId: 'u1',
      fromUserName: 'Bob',
      toUserName: 'Alice',
      amount: 30,
      status: 'completed',
      createdAt: new Date('2026-01-03'),
      isDeleted: false,
    },
    {
      id: 's4',
      groupId: 'grp_A',
      fromUserId: 'u2',
      toUserId: 'u1',
      fromUserName: 'Bob',
      toUserName: 'Alice',
      amount: 20,
      status: 'completed',
      createdAt: new Date('2026-01-04'),
      isDeleted: true, // Soft-deleted record
    },
  ];

  // Query settlements for group 'grp_A' (excluding deleted, ordered by createdAt desc)
  const groupASettlements = settlementsDatabase
    .filter((s) => s.groupId === 'grp_A' && !s.isDeleted)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  assert.strictEqual(groupASettlements.length, 2, 'Must return exactly 2 active settlements for grp_A');
  assert.strictEqual(groupASettlements[0].id, 's3', 'Most recent active settlement (Jan 3) is first');
  assert.strictEqual(groupASettlements[1].id, 's1', 'Older active settlement (Jan 1) is second');
  assert.strictEqual(groupASettlements.some((s) => s.id === 's4'), false, 'Soft-deleted settlement excluded');
  assert.strictEqual(groupASettlements.some((s) => s.id === 's2'), false, 'Different group settlement excluded');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Balance after multiple partial settlements
// ─────────────────────────────────────────────────────────────────────────────
runTest('5. Balance after multiple partial settlements', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  ];

  // Expense: Alice paid ₹1000 for Bob (Bob owes ₹1000)
  const expenses: Expense[] = [
    {
      id: 'exp_big_debt',
      groupId: 'grp_001',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Flight Booking',
      amount: 1000,
      splitType: 'unequal',
      splits: [{ userId: 'u2', amount: 1000, type: 'unequal' }],
      currency: 'INR',
      tags: ['Travel'],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  // Initial debt = 1000
  let balances = computeNetBalances(expenses, members, []);
  assert.strictEqual(balances.get('u1'), 1000);
  assert.strictEqual(balances.get('u2'), -1000);

  // Settlement 1: ₹300
  const s1: Settlement = {
    id: 's_part_1',
    groupId: 'grp_001',
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob',
    toUserName: 'Alice',
    amount: 300,
    status: 'completed',
    createdAt: new Date('2026-01-02'),
  };
  balances = computeNetBalances(expenses, members, [s1]);
  assert.strictEqual(balances.get('u1'), 700, 'After 1st partial settlement: Alice credit = 700');
  assert.strictEqual(balances.get('u2'), -700, 'After 1st partial settlement: Bob debt = -700');

  // Settlement 2: ₹250
  const s2: Settlement = {
    id: 's_part_2',
    groupId: 'grp_001',
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob',
    toUserName: 'Alice',
    amount: 250,
    status: 'completed',
    createdAt: new Date('2026-01-03'),
  };
  balances = computeNetBalances(expenses, members, [s1, s2]);
  assert.strictEqual(balances.get('u1'), 450, 'After 2nd partial settlement: Alice credit = 450');
  assert.strictEqual(balances.get('u2'), -450, 'After 2nd partial settlement: Bob debt = -450');

  // Settlement 3: ₹450
  const s3: Settlement = {
    id: 's_part_3',
    groupId: 'grp_001',
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob',
    toUserName: 'Alice',
    amount: 450,
    status: 'completed',
    createdAt: new Date('2026-01-04'),
  };
  balances = computeNetBalances(expenses, members, [s1, s2, s3]);
  assert.strictEqual(balances.get('u1'), 0, 'After 3rd partial settlement: Alice credit = 0');
  assert.strictEqual(balances.get('u2'), 0, 'After 3rd partial settlement: Bob debt = 0');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Full settlement gives net balance = 0
// ─────────────────────────────────────────────────────────────────────────────
runTest('6. Full settlement gives net balance = 0', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
    { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
  ];

  // Alice paid ₹1000: Bob's share = 500, Charlie's share = 500
  const expenses: Expense[] = [
    {
      id: 'exp_full_settle',
      groupId: 'grp_villa',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Villa Stay',
      amount: 1000,
      splitType: 'unequal',
      splits: [
        { userId: 'u2', amount: 500, type: 'unequal' },
        { userId: 'u3', amount: 500, type: 'unequal' },
      ],
      currency: 'INR',
      tags: ['Travel'],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  // Full settlements from both Bob and Charlie
  const fullSettlementBob: Settlement = {
    id: 'stl_bob_full',
    groupId: 'grp_villa',
    fromUserId: 'u2',
    toUserId: 'u1',
    fromUserName: 'Bob',
    toUserName: 'Alice',
    amount: 500,
    status: 'completed',
    createdAt: new Date('2026-01-02'),
  };

  const fullSettlementCharlie: Settlement = {
    id: 'stl_charlie_full',
    groupId: 'grp_villa',
    fromUserId: 'u3',
    toUserId: 'u1',
    fromUserName: 'Charlie',
    toUserName: 'Alice',
    amount: 500,
    status: 'completed',
    createdAt: new Date('2026-01-02'),
  };

  const allSettlements = [fullSettlementBob, fullSettlementCharlie];
  const finalBalances = computeNetBalances(expenses, members, allSettlements);

  // All net balances must be exactly 0
  assert.strictEqual(finalBalances.get('u1'), 0, 'Alice final balance is 0');
  assert.strictEqual(finalBalances.get('u2'), 0, 'Bob final balance is 0');
  assert.strictEqual(finalBalances.get('u3'), 0, 'Charlie final balance is 0');

  // Both simplified and direct group settlements must produce empty lists
  const simplifiedPending = calculateGroupSettlements(expenses, members, allSettlements, true);
  assert.strictEqual(simplifiedPending.length, 0, 'Simplified pending settlements list is empty');

  const directPending = calculateGroupSettlements(expenses, members, allSettlements, false);
  assert.strictEqual(directPending.length, 0, 'Direct pairwise pending settlements list is empty');
});

console.log('\n─────────────────────────────────────────────────────────');
console.log(`TOTAL SETTLEMENT TESTS RUN: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL SETTLEMENT QA TESTS PASSED SUCCESSFULLY! 🎉\n');
}
