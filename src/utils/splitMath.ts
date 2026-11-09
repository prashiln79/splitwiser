/**
 * Financial calculation engine using minor currency units (integer cents/paise)
 * to guarantee exact penny reconciliation with zero floating-point arithmetic drift.
 */

export const toCents = (val: number | string | undefined | null): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
};

export const fromCents = (cents: number): number => {
  return Math.round(cents) / 100;
};

export const formatCents = (cents: number, currency: string = '₹'): string => {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toFixed(2);
  return `${isNegative ? '-' : ''}${currency}${formatted}`;
};

/**
 * Distribute total cents equally across N participants.
 * Distributes remainder pennies 1-by-1 to the first remainder participants.
 */
export const distributeCentsEqually = (totalCents: number, count: number): number[] => {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
};

/**
 * Proportional share allocation by integer weights/shares.
 * Any remainder pennies are allocated to active share participants.
 */
export const distributeCentsByShares = (
  totalCents: number,
  participants: { id: string; shares: number }[]
): { id: string; cents: number }[] => {
  const totalShares = participants.reduce((acc, p) => acc + Math.max(0, p.shares), 0);
  if (totalShares <= 0) {
    return participants.map((p) => ({ id: p.id, cents: 0 }));
  }

  let distributed = 0;
  const result = participants.map((p) => {
    if (p.shares <= 0) return { id: p.id, cents: 0 };
    const shareCents = Math.floor((totalCents * p.shares) / totalShares);
    distributed += shareCents;
    return { id: p.id, cents: shareCents };
  });

  let remainder = totalCents - distributed;
  for (let i = 0; i < result.length && remainder > 0; i++) {
    if (participants[i].shares > 0) {
      result[i].cents += 1;
      remainder -= 1;
    }
  }

  return result;
};

/**
 * Proportional allocation by percentage (0 - 100%).
 * Any 1-cent rounding difference is adjusted across active participants.
 */
export const distributeCentsByPercentages = (
  totalCents: number,
  participants: { id: string; pct: number }[]
): { id: string; cents: number }[] => {
  let distributed = 0;
  const result = participants.map((p) => {
    if (p.pct <= 0) return { id: p.id, cents: 0 };
    const shareCents = Math.floor((totalCents * p.pct) / 100);
    distributed += shareCents;
    return { id: p.id, cents: shareCents };
  });

  let remainder = totalCents - distributed;
  for (let i = 0; i < result.length && remainder > 0; i++) {
    if (participants[i].pct > 0) {
      result[i].cents += 1;
      remainder -= 1;
    }
  }

  return result;
};

/**
 * Adjustment split: base equal split + individual +/- adjustments.
 * Requirements: sum of adjustments must equal 0, and no member's final share can be negative.
 */
export const calculateAdjustmentSplits = (
  totalCents: number,
  participantIds: string[],
  adjustmentsInCents: Record<string, number>
): {
  splits: { id: string; cents: number; baseCents: number; adjustmentCents: number }[];
  netAdjustmentCents: number;
  isValid: boolean;
  errorMessage?: string;
} => {
  const count = participantIds.length;
  if (count === 0) {
    return { splits: [], netAdjustmentCents: 0, isValid: false, errorMessage: 'No participants selected.' };
  }

  const baseCentsList = distributeCentsEqually(totalCents, count);
  let netAdjustment = 0;
  let hasNegative = false;

  const splits = participantIds.map((id, index) => {
    const baseCents = baseCentsList[index];
    const adj = adjustmentsInCents[id] || 0;
    netAdjustment += adj;
    const finalCents = baseCents + adj;
    if (finalCents < 0) hasNegative = true;
    return {
      id,
      cents: Math.max(0, finalCents),
      baseCents,
      adjustmentCents: adj,
    };
  });

  if (hasNegative) {
    return {
      splits,
      netAdjustmentCents: netAdjustment,
      isValid: false,
      errorMessage: 'Individual adjusted shares cannot be negative.',
    };
  }

  if (netAdjustment !== 0) {
    return {
      splits,
      netAdjustmentCents: netAdjustment,
      isValid: false,
      errorMessage: `Adjustments must net to 0. Currently off by ${formatCents(Math.abs(netAdjustment))}.`,
    };
  }

  return { splits, netAdjustmentCents: netAdjustment, isValid: true };
};

export interface ItemizedBillItem {
  id: string;
  title: string;
  amountCents: number;
  assignedMemberIds: string[];
}

/**
 * Itemized bill calculation: distributes each line item equally among assigned participants,
 * and distributes tax + tip proportionally based on item subtotals.
 */
export const calculateItemizedSplits = (
  items: ItemizedBillItem[],
  taxCents: number,
  tipCents: number,
  allMemberIds: string[]
): {
  memberTotals: Record<string, { itemCents: number; taxTipCents: number; totalCents: number }>;
  itemsSubtotalCents: number;
  grandTotalCents: number;
  isValid: boolean;
  errorMessage?: string;
} => {
  const memberTotals: Record<string, { itemCents: number; taxTipCents: number; totalCents: number }> = {};
  allMemberIds.forEach((uid) => {
    memberTotals[uid] = { itemCents: 0, taxTipCents: 0, totalCents: 0 };
  });

  let itemsSubtotalCents = 0;

  for (const item of items) {
    itemsSubtotalCents += item.amountCents;
    const assigned = item.assignedMemberIds.filter((uid) => allMemberIds.includes(uid));
    if (assigned.length === 0) continue;

    const distributed = distributeCentsEqually(item.amountCents, assigned.length);
    assigned.forEach((uid, idx) => {
      if (!memberTotals[uid]) {
        memberTotals[uid] = { itemCents: 0, taxTipCents: 0, totalCents: 0 };
      }
      memberTotals[uid].itemCents += distributed[idx];
    });
  }

  const taxTipTotalCents = Math.max(0, taxCents) + Math.max(0, tipCents);
  const grandTotalCents = itemsSubtotalCents + taxTipTotalCents;

  if (taxTipTotalCents > 0 && itemsSubtotalCents > 0) {
    const taxTipParticipants = allMemberIds.map((uid) => ({
      id: uid,
      shares: memberTotals[uid]?.itemCents || 0,
    }));
    const taxTipSplits = distributeCentsByShares(taxTipTotalCents, taxTipParticipants);
    taxTipSplits.forEach((tts) => {
      if (memberTotals[tts.id]) {
        memberTotals[tts.id].taxTipCents = tts.cents;
      }
    });
  }

  allMemberIds.forEach((uid) => {
    const m = memberTotals[uid];
    m.totalCents = m.itemCents + m.taxTipCents;
  });

  const unassignedItems = items.filter((it) => it.assignedMemberIds.length === 0 && it.amountCents > 0);
  if (unassignedItems.length > 0) {
    return {
      memberTotals,
      itemsSubtotalCents,
      grandTotalCents,
      isValid: false,
      errorMessage: `"${unassignedItems[0].title || 'An item'}" has no assigned participants.`,
    };
  }

  return {
    memberTotals,
    itemsSubtotalCents,
    grandTotalCents,
    isValid: true,
  };
};

