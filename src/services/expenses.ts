import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Expense, ExpenseCreateInput } from '../types';
import { dispatchNotificationEvent } from './notificationService';

// ─── Path helpers ─────────────────────────────────────────────────────────────
// /splitwiser/data/groups/{groupId}/expenses/{expenseId}
const expensesCol = (groupId: string) =>
  collection(db, 'splitwiser', 'data', 'groups', groupId, 'expenses');
const expenseDoc = (groupId: string, expenseId: string) =>
  doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', expenseId);

function mapExpense(id: string, data: Record<string, any>): Expense {
  return {
    id,
    groupId: data.groupId,
    createdBy: data.createdBy,
    paidBy: data.paidBy,
    description: data.description,
    amount: data.amount,
    splits: data.splits ?? [],
    splitType: data.splitType ?? 'equal',
    currency: data.currency ?? 'INR',
    tags: data.tags ?? [],
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

export async function createExpense(
  groupId: string,
  createdBy: string,
  input: ExpenseCreateInput
): Promise<Expense> {
  const now = serverTimestamp();
  const createdAtTimestamp = input.createdAt
    ? (input.createdAt instanceof Date ? input.createdAt : new Date(Number(input.createdAt)))
    : null;
  const cleanTags = (input.tags ?? []).filter((t: string) => !t.startsWith('receipt:'));
  const ref = await addDoc(expensesCol(groupId), {
    groupId,
    createdBy,
    paidBy: input.paidBy,
    description: input.description,
    amount: input.amount,
    splits: input.splits,
    splitType: input.splitType,
    currency: 'INR',
    tags: cleanTags,
    createdAt: createdAtTimestamp ?? now,
    updatedAt: now,
  });

  // Dispatch in-app notification to group members involved (excluding creator)
  try {
    const targetUserIds = (input.splits ?? [])
      .map((s) => s.userId)
      .filter((uid) => uid && uid !== createdBy);

    if (targetUserIds.length > 0) {
      dispatchNotificationEvent({
        type: 'expense_created',
        actor: {
          id: createdBy,
          name: input.paidBy || 'A member',
        },
        groupId,
        expenseId: ref.id,
        targetUserIds,
        params: {
          actorName: input.paidBy || 'A member',
          expenseDescription: input.description,
          amount: String(input.amount),
        },
        dedupeKey: `expense_created_${ref.id}`,
      }).catch((err) => console.warn('[createExpense] Notification dispatch failed:', err?.message));
    }
  } catch (e: any) {
    // Non-blocking notification dispatch
  }

  return {
    id: ref.id,
    groupId,
    createdBy,
    paidBy: input.paidBy,
    description: input.description,
    amount: input.amount,
    splits: input.splits,
    splitType: input.splitType,
    currency: 'INR',
    tags: input.tags ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
  const q = query(expensesCol(groupId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapExpense(d.id, d.data()));
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await deleteDoc(expenseDoc(groupId, expenseId));
}

export function subscribeToExpenses(
  groupId: string,
  callback: (expenses: Expense[]) => void
): Unsubscribe {
  const q = query(expensesCol(groupId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapExpense(d.id, d.data())));
  });
}
