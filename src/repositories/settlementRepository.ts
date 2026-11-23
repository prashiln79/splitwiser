import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Settlement, SettlementStatus, SyncStatus } from '../types';
import { syncQueue } from '../sync/syncQueue';
import { dispatchNotificationEvent } from '../services/notificationService';
import { formatCurrency, normalizeCurrencyCode } from '../utils/currency';

export interface LocalSettlementRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_name: string;
  to_user_name: string;
  amount: number;
  currency?: string | null;
  status: SettlementStatus;
  note: string | null;
  created_at: number;
  updated_at: number;
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
    currency: row.currency ? normalizeCurrencyCode(row.currency) : 'INR',
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
  currency: string = 'INR',
  note?: string
): Promise<Settlement> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const normCurrency = normalizeCurrencyCode(currency);

  const settlement: Settlement = {
    id,
    groupId,
    fromUserId,
    toUserId,
    fromUserName,
    toUserName,
    amount,
    currency: normCurrency,
    status: 'completed',
    createdAt: new Date(now),
    note,
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_settlements (
      id, group_id, from_user_id, to_user_id, from_user_name, to_user_name, amount, currency, status, note, created_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'pending', 0)`,
    [
      id,
      groupId,
      fromUserId,
      toUserId,
      fromUserName,
      toUserName,
      amount,
      normCurrency,
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
    currency: normCurrency,
    status: 'completed',
    note: note ?? null,
    createdAt: now,
  });

  // Dispatch in-app notification to payee
  try {
    if (toUserId && toUserId !== fromUserId) {
      const numAmount = Number(amount) || 0;
      const formattedAmount = formatCurrency(numAmount, normCurrency);

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
          currency: normCurrency,
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
  const remoteIds = new Set(remoteSettlements.map((s) => s.id));

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
    const remoteCurrency = remote.currency ? normalizeCurrencyCode(remote.currency) : 'INR';

    // Content-change check: skip SQLite write if all values are already identical
    if (
      local &&
      local.sync_status === 'synced' &&
      local.is_deleted === 0 &&
      local.amount === remote.amount &&
      local.currency === remoteCurrency &&
      local.status === remote.status &&
      (local.note ?? null) === (remote.note ?? null) &&
      local.from_user_id === remote.fromUserId &&
      local.to_user_id === remote.toUserId
    ) {
      continue;
    }

    await database.runAsync(
      `INSERT INTO local_settlements (
        id, group_id, from_user_id, to_user_id, from_user_name, to_user_name, amount, currency, status, note, created_at, updated_at, sync_status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount,
        currency = excluded.currency,
        status = excluded.status,
        note = excluded.note,
        updated_at = excluded.updated_at,
        sync_status = 'synced',
        is_deleted = 0
      WHERE local_settlements.sync_status != 'pending'
        AND local_settlements.updated_at <= excluded.updated_at`,
      [
        remote.id,
        groupId,
        remote.fromUserId,
        remote.toUserId,
        remote.fromUserName,
        remote.toUserName,
        remote.amount,
        remoteCurrency,
        remote.status,
        remote.note ?? null,
        createdAtMs,
        createdAtMs,
      ]
    );
  }

  // Soft-delete local settlements absent from the remote snapshot (deletion propagation)
  for (const local of localRows) {
    if (!remoteIds.has(local.id) && local.sync_status === 'synced' && local.is_deleted === 0) {
      await database.runAsync(
        `UPDATE local_settlements SET is_deleted = 1 WHERE id = ?`,
        [local.id]
      );
    }
  }
}
