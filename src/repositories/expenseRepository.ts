import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Expense, ExpenseCreateInput, ExpenseSplit, SplitType, SyncStatus } from '../types';
import { syncQueue } from '../sync/syncQueue';
import { dispatchNotificationEvent } from '../services/notificationService';

export interface LocalExpenseRow {
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
  sync_status: SyncStatus;
  is_deleted: number;
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
    syncStatus: row.sync_status,
    isDeleted: Boolean(row.is_deleted),
  };
}

/**
 * Creates an expense locally immediately with 'pending' status,
 * enqueues it for remote synchronization, and returns it with zero network lag.
 */
export async function createExpenseLocal(
  groupId: string,
  createdBy: string,
  input: ExpenseCreateInput
): Promise<Expense> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const createdAtMs = input.createdAt
    ? (input.createdAt instanceof Date ? input.createdAt.getTime() : Number(input.createdAt))
    : now;

  const expense: Expense = {
    id,
    groupId,
    createdBy,
    paidBy: input.paidBy,
    description: input.description,
    amount: input.amount,
    splits: input.splits,
    splitType: input.splitType,
    currency: 'INR',
    tags: input.tags ?? [],
    createdAt: new Date(createdAtMs),
    updatedAt: new Date(now),
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_expenses (
      id, group_id, created_by, paid_by, description, amount, split_type, splits_json, currency, tags_json, created_at, updated_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [
      id,
      groupId,
      createdBy,
      input.paidBy,
      input.description,
      input.amount,
      input.splitType,
      JSON.stringify(input.splits),
      'INR',
      JSON.stringify(input.tags ?? []),
      createdAtMs,
      now,
    ]
  );

  // Durable queue payload (exclude local-only tags like receipt images from cloud sync)
  const cloudTags = (input.tags ?? []).filter((t: string) => !t.startsWith('receipt:'));
  await syncQueue.enqueue('expense', id, 'CREATE_EXPENSE', {
    id,
    groupId,
    createdBy,
    paidBy: input.paidBy,
    description: input.description,
    amount: input.amount,
    splits: input.splits,
    splitType: input.splitType,
    currency: 'INR',
    tags: cloudTags,
    createdAt: createdAtMs,
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
        expenseId: id,
        targetUserIds,
        params: {
          actorName: input.paidBy || 'A member',
          expenseDescription: input.description,
          amount: String(input.amount),
        },
        dedupeKey: `expense_created_${id}`,
      }).catch((err) => console.warn('[createExpenseLocal] Notification dispatch failed:', err?.message));
    }
  } catch {}

  return expense;
}

/**
 * Updates an expense locally, marks status as pending, and queues it.
 */
export async function updateExpenseLocal(
  groupId: string,
  expenseId: string,
  updates: Partial<ExpenseCreateInput>
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  const existing = await database.getFirstAsync<LocalExpenseRow>(
    `SELECT * FROM local_expenses WHERE id = ?`,
    [expenseId]
  );

  if (!existing) return;

  const currentExpense = rowToExpense(existing);
  const updatedDescription = updates.description ?? currentExpense.description;
  const updatedAmount = updates.amount ?? currentExpense.amount;
  const updatedPaidBy = updates.paidBy ?? currentExpense.paidBy;
  const updatedSplitType = updates.splitType ?? currentExpense.splitType;
  const updatedSplits = updates.splits ?? currentExpense.splits;
  const updatedTags = updates.tags ?? currentExpense.tags;
  const updatedCreatedAt = updates.createdAt
    ? (updates.createdAt instanceof Date ? updates.createdAt.getTime() : Number(updates.createdAt))
    : existing.created_at;

  await database.runAsync(
    `UPDATE local_expenses SET
      description = ?,
      amount = ?,
      paid_by = ?,
      split_type = ?,
      splits_json = ?,
      tags_json = ?,
      created_at = ?,
      updated_at = ?,
      sync_status = 'pending'
    WHERE id = ?`,
    [
      updatedDescription,
      updatedAmount,
      updatedPaidBy,
      updatedSplitType,
      JSON.stringify(updatedSplits),
      JSON.stringify(updatedTags),
      updatedCreatedAt,
      now,
      expenseId,
    ]
  );

  const cloudTags = updatedTags.filter((t: string) => !t.startsWith('receipt:'));
  await syncQueue.enqueue('expense', expenseId, 'UPDATE_EXPENSE', {
    id: expenseId,
    groupId,
    description: updatedDescription,
    amount: updatedAmount,
    paidBy: updatedPaidBy,
    splitType: updatedSplitType,
    splits: updatedSplits,
    tags: cloudTags,
    createdAt: updatedCreatedAt,
    updatedAt: now,
  });

  try {
    const targetUserIds = (updatedSplits ?? [])
      .map((s: any) => s.userId)
      .filter((uid: string) => uid && uid !== existing?.created_by);

    if (targetUserIds.length > 0) {
      dispatchNotificationEvent({
        type: 'expense_updated',
        actor: {
          id: existing?.created_by || 'system',
          name: updatedPaidBy || 'A member',
        },
        groupId,
        expenseId,
        targetUserIds,
        params: {
          actorName: updatedPaidBy || 'A member',
          expenseDescription: updatedDescription,
          amount: String(updatedAmount),
        },
        dedupeKey: `expense_updated_${expenseId}_${now}`,
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Soft deletes an expense locally immediately and enqueues remote deletion.
 */
export async function deleteExpenseLocal(groupId: string, expenseId: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  const existing = await database.getFirstAsync<LocalExpenseRow>(
    `SELECT * FROM local_expenses WHERE id = ?`,
    [expenseId]
  );

  await database.runAsync(
    `UPDATE local_expenses SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`,
    [now, expenseId]
  );

  await syncQueue.enqueue('expense', expenseId, 'DELETE_EXPENSE', {
    id: expenseId,
    groupId,
  });

  try {
    if (existing) {
      let splits: ExpenseSplit[] = [];
      try {
        splits = JSON.parse(existing.splits_json);
      } catch {}
      const targetUserIds = splits
        .map((s) => s.userId)
        .filter((uid) => uid && uid !== existing.created_by);

      if (targetUserIds.length > 0) {
        dispatchNotificationEvent({
          type: 'expense_deleted',
          actor: {
            id: existing.created_by,
            name: existing.paid_by || 'A member',
          },
          groupId,
          expenseId,
          targetUserIds,
          params: {
            actorName: existing.paid_by || 'A member',
            expenseDescription: existing.description,
          },
          dedupeKey: `expense_deleted_${expenseId}_${now}`,
        }).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Reads all active expenses for a group from SQLite.
 */
export async function getGroupExpensesLocal(groupId: string): Promise<Expense[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalExpenseRow>(
    `SELECT * FROM local_expenses 
     WHERE group_id = ? AND is_deleted = 0 
     ORDER BY created_at DESC`,
    [groupId]
  );

  return rows.map(rowToExpense);
}

/**
 * Merges remote snapshot expenses into SQLite while preserving local pending edits.
 */
export async function upsertRemoteExpenses(groupId: string, remoteExpenses: Expense[]): Promise<void> {
  const database = await getDatabase();
  const remoteIds = new Set(remoteExpenses.map((e) => e.id));

  // 1. Get all local records for this group
  const localRows = await database.getAllAsync<LocalExpenseRow>(
    `SELECT * FROM local_expenses WHERE group_id = ?`,
    [groupId]
  );

  const localMap = new Map<string, LocalExpenseRow>();
  for (const row of localRows) {
    localMap.set(row.id, row);
  }

  // 2. Upsert remote records
  for (const remote of remoteExpenses) {
    const local = localMap.get(remote.id);

    // If local has pending changes, DO NOT overwrite with remote
    if (local && local.sync_status === 'pending') {
      continue;
    }

    const createdAtMs = remote.createdAt.getTime();
    const updatedAtMs = remote.updatedAt ? remote.updatedAt.getTime() : createdAtMs;

    // Preserve local-only receipt tag if already present locally
    let mergedTags = remote.tags || [];
    if (local && local.tags_json) {
      try {
        const localTags: string[] = JSON.parse(local.tags_json);
        const localReceiptTag = localTags.find((t: string) => t.startsWith('receipt:'));
        if (localReceiptTag && !mergedTags.some((t: string) => t.startsWith('receipt:'))) {
          mergedTags = [...mergedTags, localReceiptTag];
        }
      } catch {}
    }

    await database.runAsync(
      `INSERT INTO local_expenses (
        id, group_id, created_by, paid_by, description, amount, split_type, splits_json, currency, tags_json, created_at, updated_at, sync_status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
      ON CONFLICT(id) DO UPDATE SET
        description = excluded.description,
        amount = excluded.amount,
        paid_by = excluded.paid_by,
        split_type = excluded.split_type,
        splits_json = excluded.splits_json,
        currency = excluded.currency,
        tags_json = excluded.tags_json,
        updated_at = excluded.updated_at,
        sync_status = 'synced',
        is_deleted = 0
      WHERE local_expenses.sync_status != 'pending'`,
      [
        remote.id,
        groupId,
        remote.createdBy,
        remote.paidBy,
        remote.description,
        remote.amount,
        remote.splitType,
        JSON.stringify(remote.splits),
        remote.currency || 'INR',
        JSON.stringify(mergedTags),
        createdAtMs,
        updatedAtMs,
      ]
    );
  }

  // 3. Mark locally deleted any records that no longer exist remotely, unless they are locally pending create
  for (const local of localRows) {
    if (!remoteIds.has(local.id) && local.sync_status === 'synced' && local.is_deleted === 0) {
      await database.runAsync(
        `UPDATE local_expenses SET is_deleted = 1 WHERE id = ?`,
        [local.id]
      );
    }
  }
}

/**
 * Returns all active expenses across all groups the user participates in.
 */
export async function getAllUserExpensesLocal(
  uid: string
): Promise<(Expense & { groupName?: string })[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalExpenseRow & { group_name?: string }>(
    `SELECT e.*, g.name AS group_name 
     FROM local_expenses e
     LEFT JOIN local_groups g ON e.group_id = g.id
     WHERE e.is_deleted = 0 
     ORDER BY e.created_at DESC`
  );

  return rows
    .map((r) => ({
      ...rowToExpense(r),
      groupName: r.group_name || 'Group',
    }))
    .filter((e) => {
      // User is either creator, payer, or in the splits
      if (e.createdBy === uid || e.paidBy === uid) return true;
      return e.splits.some((s) => s.userId === uid);
    });
}

