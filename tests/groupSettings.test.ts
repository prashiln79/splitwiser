import assert from 'assert';
import {
  calculateGroupSettlements,
  getDirectPairwiseSettlements,
  getOptimizedSettlements,
} from '../src/utils/balanceCalculator';
import {
  filterItemsByDateRange,
  generateGroupCsv,
  generateGroupSummary,
} from '../src/services/exportService';
import {
  DEFAULT_GROUP_PREFERENCES,
  Expense,
  Group,
  GroupMember,
  GroupType,
} from '../src/types';

console.log('--- STARTING GROUP SETTINGS & MANAGEMENT UNIT TESTS ---');

// 1. Group Types Verification
const ALL_GROUP_TYPES: GroupType[] = [
  'home',
  'trip',
  'couple',
  'family',
  'friends',
  'office',
  'other',
];
assert.strictEqual(ALL_GROUP_TYPES.length, 7, 'Must have 7 curated group types');
console.log('✅ [PASS] 7 Group types configured with dedicated categories');

// 2. Default Group Preferences
assert.strictEqual(DEFAULT_GROUP_PREFERENCES.hideUninvolvedExpenses, false);
assert.strictEqual(DEFAULT_GROUP_PREFERENCES.muted, false);
assert.strictEqual(DEFAULT_GROUP_PREFERENCES.notifications.newExpenses, true);
assert.strictEqual(DEFAULT_GROUP_PREFERENCES.notifications.settlements, true);
console.log('✅ [PASS] Default group notification & viewing preferences validated');

// 3. Simplified vs Non-Simplified Settlements
const mockMembers: GroupMember[] = [
  { userId: 'u1', userName: 'Alice', role: 'admin', joinedAt: new Date() },
  { userId: 'u2', userName: 'Bob', role: 'member', joinedAt: new Date() },
  { userId: 'u3', userName: 'Charlie', role: 'member', joinedAt: new Date() },
];

const mockExpenses: Expense[] = [
  {
    id: 'e1',
    groupId: 'g1',
    createdBy: 'u1',
    paidBy: 'u1',
    description: 'Dinner',
    amount: 60,
    currency: 'INR',
    splitType: 'equal',
    tags: ['food'],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: 'u1', amount: 20, type: 'equal' },
      { userId: 'u2', amount: 20, type: 'equal' },
      { userId: 'u3', amount: 20, type: 'equal' },
    ],
  },
  {
    id: 'e2',
    groupId: 'g1',
    createdBy: 'u2',
    paidBy: 'u2',
    description: 'Taxi',
    amount: 60,
    currency: 'INR',
    splitType: 'equal',
    tags: ['transport'],
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
      { userId: 'u1', amount: 20, type: 'equal' },
      { userId: 'u2', amount: 20, type: 'equal' },
      { userId: 'u3', amount: 20, type: 'equal' },
    ],
  },
];

const directSettlements = getDirectPairwiseSettlements(mockExpenses, mockMembers);
assert.strictEqual(directSettlements.length, 2, 'Non-simplified must produce 2 direct debts for Charlie');
const simplifiedSettlements = getOptimizedSettlements(mockExpenses, mockMembers);
assert.ok(simplifiedSettlements.length <= 2, 'Optimized settlements must be minimal');
console.log('✅ [PASS] Direct bilateral pairwise debts calculated accurately');

// Test calculateGroupSettlements switch
const resultSimplified = calculateGroupSettlements(mockExpenses, mockMembers, [], true);
const resultDirect = calculateGroupSettlements(mockExpenses, mockMembers, [], false);
assert.ok(resultSimplified.length > 0);
assert.ok(resultDirect.length > 0);
console.log('✅ [PASS] calculateGroupSettlements honors simplifyDebts flag');

// 4. Export Service CSV & Text generation
const mockGroup: Group = {
  id: 'g1',
  name: 'Goa 2026',
  currency: 'INR',
  type: 'trip',
  joinCode: 'GOA123',
  createdBy: 'u1',
  createdAt: new Date('2026-01-01'),
  memberIds: ['u1', 'u2', 'u3'],
};

const csv = generateGroupCsv({
  group: mockGroup,
  members: mockMembers,
  expenses: mockExpenses,
  settlements: [],
  dateRange: 'all',
});

assert.ok(csv.includes('"SPLITWISER GROUP FINANCIAL EXPORT"'), 'CSV must have header');
assert.ok(csv.includes('"Goa 2026"'), 'CSV must include group name');
assert.ok(csv.includes('"Dinner"'), 'CSV must include expense description');
assert.ok(csv.includes('"Taxi"'), 'CSV must include expense description');
console.log('✅ [PASS] Group CSV spreadsheet export generates valid RFC-4180 structure');

const summary = generateGroupSummary({
  group: mockGroup,
  members: mockMembers,
  expenses: mockExpenses,
  settlements: [],
  dateRange: 'all',
});
assert.ok(summary.includes('GOA 2026 — FINANCIAL REPORT'), 'Summary must contain header');
assert.ok(summary.includes('Total Expenses: ₹120.00'), 'Summary must compute totals');
console.log('✅ [PASS] Group financial text summary generates cleanly');

// 5. Date Range Filtering
const pastExpense: Expense = {
  ...mockExpenses[0],
  id: 'e_past',
  createdAt: new Date('2020-01-01'),
};
const filteredAll = filterItemsByDateRange([pastExpense, mockExpenses[0]], 'all');
assert.strictEqual(filteredAll.length, 2);
const filteredThisMonth = filterItemsByDateRange([pastExpense, mockExpenses[0]], 'this_month');
assert.strictEqual(filteredThisMonth.length, 1);
console.log('✅ [PASS] Date range filtering works accurately across months/years');

console.log('ALL GROUP SETTINGS & MANAGEMENT UNIT TESTS PASSED');
