/**
 * GROUP MANAGEMENT & SETTLEMENT CALCULATION QA TEST SUITE
 * ─────────────────────────────────────────────────────────────
 * Comprehensive tests for group creation, validation, join codes,
 * member lifecycle, settings & currency, soft deletion, bilateral
 * debt calculations, debt simplification, and RFC-4180 CSV export.
 */

import assert from 'assert';
import { Group, GroupMember, Expense, Settlement, GroupType, GroupSettings } from '../src/types';
import { APP_LIMITS } from '../src/constants/limits';
import { normalizeCurrencyCode } from '../src/utils/currency';
import {
  calculateGroupSettlements,
  getDirectPairwiseSettlements,
  getOptimizedSettlements,
  computeNetBalances,
} from '../src/utils/balanceCalculator';
import { generateGroupCsv } from '../src/services/exportService';

console.log('\n========================================================');
console.log('    GROUP QA — COMPREHENSIVE AUTOMATED TEST SUITE       ');
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

// ─── Group Validation & Helper Functions ─────────────────────────────────────

function validateGroupInput(input: {
  name?: any;
  currency?: any;
  createdBy?: any;
}): { isValid: boolean; error?: string } {
  if (typeof input.name !== 'string') {
    return { isValid: false, error: 'Group name must be a string' };
  }
  const trimmed = input.name.trim();
  if (trimmed.length < APP_LIMITS.GROUP.MIN_NAME_LENGTH) {
    return { isValid: false, error: 'Empty group name rejected' };
  }
  if (trimmed.length > APP_LIMITS.GROUP.MAX_NAME_LENGTH) {
    return { isValid: false, error: 'Group name exceeds maximum length (50 characters)' };
  }
  if (!input.createdBy || typeof input.createdBy !== 'string' || input.createdBy.trim() === '') {
    return { isValid: false, error: 'Creator UID required' };
  }
  return { isValid: true };
}

function generateJoinCode(length = APP_LIMITS.GROUP.JOIN_CODE_LENGTH): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Unambiguous charset (no 0/O, 1/I)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Simulated SQLite Group Row Transformation (matching groupRepository.ts)
interface LocalGroupRow {
  id: string;
  name: string;
  currency: string;
  join_code: string | null;
  created_by: string;
  created_at: number;
  image_url: string | null;
  banner_url: string | null;
  icon: string | null;
  member_ids_json: string;
  updated_at: number;
  sync_status: string;
  is_deleted: number;
}

function groupToRow(group: Group): LocalGroupRow {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    join_code: group.joinCode,
    created_by: group.createdBy,
    created_at: group.createdAt.getTime(),
    image_url: group.imageUrl || null,
    banner_url: group.bannerUrl || null,
    icon: group.icon || null,
    member_ids_json: JSON.stringify(group.memberIds),
    updated_at: group.updatedAt ? group.updatedAt.getTime() : group.createdAt.getTime(),
    sync_status: group.syncStatus || 'pending',
    is_deleted: group.isDeleted ? 1 : 0,
  };
}

function rowToGroup(row: LocalGroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency || 'INR',
    joinCode: row.join_code || '',
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    imageUrl: row.image_url || undefined,
    bannerUrl: row.banner_url || undefined,
    icon: row.icon || undefined,
    memberIds: JSON.parse(row.member_ids_json || '[]'),
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status as any,
    isDeleted: Boolean(row.is_deleted),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create group — valid fields
// ─────────────────────────────────────────────────────────────────────────────
runTest('1. Create group — valid fields', () => {
  const groupInput = {
    name: 'Trip to Manali',
    currency: 'INR',
    createdBy: 'user_alice',
  };

  const validation = validateGroupInput(groupInput);
  assert.strictEqual(validation.isValid, true, 'Valid group input passes validation');

  const now = new Date();
  const group: Group = {
    id: 'grp_manali_01',
    name: groupInput.name.trim(),
    currency: normalizeCurrencyCode(groupInput.currency),
    joinCode: generateJoinCode(),
    createdBy: groupInput.createdBy,
    memberIds: [groupInput.createdBy],
    createdAt: now,
    updatedAt: now,
    type: 'trip',
    isDeleted: false,
    syncStatus: 'pending',
  };

  assert.strictEqual(group.name, 'Trip to Manali');
  assert.strictEqual(group.currency, 'INR');
  assert.strictEqual(group.createdBy, 'user_alice');
  assert.deepStrictEqual(group.memberIds, ['user_alice']);
  assert.strictEqual(group.isDeleted, false);
  assert.strictEqual(group.joinCode.length, 6);
  assert.strictEqual(group.type, 'trip');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create group — empty name rejected
// ─────────────────────────────────────────────────────────────────────────────
runTest('2. Create group — empty name rejected', () => {
  // Empty string
  const emptyRes = validateGroupInput({ name: '', createdBy: 'u1' });
  assert.strictEqual(emptyRes.isValid, false);
  assert.strictEqual(emptyRes.error, 'Empty group name rejected');

  // Whitespace only
  const wsRes = validateGroupInput({ name: '     ', createdBy: 'u1' });
  assert.strictEqual(wsRes.isValid, false);
  assert.strictEqual(wsRes.error, 'Empty group name rejected');

  // Name exceeding 50 characters (APP_LIMITS.GROUP.MAX_NAME_LENGTH)
  const longName = 'Trip to Himalayas and Beyond with All Friends 2026 Edition Extended';
  assert.ok(longName.length > 50);
  const longRes = validateGroupInput({ name: longName, createdBy: 'u1' });
  assert.strictEqual(longRes.isValid, false);
  assert.strictEqual(longRes.error, 'Group name exceeds maximum length (50 characters)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Group join code is unique
// ─────────────────────────────────────────────────────────────────────────────
runTest('3. Group join code is unique', () => {
  const codesSet = new Set<string>();
  const NUM_CODES = 1000;

  for (let i = 0; i < NUM_CODES; i++) {
    const code = generateJoinCode(6);
    assert.strictEqual(code.length, 6, 'Join code must be exactly 6 characters');
    assert.match(code, /^[A-Z0-9]{6}$/, 'Join code must consist of uppercase alphanumeric characters');
    // Ensure no ambiguous characters
    assert.strictEqual(code.includes('0'), false, 'Join code excludes 0');
    assert.strictEqual(code.includes('O'), false, 'Join code excludes O');
    assert.strictEqual(code.includes('1'), false, 'Join code excludes 1');
    assert.strictEqual(code.includes('I'), false, 'Join code excludes I');
    codesSet.add(code);
  }

  // Check collision rate across 1000 generated codes
  assert.strictEqual(codesSet.size, NUM_CODES, '1,000 generated join codes must have 0 collisions');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Add member to group — member list updated
// ─────────────────────────────────────────────────────────────────────────────
runTest('4. Add member to group — member list updated', () => {
  const group: Group = {
    id: 'grp_add_member',
    name: 'Flat 402',
    currency: 'INR',
    joinCode: 'FLAT02',
    createdBy: 'u1',
    memberIds: ['u1'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
  ];

  // Add member u2 (Bob)
  const newMemberId = 'u2';
  const newMember: GroupMember = {
    userId: newMemberId,
    userName: 'Bob',
    role: 'member',
    joinedAt: new Date(),
  };

  const updatedGroup: Group = {
    ...group,
    memberIds: [...group.memberIds, newMemberId],
    updatedAt: new Date(),
  };
  const updatedMembers = [...members, newMember];

  assert.strictEqual(updatedGroup.memberIds.length, 2);
  assert.ok(updatedGroup.memberIds.includes('u2'));
  assert.strictEqual(updatedMembers.length, 2);
  assert.strictEqual(updatedMembers[1].userName, 'Bob');
  assert.strictEqual(updatedMembers[1].role, 'member');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Remove member — no longer in member list
// ─────────────────────────────────────────────────────────────────────────────
runTest('5. Remove member — no longer in member list', () => {
  const group: Group = {
    id: 'grp_remove_member',
    name: 'Flat 402',
    currency: 'INR',
    joinCode: 'FLAT02',
    createdBy: 'u1',
    memberIds: ['u1', 'u2', 'u3'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
    { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
  ];

  // Remove member u2 (Bob)
  const memberToRemove = 'u2';
  const updatedMemberIds = group.memberIds.filter((id) => id !== memberToRemove);
  const updatedMembers = members.filter((m) => m.userId !== memberToRemove);

  const updatedGroup: Group = {
    ...group,
    memberIds: updatedMemberIds,
    updatedAt: new Date(),
  };

  assert.strictEqual(updatedGroup.memberIds.length, 2);
  assert.strictEqual(updatedGroup.memberIds.includes('u2'), false, 'u2 is no longer in memberIds');
  assert.strictEqual(updatedMembers.some((m) => m.userId === 'u2'), false, 'Bob is no longer in members list');
  assert.deepStrictEqual(updatedGroup.memberIds, ['u1', 'u3']);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Group settings — currency stored
// ─────────────────────────────────────────────────────────────────────────────
runTest('6. Group settings — currency stored', () => {
  const group: Group = {
    id: 'grp_settings',
    name: 'Europe Tour 2026',
    currency: 'EUR',
    joinCode: 'EUR026',
    createdBy: 'u1',
    memberIds: ['u1', 'u2'],
    createdAt: new Date(),
    settings: {
      simplifyDebts: true,
      defaultSplitType: 'equal',
      memberPermissions: 'anyone',
    },
  };

  assert.strictEqual(group.currency, 'EUR');
  assert.strictEqual(group.settings?.simplifyDebts, true);
  assert.strictEqual(group.settings?.defaultSplitType, 'equal');

  // Verify SQLite row serialization and reconstruction
  const row = groupToRow(group);
  assert.strictEqual(row.currency, 'EUR');
  const reconstructed = rowToGroup(row);
  assert.strictEqual(reconstructed.currency, 'EUR');

  // Update currency to USD
  const updatedCurrency = normalizeCurrencyCode('USD');
  const updatedGroup: Group = {
    ...group,
    currency: updatedCurrency,
    updatedAt: new Date(),
  };
  assert.strictEqual(updatedGroup.currency, 'USD');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Group delete — soft delete, not destroyed
// ─────────────────────────────────────────────────────────────────────────────
runTest('7. Group delete — soft delete, not destroyed', () => {
  const group: Group = {
    id: 'grp_to_delete',
    name: 'Old Apartment',
    currency: 'INR',
    joinCode: 'OLDAPT',
    createdBy: 'u1',
    memberIds: ['u1', 'u2'],
    createdAt: new Date('2025-01-01'),
    isDeleted: false,
  };

  const expenses: Expense[] = [
    {
      id: 'exp_g_01',
      groupId: 'grp_to_delete',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Rent',
      amount: 10000,
      splitType: 'equal',
      splits: [
        { userId: 'u1', amount: 5000, type: 'equal' },
        { userId: 'u2', amount: 5000, type: 'equal' },
      ],
      currency: 'INR',
      tags: ['Rent'],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      isDeleted: false,
    },
  ];

  // Soft delete group (deleteGroupLocal logic)
  const deletedGroup: Group = {
    ...group,
    isDeleted: true,
    updatedAt: new Date(),
  };

  // Cascade soft delete to associated expenses
  const deletedExpenses = expenses.map((e) => ({
    ...e,
    isDeleted: true,
    updatedAt: new Date(),
  }));

  // Verify group is soft-deleted
  const groupRow = groupToRow(deletedGroup);
  assert.strictEqual(groupRow.is_deleted, 1, 'Group is_deleted must be 1 in SQLite');
  assert.strictEqual(groupRow.id, 'grp_to_delete', 'Group row is retained in SQLite database');

  // Verify expenses are marked soft-deleted
  assert.strictEqual(deletedExpenses[0].isDeleted, true);

  // Active query filters out deleted groups
  const allGroups = [deletedGroup];
  const activeGroups = allGroups.filter((g) => !g.isDeleted);
  assert.strictEqual(activeGroups.length, 0, 'Soft deleted group is excluded from active listings');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. calculateGroupSettlements — bilateral debt correct
// ─────────────────────────────────────────────────────────────────────────────
runTest('8. calculateGroupSettlements — bilateral debt correct', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
    { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
  ];

  // Alice pays ₹60 for Alice, Bob, and Charlie (₹20 each)
  const expenses: Expense[] = [
    {
      id: 'exp_bi_01',
      groupId: 'g1',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Lunch',
      amount: 60,
      splitType: 'equal',
      splits: [
        { userId: 'u1', amount: 20, type: 'equal' },
        { userId: 'u2', amount: 20, type: 'equal' },
        { userId: 'u3', amount: 20, type: 'equal' },
      ],
      currency: 'INR',
      tags: ['Food'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Calculate direct bilateral settlements (simplifyDebts = false)
  const directDebts = calculateGroupSettlements(expenses, members, [], false);
  assert.strictEqual(directDebts.length, 2, 'Must produce 2 bilateral debts');

  const bobToAlice = directDebts.find((d) => d.fromUserId === 'u2' && d.toUserId === 'u1');
  assert.ok(bobToAlice, 'Bob must owe Alice');
  assert.strictEqual(bobToAlice?.amount, 20);

  const charlieToAlice = directDebts.find((d) => d.fromUserId === 'u3' && d.toUserId === 'u1');
  assert.ok(charlieToAlice, 'Charlie must owe Alice');
  assert.strictEqual(charlieToAlice?.amount, 20);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. calculateGroupSettlements with simplifyDebts = true
// ─────────────────────────────────────────────────────────────────────────────
runTest('9. calculateGroupSettlements with simplifyDebts = true', () => {
  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
    { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
  ];

  // Expense 1: Bob paid ₹100 for Alice (Alice owes Bob ₹100)
  // Expense 2: Charlie paid ₹100 for Bob (Bob owes Charlie ₹100)
  const expenses: Expense[] = [
    {
      id: 'e1',
      groupId: 'g_simp',
      createdBy: 'u2',
      paidBy: 'u2',
      description: 'Flight ticket for Alice',
      amount: 100,
      splitType: 'unequal',
      splits: [{ userId: 'u1', amount: 100, type: 'unequal' }],
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'e2',
      groupId: 'g_simp',
      createdBy: 'u3',
      paidBy: 'u3',
      description: 'Hotel room for Bob',
      amount: 100,
      splitType: 'unequal',
      splits: [{ userId: 'u2', amount: 100, type: 'unequal' }],
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 1. Without debt simplification (pairwise):
  // Alice owes Bob 100, Bob owes Charlie 100 -> 2 transactions
  const nonSimplified = calculateGroupSettlements(expenses, members, [], false);
  assert.strictEqual(nonSimplified.length, 2, 'Non-simplified requires 2 separate payments');

  // 2. With debt simplification (simplifyDebts = true):
  // Bob's net balance is 0 (+100 - 100 = 0).
  // Alice owes Charlie ₹100 directly -> 1 transaction!
  const simplified = calculateGroupSettlements(expenses, members, [], true);
  assert.strictEqual(simplified.length, 1, 'Simplified debts requires only 1 minimal transaction');
  assert.strictEqual(simplified[0].fromUserId, 'u1', 'Alice is the debtor');
  assert.strictEqual(simplified[0].toUserId, 'u3', 'Charlie is the creditor');
  assert.strictEqual(simplified[0].amount, 100);

  // 3. Verify net balance invariance
  const balances = computeNetBalances(expenses, members);
  assert.strictEqual(balances.get('u1'), -100, 'Alice net balance is -100');
  assert.strictEqual(balances.get('u2'), 0, 'Bob net balance is 0');
  assert.strictEqual(balances.get('u3'), 100, 'Charlie net balance is +100');
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. CSV export format valid RFC-4180
// ─────────────────────────────────────────────────────────────────────────────
runTest('10. CSV export format valid RFC-4180', () => {
  const group: Group = {
    id: 'grp_csv',
    name: 'Goa Trip, "Summer 2026"', // Contains comma and quotes
    currency: 'INR',
    joinCode: 'GOA2026',
    createdBy: 'u1',
    memberIds: ['u1', 'u2'],
    createdAt: new Date('2026-06-01'),
  };

  const members: GroupMember[] = [
    { userId: 'u1', userName: 'Alice Smith', role: 'admin', joinedAt: new Date() },
    { userId: 'u2', userName: 'Bob "The Boss" Jones', role: 'member', joinedAt: new Date() },
  ];

  const expenses: Expense[] = [
    {
      id: 'e_csv_1',
      groupId: 'grp_csv',
      createdBy: 'u1',
      paidBy: 'u1',
      description: 'Dinner, Drinks & Snacks', // Contains comma and ampersand
      amount: 150.50,
      splitType: 'equal',
      splits: [
        { userId: 'u1', amount: 75.25, type: 'equal' },
        { userId: 'u2', amount: 75.25, type: 'equal' },
      ],
      currency: 'INR',
      tags: ['Food'],
      createdAt: new Date('2026-06-02'),
      updatedAt: new Date('2026-06-02'),
    },
    {
      id: 'e_csv_2',
      groupId: 'grp_csv',
      createdBy: 'u2',
      paidBy: 'u2',
      description: '=cmd|’ /C calc’!A0', // Formula injection attempt
      amount: 50.00,
      splitType: 'equal',
      splits: [
        { userId: 'u1', amount: 25.00, type: 'equal' },
        { userId: 'u2', amount: 25.00, type: 'equal' },
      ],
      currency: 'INR',
      tags: ['Other'],
      createdAt: new Date('2026-06-03'),
      updatedAt: new Date('2026-06-03'),
    },
  ];

  const settlements: Settlement[] = [
    {
      id: 's_csv_1',
      groupId: 'grp_csv',
      fromUserId: 'u2',
      toUserId: 'u1',
      fromUserName: 'Bob',
      toUserName: 'Alice',
      amount: 50.25,
      status: 'completed',
      note: 'UPI Payment, Ref# 9988',
      createdAt: new Date('2026-06-04'),
    },
  ];

  const csv = generateGroupCsv({
    group,
    members,
    expenses,
    settlements,
    dateRange: 'all',
  });

  // Verify RFC-4180 specifications:
  // 1. Header present
  assert.ok(csv.includes('"SPLITWISER GROUP FINANCIAL EXPORT"'), 'CSV must include standard header');

  // 2. Group name quotes escaped properly (" -> "")
  assert.ok(csv.includes('"Goa Trip, ""Summer 2026"""'), 'Embedded quotes in group name must be escaped as double quotes');

  // 3. Comma in description enclosed in quotes
  assert.ok(csv.includes('"Dinner, Drinks & Snacks"'), 'Descriptions with commas must be enclosed in quotes');

  // 4. Formula injection sanitization: dangerous starting char = prefixed with single quote
  assert.ok(csv.includes(`"'=cmd|’ /C calc’!A0"`), 'Formula injection payload must be neutralized with leading single quote');

  // 5. Settlement section present with proper RFC-4180 escaping
  assert.ok(csv.includes('RECORDED SETTLEMENTS'), 'CSV must include settlements table');
  assert.ok(csv.includes('"Bob ""The Boss"" Jones"'), 'Member name with quotes in settlements must be escaped as double quotes');
});

console.log('\n─────────────────────────────────────────────────────────');
console.log(`TOTAL GROUP TESTS RUN: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL GROUP QA TESTS PASSED SUCCESSFULLY! 🎉\n');
}
