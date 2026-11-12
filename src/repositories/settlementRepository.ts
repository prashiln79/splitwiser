import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Settlement, SettlementStatus, SyncStatus } from '../types';
import { syncQueue } from '../sync/syncQueue';
import { dispatchNotificationEvent } from '../services/notificationService';
import { formatCurrency } from '../utils/currency';

export interface LocalSettlementRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_name: string;
  to_user_name: string;
  amount: number;
  status: SettlementStatus;
  note: string | null;
  created_at: number;
  sync_status: SyncStatus;
  is_deleted: number;
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
    syncStatus: row.sync_status,
    isDeleted: Boolean(row.is_deleted),
  };
}

/**
 * Records a settlement locally with 'pending' status, enqueues it,
 * and returns immediately without network lag.
 */
export async function recordSettlementLocal(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  toUserName: string,
  amount: number,
  note?: string
): Promise<Settlement> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();

  const settlement: Settlement = {
    id,
    groupId,
    fromUserId,
    toUserId,
    fromUserName,
    toUserName,
    amount,
    status: 'completed',
    createdAt: new Date(now),
    note,
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_settlements (
      id, group_id, from_user_id, to_user_id, from_user_name, to_user_name, amount, status, note, created_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'pending', 0)`,
    [
      id,
      groupId,
      fromUserId,
      toUserId,
      fromUserName,
      toUserName,
      amount,
      note ?? null,
      now,
    ]
  );

  await syncQueue.enqueue('settlement', id, 'RECORD_SETTLEMENT', {
    id,
    groupId,
    fromUserId,
    toUserId,
    fromUserName,
    toUserName,
    amount,
    status: 'completed',
    note: note ?? null,
    createdAt: now,
  });

  // Dispatch in-app notification to payee
  try {
    if (toUserId && toUserId !== fromUserId) {
      let groupCurrency = 'INR';
      try {
        const groupRow = await database.getFirstAsync<{ currency: string }>(
          `SELECT currency FROM local_groups WHERE id = ?`,
          [groupId]
        );
        if (groupRow?.currency) groupCurrency = groupRow.currency;
      } catch {}

      const numAmount = Number(amount) || 0;
      const formattedAmount = formatCurrency(numAmount, groupCurrency);

      dispatchNotificationEvent({
        type: 'settlement_created',
        actor: {
          id: fromUserId,
          name: fromUserName,
        },
        groupId,
        settlementId: id,
        targetUserIds: [toUserId],
        params: {
          actorName: fromUserName,
          amount: String(amount),
          amountFormatted: formattedAmount,
          currency: groupCurrency,
        },
        dedupeKey: `settlement_created_${id}`,
      }).catch((err) => console.warn('[recordSettlementLocal] Notification failed:', err?.message));
    }
  } catch {}

  return settlement;
}

/**
 * Reads all active settlements for a group from SQLite.
 */
export async function getGroupSettlementsLocal(groupId: string): Promise<Settlement[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalSettlementRow>(
    `SELECT * FROM local_settlements 
     WHERE group_id = ? AND is_deleted = 0 
     ORDER BY created_at DESC`,
    [groupId]
  );

  return rows.map(rowToSettlement);
}

/**
 * Merges remote settlements into SQLite while preserving pending local records.
 */
export async function upsertRemoteSettlements(
  groupId: string,
  remoteSettlements: Settlement[]
): Promise<void> {
  const database = await getDatabase();

  const localRows = await database.getAllAsync<LocalSettlementRow>(
    `SELECT * FROM local_settlements WHERE group_id = ?`,
    [groupId]
  );

  const localMap = new Map<string, LocalSettlementRow>();
  for (const row of localRows) {
    localMap.set(row.id, row);
  }

  for (const remote of remoteSettlements) {
    const local = localMap.get(remote.id);
    if (local && local.sync_status === 'pending') {
      continue;
    }

    const createdAtMs = remote.createdAt.getTime();

    await database.runAsync(
      `INSERT INTO local_settlements (
        id, group_id, from_user_id, to_user_id, from_user_name, to_user_name, amount, status, note, created_at, sync_status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount,
        status = excluded.status,
        note = excluded.note,
        sync_status = 'synced',
        is_deleted = 0
      WHERE local_settlements.sync_status != 'pending'`,
      [
        remote.id,
        groupId,
        remote.fromUserId,
        remote.toUserId,
        remote.fromUserName,
        remote.toUserName,
        remote.amount,
        remote.status,
        remote.note ?? null,
        createdAtMs,
      ]
    );
  }
}

