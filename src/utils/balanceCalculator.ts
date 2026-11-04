import { Expense, GroupMember, OptimizedSettlement, FriendBalance } from '../types';

// ─── Debt Minimization (preserved from balanceCalculator.js) ──────────────────

/**
 * Compute the net balance each member owes or is owed within a group.
 * Returns map: userId → net balance (positive = owed to them, negative = they owe)
 */
export function computeNetBalances(
  expenses: Expense[],
  members: GroupMember[]
): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialize all members at zero
  members.forEach((m) => balances.set(m.userId, 0));

  expenses.forEach((expense) => {
    const payerId = expense.paidBy || expense.createdBy;
    if (!payerId) return;

    expense.splits.forEach((split) => {
      if (split.userId === payerId) return; // payer doesn't owe themselves

      const amount = split.amount;
      // Payer is owed this split amount
      balances.set(payerId, (balances.get(payerId) ?? 0) + amount);
      // Split member owes this amount
      balances.set(split.userId, (balances.get(split.userId) ?? 0) - amount);
    });
  });

  return balances;
}

/**
 * Debt minimization algorithm: reduces transactions to minimum needed.
 * This is the same logic that was previously in the FastAPI backend.
 */
export function optimizeSettlements(
  balances: Map<string, number>,
  members: GroupMember[]
): OptimizedSettlement[] {
  const memberMap = new Map(members.map((m) => [m.userId, m.userName]));

  // Separate creditors (positive balance) from debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  balances.forEach((balance, userId) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) creditors.push({ userId, amount: rounded });
    else if (rounded < -0.01) debtors.push({ userId, amount: Math.abs(rounded) });
  });

  const settlements: OptimizedSettlement[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      fromUserName: memberMap.get(debtor.userId) ?? 'Unknown',
      toUserName: memberMap.get(creditor.userId) ?? 'Unknown',
      amount: Math.round(amount * 100) / 100,
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return settlements;
}

/**
 * Compute optimized settlements for a group from expenses + members.
 */
export function getOptimizedSettlements(
  expenses: Expense[],
  members: GroupMember[]
): OptimizedSettlement[] {
  const balances = computeNetBalances(expenses, members);
  return optimizeSettlements(balances, members);
}

// ─── Friends Balance (cross-group) ───────────────────────────────────────────

/**
 * Compute aggregated friend balances across multiple groups.
 */
export function computeFriendBalances(
  groups: Array<{
    groupId: string;
    groupName: string;
    expenses: Expense[];
    members: GroupMember[];
  }>,
  currentUserId: string
): FriendBalance[] {
  // friend uid → { userName, groups: { groupId → balance } }
  const friendMap = new Map<
    string,
    { userName: string; netBalance: number; groups: Map<string, { name: string; balance: number }> }
  >();

  groups.forEach(({ groupId, groupName, expenses, members }) => {
    const memberMap = new Map(members.map((m) => [m.userId, m.userName]));

    expenses.forEach((expense) => {
      const payerId = expense.paidBy || expense.createdBy;
      if (!payerId) return;

      const payerIsMe = payerId === currentUserId;

      expense.splits.forEach((split) => {
        if (split.userId === payerId) return;
        const memberIsMe = split.userId === currentUserId;
        const amount = split.amount;

        let friendId: string;
        let contribution: number;

        if (payerIsMe && !memberIsMe) {
          // I paid, friend owes me
          friendId = split.userId;
          contribution = amount; // positive = friend owes me
        } else if (!payerIsMe && memberIsMe) {
          // Friend paid, I owe friend
          friendId = payerId;
          contribution = -amount; // negative = I owe friend
        } else {
          return;
        }

        if (!friendMap.has(friendId)) {
          friendMap.set(friendId, {
            userName: memberMap.get(friendId) ?? 'Unknown',
            netBalance: 0,
            groups: new Map(),
          });
        }

        const friend = friendMap.get(friendId)!;
        friend.netBalance += contribution;

        if (!friend.groups.has(groupId)) {
          friend.groups.set(groupId, { name: groupName, balance: 0 });
        }
        friend.groups.get(groupId)!.balance += contribution;
      });
    });
  });

  return Array.from(friendMap.entries()).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    netBalance: Math.round(data.netBalance * 100) / 100,
    groups: Array.from(data.groups.entries()).map(([groupId, g]) => ({
      groupId,
      groupName: g.name,
      balance: Math.round(g.balance * 100) / 100,
    })),
  }));
}
