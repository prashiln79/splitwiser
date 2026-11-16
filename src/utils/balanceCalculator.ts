import { Expense, GroupMember, OptimizedSettlement, FriendBalance, Settlement, CurrencyConversionRecord } from '../types';
import { normalizeCurrencyCode, fromMinorUnit } from './currency';

// ─── Debt Minimization (preserved from balanceCalculator.js) ──────────────────

/**
 * Compute the net balance each member owes or is owed within a group.
 * Returns map: userId → net balance (positive = owed to them, negative = they owe)
 */
export function computeNetBalances(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = []
): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialize all members at zero
  members.forEach((m) => balances.set(m.userId, 0));

  expenses.forEach((expense) => {
    if (expense.isDeleted) return;

    // Check if multiple payers are encoded in tags (e.g. payer:userId:amount)
    const payerTags = expense.tags?.filter((t) => t.startsWith('payer:')) || [];
    if (payerTags.length > 0) {
      payerTags.forEach((pt) => {
        const parts = pt.split(':');
        const pUid = parts[1];
        const pAmt = parseFloat(parts[2]) || 0;
        balances.set(pUid, (balances.get(pUid) ?? 0) + pAmt);
      });
      expense.splits.forEach((split) => {
        balances.set(split.userId, (balances.get(split.userId) ?? 0) - split.amount);
      });
      return;
    }

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

  // Apply settlements: fromUser paid toUser, so fromUser's debt decreases (+amount) and toUser's credit decreases (-amount)
  settlements.forEach((settlement) => {
    if (settlement.isDeleted) return;
    const fromId = settlement.fromUserId;
    const toId = settlement.toUserId;
    const amount = settlement.amount;

    balances.set(fromId, (balances.get(fromId) ?? 0) + amount);
    balances.set(toId, (balances.get(toId) ?? 0) - amount);
  });

  return balances;
}

/**
 * Compute net balances grouped by currency for groups or activities with multi-currency expenses.
 * Returns Map: currencyCode → Map<userId, netBalance>
 */
export function computeNetBalancesByCurrency(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  conversions: CurrencyConversionRecord[] = []
): Map<string, Map<string, number>> {
  const currencyMap = new Map<string, { expenses: Expense[]; settlements: Settlement[] }>();

  expenses.forEach((expense) => {
    if (expense.isDeleted) return;
    const curr = normalizeCurrencyCode(expense.currency || 'INR');
    if (!currencyMap.has(curr)) {
      currencyMap.set(curr, { expenses: [], settlements: [] });
    }
    currencyMap.get(curr)!.expenses.push(expense);
  });

  settlements.forEach((settlement) => {
    if (settlement.isDeleted) return;
    const curr = normalizeCurrencyCode(settlement.currency || 'INR');
    if (!currencyMap.has(curr)) {
      currencyMap.set(curr, { expenses: [], settlements: [] });
    }
    currencyMap.get(curr)!.settlements.push(settlement);
  });

  const results = new Map<string, Map<string, number>>();
  currencyMap.forEach(({ expenses: currExpenses, settlements: currSettlements }, curr) => {
    results.set(curr, computeNetBalances(currExpenses, members, currSettlements));
  });

  // Apply explicit manual currency conversions
  conversions.forEach((conv) => {
    if (conv.isDeleted) return;
    const src = normalizeCurrencyCode(conv.sourceCurrency);
    const tgt = normalizeCurrencyCode(conv.targetCurrency);
    const srcAmt = fromMinorUnit(conv.sourceAmountMinor, src);
    const tgtAmt = fromMinorUnit(conv.targetAmountMinor, tgt);

    if (!results.has(src)) {
      const emptyMap = new Map<string, number>();
      members.forEach((m) => emptyMap.set(m.userId, 0));
      results.set(src, emptyMap);
    }
    if (!results.has(tgt)) {
      const emptyMap = new Map<string, number>();
      members.forEach((m) => emptyMap.set(m.userId, 0));
      results.set(tgt, emptyMap);
    }

    const srcMap = results.get(src)!;
    const tgtMap = results.get(tgt)!;

    // Moving debt/credit from source to target
    srcMap.set(conv.createdBy, (srcMap.get(conv.createdBy) || 0) + srcAmt);
    tgtMap.set(conv.createdBy, (tgtMap.get(conv.createdBy) || 0) - tgtAmt);
  });

  return results;
}

/**
 * Debt minimization algorithm: reduces transactions to minimum needed.
 * This is the same logic that was previously in the FastAPI backend.
 */
export function optimizeSettlements(
  balances: Map<string, number>,
  members: GroupMember[],
  currency = 'INR'
): OptimizedSettlement[] {
  const memberMap = new Map(members.map((m) => [m.userId, m.userName]));
  const normCurrency = normalizeCurrencyCode(currency);

  // Separate creditors (positive balance) from debtors (negative balance)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  balances.forEach((balance, userId) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded >= 0.01) creditors.push({ userId, amount: rounded });
    else if (rounded <= -0.01) debtors.push({ userId, amount: Math.abs(rounded) });
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
      currency: normCurrency,
    });

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }

  return settlements;
}

/**
 * Compute optimized settlements for a group from expenses + members + settlements.
 */
export function getOptimizedSettlements(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  currency = 'INR'
): OptimizedSettlement[] {
  const balances = computeNetBalances(expenses, members, settlements);
  return optimizeSettlements(balances, members, currency);
}

/**
 * Computes direct bilateral pairwise settlements without cross-member simplification.
 */
export function getDirectPairwiseSettlements(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  currency = 'INR'
): OptimizedSettlement[] {
  const memberMap = new Map(members.map((m) => [m.userId, m.userName]));
  const pairDebts = new Map<string, number>();

  const getPairKey = (u1: string, u2: string) =>
    u1 < u2 ? `${u1}::${u2}` : `${u2}::${u1}`;

  // 1. Process expenses
  expenses.forEach((e) => {
    if (e.isDeleted) return;

    // Support multiple payers encoded in tags (payer:userId:amount)
    const payerTags = e.tags?.filter((t) => t.startsWith('payer:')) || [];
    if (payerTags.length > 0) {
      payerTags.forEach((pt) => {
        const parts = pt.split(':');
        const pUid = parts[1];
        const pAmt = parseFloat(parts[2]) || 0;
        if (pAmt <= 0 || !e.amount) return;
        const payerFraction = pAmt / e.amount;

        e.splits.forEach((s) => {
          if (s.userId === pUid) return;
          const shareOwedToPayer = s.amount * payerFraction;
          const key = getPairKey(s.userId, pUid);
          const isSmallerUser = s.userId < pUid;
          const current = pairDebts.get(key) || 0;
          pairDebts.set(key, current + (isSmallerUser ? shareOwedToPayer : -shareOwedToPayer));
        });
      });
      return;
    }

    const payer = e.paidBy;
    e.splits.forEach((s) => {
      if (s.userId === payer) return;
      const key = getPairKey(s.userId, payer);
      const isSmallerPayer = s.userId < payer;
      const current = pairDebts.get(key) || 0;
      pairDebts.set(key, current + (isSmallerPayer ? s.amount : -s.amount));
    });
  });

  // 2. Process recorded settlements
  settlements.forEach((s) => {
    const key = getPairKey(s.fromUserId, s.toUserId);
    const isSmallerPayer = s.fromUserId < s.toUserId;
    const current = pairDebts.get(key) || 0;
    pairDebts.set(key, current - (isSmallerPayer ? s.amount : -s.amount));
  });

  // 3. Convert to settlements list
  const results: OptimizedSettlement[] = [];
  const normCurrency = normalizeCurrencyCode(currency);
  pairDebts.forEach((val, key) => {
    const [u1, u2] = key.split('::');
    const rounded = Math.round(val * 100) / 100;
    if (rounded >= 0.01) {
      results.push({
        fromUserId: u1,
        fromUserName: memberMap.get(u1) || 'Unknown',
        toUserId: u2,
        toUserName: memberMap.get(u2) || 'Unknown',
        amount: rounded,
        currency: normCurrency,
      });
    } else if (rounded <= -0.01) {
      results.push({
        fromUserId: u2,
        fromUserName: memberMap.get(u2) || 'Unknown',
        toUserId: u1,
        toUserName: memberMap.get(u1) || 'Unknown',
        amount: Math.abs(rounded),
        currency: normCurrency,
      });
    }
  });

  return results;
}

/**
 * Calculates group settlements respecting the group's simplifyDebts preference.
 */
export function calculateGroupSettlements(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  simplifyDebts: boolean = true,
  currency = 'INR'
): OptimizedSettlement[] {
  const normCurrency = normalizeCurrencyCode(currency);
  if (simplifyDebts) {
    return getOptimizedSettlements(expenses, members, settlements, normCurrency);
  }
  return getDirectPairwiseSettlements(expenses, members, settlements, normCurrency);
}

/**
 * Computes group settlements grouped by currency.
 * Balances in different currencies are never combined or netted against each other.
 * Returns Map: currencyCode → OptimizedSettlement[]
 */
export function calculateGroupSettlementsByCurrency(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  simplifyDebts: boolean = true,
  conversions: CurrencyConversionRecord[] = []
): Map<string, OptimizedSettlement[]> {
  const byCurrency = computeNetBalancesByCurrency(expenses, members, settlements, conversions);
  const results = new Map<string, OptimizedSettlement[]>();

  byCurrency.forEach((balanceMap, curr) => {
    if (simplifyDebts) {
      const list = optimizeSettlements(balanceMap, members, curr);
      if (list.length > 0) {
        results.set(curr, list);
      }
    } else {
      const currExpenses = expenses.filter(
        (e) => normalizeCurrencyCode(e.currency || 'INR') === curr
      );
      const currSettlements = settlements.filter(
        (s) => normalizeCurrencyCode(s.currency || 'INR') === curr
      );
      const list = getDirectPairwiseSettlements(currExpenses, members, currSettlements, curr);
      if (list.length > 0) {
        results.set(curr, list);
      }
    }
  });

  return results;
}

/**
 * Extracts a user's net balance list across all currencies.
 * Returns array of { currency, balance } where balance is positive (owed to user) or negative (user owes).
 */
export function getUserCurrencyBalances(
  expenses: Expense[],
  members: GroupMember[],
  settlements: Settlement[] = [],
  userId: string,
  conversions: CurrencyConversionRecord[] = []
): { currency: string; balance: number }[] {
  const byCurrency = computeNetBalancesByCurrency(expenses, members, settlements, conversions);
  const list: { currency: string; balance: number }[] = [];
  byCurrency.forEach((balMap, currency) => {
    const bal = balMap.get(userId) || 0;
    if (Math.abs(bal) >= 0.005) {
      list.push({ currency, balance: Math.round(bal * 100) / 100 });
    }
  });
  return list;
}

// ─── Friends Balance (cross-group & direct) ───────────────────────────────────

/**
 * Computes bilateral balance between current user and a specific friend,
 * including direct expenses, direct settlements, and all shared groups.
 */
export function computeDetailedFriendBalance(
  currentUserId: string,
  friendId: string,
  friendName: string,
  groups: Array<{
    groupId: string;
    groupName: string;
    expenses: Expense[];
    members: GroupMember[];
    settlements?: Settlement[];
  }>,
  directExpenses: Expense[] = [],
  directSettlements: Settlement[] = []
): {
  netBalance: number;
  directBalance: number;
  groups: Array<{ groupId: string; groupName: string; balance: number }>;
  transactions: Array<{
    id: string;
    type: 'expense' | 'settlement';
    description: string;
    amount: number;
    paidBy: string;
    payerName: string;
    date: Date;
    groupId: string | null;
    groupName?: string;
    balanceImpact: number;
  }>;
} {
  let netBalance = 0;
  let directBalance = 0;
  const groupBalances: Array<{ groupId: string; groupName: string; balance: number }> = [];
  const transactions: Array<{
    id: string;
    type: 'expense' | 'settlement';
    description: string;
    amount: number;
    paidBy: string;
    payerName: string;
    date: Date;
    groupId: string | null;
    groupName?: string;
    balanceImpact: number;
  }> = [];

  // 1. Process Direct Expenses
  directExpenses.forEach((exp) => {
    if (exp.isDeleted) return;

    const payerTags = exp.tags?.filter((t) => t.startsWith('payer:')) || [];
    if (payerTags.length > 0) {
      let myPaid = 0;
      let friendPaid = 0;
      payerTags.forEach((pt) => {
        const parts = pt.split(':');
        if (parts[1] === currentUserId) myPaid = parseFloat(parts[2]) || 0;
        if (parts[1] === friendId) friendPaid = parseFloat(parts[2]) || 0;
      });

      let myShare = 0;
      let friendShare = 0;
      exp.splits.forEach((s) => {
        if (s.userId === currentUserId) myShare = s.amount;
        if (s.userId === friendId) friendShare = s.amount;
      });

      const impact = myPaid - myShare;
      directBalance += impact;
      netBalance += impact;

      transactions.push({
        id: exp.id,
        type: 'expense',
        description: exp.description,
        amount: exp.amount,
        paidBy: currentUserId,
        payerName: 'Multiple people',
        date: exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt),
        groupId: null,
        balanceImpact: impact,
      });
      return;
    }

    const payerId = exp.paidBy || exp.createdBy;
    const payerIsMe = payerId === currentUserId;
    const payerIsFriend = payerId === friendId;

    if (!payerIsMe && !payerIsFriend) return;

    let myShare = 0;
    let friendShare = 0;

    exp.splits.forEach((s) => {
      if (s.userId === currentUserId) myShare = s.amount;
      if (s.userId === friendId) friendShare = s.amount;
    });

    let impact = 0;
    if (payerIsMe) {
      // I paid, friend owes me their share
      impact = friendShare;
    } else {
      // Friend paid, I owe friend my share
      impact = -myShare;
    }

    directBalance += impact;
    netBalance += impact;

    transactions.push({
      id: exp.id,
      type: 'expense',
      description: exp.description,
      amount: exp.amount,
      currency: exp.currency,
      paidBy: payerId,
      payerName: payerIsMe ? 'You' : friendName,
      date: exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt),
      groupId: null,
      balanceImpact: impact,
    });
  });

  // 2. Process Direct Settlements
  directSettlements.forEach((s) => {
    if (s.isDeleted) return;
    const isFromMe = s.fromUserId === currentUserId && s.toUserId === friendId;
    const isFromFriend = s.fromUserId === friendId && s.toUserId === currentUserId;

    if (!isFromMe && !isFromFriend) return;

    // If I paid friend, my debt to friend decreases (positive delta)
    // If friend paid me, friend's debt to me decreases (negative delta)
    const impact = isFromMe ? s.amount : -s.amount;

    directBalance += impact;
    netBalance += impact;

    transactions.push({
      id: s.id,
      type: 'settlement',
      description: isFromMe ? `You paid ${friendName}` : `${friendName} paid you`,
      amount: s.amount,
      currency: s.currency,
      paidBy: s.fromUserId,
      payerName: isFromMe ? 'You' : friendName,
      date: s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt),
      groupId: null,
      balanceImpact: impact,
    });
  });

  // 3. Process Shared Groups
  groups.forEach(({ groupId, groupName, expenses, members, settlements }) => {
    const isMemberFriend = members.some((m) => m.userId === friendId);
    if (!isMemberFriend) return;

    let groupBilateralBalance = 0;

    // Group Expenses
    expenses.forEach((exp) => {
      if (exp.isDeleted) return;

      const payerTags = exp.tags?.filter((t) => t.startsWith('payer:')) || [];
      if (payerTags.length > 0) {
        let myPaid = 0;
        let friendPaid = 0;
        payerTags.forEach((pt) => {
          const parts = pt.split(':');
          if (parts[1] === currentUserId) myPaid = parseFloat(parts[2]) || 0;
          if (parts[1] === friendId) friendPaid = parseFloat(parts[2]) || 0;
        });

        let myShare = 0;
        let friendShare = 0;
        exp.splits.forEach((s) => {
          if (s.userId === currentUserId) myShare = s.amount;
          if (s.userId === friendId) friendShare = s.amount;
        });

        // In bilateral group context, net delta between me and friend
        const impact = myPaid > 0 && friendShare > 0 ? (myPaid / exp.amount) * friendShare : 0;
        const reverseImpact = friendPaid > 0 && myShare > 0 ? (friendPaid / exp.amount) * myShare : 0;
        const netGroupImpact = impact - reverseImpact;

        if (Math.abs(netGroupImpact) > 0.001) {
          groupBilateralBalance += netGroupImpact;
          netBalance += netGroupImpact;
          transactions.push({
            id: exp.id,
            type: 'expense',
            description: exp.description,
            amount: exp.amount,
            paidBy: currentUserId,
            payerName: 'Multiple people',
            date: exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt),
            groupId,
            groupName,
            balanceImpact: netGroupImpact,
          });
        }
        return;
      }

      const payerId = exp.paidBy || exp.createdBy;
      const payerIsMe = payerId === currentUserId;
      const payerIsFriend = payerId === friendId;

      if (!payerIsMe && !payerIsFriend) return;

      let myShare = 0;
      let friendShare = 0;

      exp.splits.forEach((s) => {
        if (s.userId === currentUserId) myShare = s.amount;
        if (s.userId === friendId) friendShare = s.amount;
      });

      let impact = 0;
      if (payerIsMe && friendShare > 0) {
        impact = friendShare;
      } else if (payerIsFriend && myShare > 0) {
        impact = -myShare;
      } else {
        return;
      }

      groupBilateralBalance += impact;
      netBalance += impact;

      transactions.push({
        id: exp.id,
        type: 'expense',
        description: exp.description,
        amount: exp.amount,
        currency: exp.currency,
        paidBy: payerId,
        payerName: payerIsMe ? 'You' : friendName,
        date: exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt),
        groupId,
        groupName,
        balanceImpact: impact,
      });
    });

    // Group Settlements between these two users
    settlements?.forEach((s) => {
      if (s.isDeleted) return;
      const isFromMe = s.fromUserId === currentUserId && s.toUserId === friendId;
      const isFromFriend = s.fromUserId === friendId && s.toUserId === currentUserId;

      if (!isFromMe && !isFromFriend) return;

      const impact = isFromMe ? s.amount : -s.amount;
      groupBilateralBalance += impact;
      netBalance += impact;

      transactions.push({
        id: s.id,
        type: 'settlement',
        description: isFromMe ? `You paid ${friendName}` : `${friendName} paid you`,
        amount: s.amount,
        currency: s.currency,
        paidBy: s.fromUserId,
        payerName: isFromMe ? 'You' : friendName,
        date: s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt),
        groupId,
        groupName,
        balanceImpact: impact,
      });
    });

    groupBalances.push({
      groupId,
      groupName,
      balance: Math.round(groupBilateralBalance * 100) / 100,
    });
  });

  // Sort transactions in descending chronological order
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    netBalance: Math.round(netBalance * 100) / 100,
    directBalance: Math.round(directBalance * 100) / 100,
    groups: groupBalances,
    transactions,
  };
}

/**
 * Compute aggregated friend balances across multiple groups, direct expenses, and explicit friendships.
 */
export function computeFriendBalances(
  groups: Array<{
    groupId: string;
    groupName: string;
    expenses: Expense[];
    members: GroupMember[];
    settlements?: Settlement[];
  }>,
  currentUserId: string,
  explicitFriendships: Array<{
    friendId: string;
    friendName: string;
    friendEmail?: string;
    friendPhotoUrl?: string;
    friendshipId?: string;
  }> = [],
  allDirectExpenses: Expense[] = [],
  allDirectSettlements: Settlement[] = []
): FriendBalance[] {
  // friend uid → { userName, netBalance, groups: Map, directBalance, userEmail, userPhotoUrl, friendshipId }
  const friendMap = new Map<
    string,
    {
      userName: string;
      userEmail?: string;
      userPhotoUrl?: string;
      friendshipId?: string;
      netBalance: number;
      directBalance: number;
      groups: Map<string, { name: string; balance: number }>;
    }
  >();

  // 1. Initialize explicit friends first
  explicitFriendships.forEach((f) => {
    if (f.friendId === currentUserId) return;
    friendMap.set(f.friendId, {
      userName: f.friendName,
      userEmail: f.friendEmail,
      userPhotoUrl: f.friendPhotoUrl,
      friendshipId: f.friendshipId,
      netBalance: 0,
      directBalance: 0,
      groups: new Map(),
    });
  });

  // 2. Add Direct Expenses
  allDirectExpenses.forEach((exp) => {
    if (exp.isDeleted) return;
    const payerId = exp.paidBy || exp.createdBy;
    const payerIsMe = payerId === currentUserId;

    exp.splits.forEach((split) => {
      const otherId = payerIsMe ? split.userId : payerId;
      if (otherId === currentUserId) return;

      const myShare = exp.splits.find((s) => s.userId === currentUserId)?.amount ?? 0;
      const otherShare = split.amount;

      const contribution = payerIsMe ? otherShare : -myShare;

      if (!friendMap.has(otherId)) {
        friendMap.set(otherId, {
          userName: 'Friend',
          netBalance: 0,
          directBalance: 0,
          groups: new Map(),
        });
      }

      const f = friendMap.get(otherId)!;
      f.netBalance += contribution;
      f.directBalance += contribution;
    });
  });

  // 3. Add Direct Settlements
  allDirectSettlements.forEach((s) => {
    if (s.isDeleted) return;
    const isFromMe = s.fromUserId === currentUserId;
    const isToMe = s.toUserId === currentUserId;
    if (!isFromMe && !isToMe) return;

    const otherId = isFromMe ? s.toUserId : s.fromUserId;
    const otherName = isFromMe ? s.toUserName : s.fromUserName;
    const delta = isFromMe ? s.amount : -s.amount;

    if (!friendMap.has(otherId)) {
      friendMap.set(otherId, {
        userName: otherName || 'Friend',
        netBalance: 0,
        directBalance: 0,
        groups: new Map(),
      });
    }

    const f = friendMap.get(otherId)!;
    f.netBalance += delta;
    f.directBalance += delta;
  });

  // 4. Add Group Expenses & Settlements
  groups.forEach(({ groupId, groupName, expenses, members, settlements }) => {
    const memberMap = new Map(members.map((m) => [m.userId, m.userName]));

    expenses.forEach((expense) => {
      if (expense.isDeleted) return;
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
          friendId = split.userId;
          contribution = amount;
        } else if (!payerIsMe && memberIsMe) {
          friendId = payerId;
          contribution = -amount;
        } else {
          return;
        }

        const groupMember = members?.find((m) => m.userId === friendId);
        if (!friendMap.has(friendId)) {
          friendMap.set(friendId, {
            userName: memberMap.get(friendId) ?? 'Unknown',
            userPhotoUrl: groupMember?.imageUrl,
            netBalance: 0,
            directBalance: 0,
            groups: new Map(),
          });
        } else if (groupMember?.imageUrl && !friendMap.get(friendId)!.userPhotoUrl) {
          friendMap.get(friendId)!.userPhotoUrl = groupMember.imageUrl;
        }

        const friend = friendMap.get(friendId)!;
        friend.netBalance += contribution;

        if (!friend.groups.has(groupId)) {
          friend.groups.set(groupId, { name: groupName, balance: 0 });
        }
        friend.groups.get(groupId)!.balance += contribution;
      });
    });

    // Group Settlements
    settlements?.forEach((settlement) => {
      if (settlement.isDeleted) return;
      const isFromMe = settlement.fromUserId === currentUserId;
      const isToMe = settlement.toUserId === currentUserId;
      if (!isFromMe && !isToMe) return;

      const friendId = isFromMe ? settlement.toUserId : settlement.fromUserId;
      const friendName = isFromMe ? settlement.toUserName : settlement.fromUserName;
      const delta = isFromMe ? settlement.amount : -settlement.amount;

      const groupMember = members?.find((m) => m.userId === friendId);
      if (!friendMap.has(friendId)) {
        friendMap.set(friendId, {
          userName: friendName || memberMap.get(friendId) || 'Unknown',
          userPhotoUrl: groupMember?.imageUrl,
          netBalance: 0,
          directBalance: 0,
          groups: new Map(),
        });
      } else if (groupMember?.imageUrl && !friendMap.get(friendId)!.userPhotoUrl) {
        friendMap.get(friendId)!.userPhotoUrl = groupMember.imageUrl;
      }

      const friend = friendMap.get(friendId)!;
      friend.netBalance += delta;

      if (!friend.groups.has(groupId)) {
        friend.groups.set(groupId, { name: groupName, balance: 0 });
      }
      friend.groups.get(groupId)!.balance += delta;
    });
  });

  return Array.from(friendMap.entries()).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    userEmail: data.userEmail,
    userPhotoUrl: data.userPhotoUrl,
    friendshipId: data.friendshipId,
    netBalance: Math.round(data.netBalance * 100) / 100,
    directBalance: Math.round(data.directBalance * 100) / 100,
    groups: Array.from(data.groups.entries()).map(([groupId, g]) => ({
      groupId,
      groupName: g.name,
      balance: Math.round(g.balance * 100) / 100,
    })),
  }));
}
