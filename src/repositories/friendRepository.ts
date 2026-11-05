import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Friendship, FriendshipStatus, Expense, Settlement, SyncStatus } from '../types';
import { syncQueue } from '../sync/syncQueue';

export interface LocalFriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  friend_name: string;
  friend_email: string | null;
  friend_photo_url: string | null;
  status: FriendshipStatus;
  initiated_by: string;
  created_at: number;
  updated_at: number;
  sync_status: SyncStatus;
  is_deleted: number;
}

export function getDirectGroupId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `direct_${sorted[0]}_${sorted[1]}`;
}

function rowToFriendship(row: LocalFriendshipRow): Friendship {
  return {
    id: row.id,
    userId: row.user_id,
    friendId: row.friend_id,
    friendName: row.friend_name,
    friendEmail: row.friend_email ?? undefined,
    friendPhotoUrl: row.friend_photo_url ?? undefined,
    status: row.status,
    initiatedBy: row.initiated_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status,
  };
}

/**
 * Returns all active friendships for the current user from SQLite.
 */
export async function getLocalFriendships(userId: string): Promise<Friendship[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalFriendshipRow>(
    `SELECT * FROM local_friendships 
     WHERE user_id = ? AND is_deleted = 0 
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(rowToFriendship);
}

/**
 * Creates or adds a friend locally immediately with 'pending' sync status.
 */
export async function createLocalFriendship(
  userId: string,
  friendId: string,
  friendName: string,
  friendEmail?: string,
  friendPhotoUrl?: string
): Promise<Friendship> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();

  const friendship: Friendship = {
    id,
    userId,
    friendId,
    friendName: friendName.trim(),
    friendEmail: friendEmail?.trim() || undefined,
    friendPhotoUrl: friendPhotoUrl || undefined,
    status: 'accepted',
    initiatedBy: userId,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    syncStatus: 'pending',
  };

  await database.runAsync(
    `INSERT INTO local_friendships (
      id, user_id, friend_id, friend_name, friend_email, friend_photo_url, status, initiated_by, created_at, updated_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    ON CONFLICT(id) DO UPDATE SET
      friend_name = excluded.friend_name,
      friend_email = excluded.friend_email,
      friend_photo_url = excluded.friend_photo_url,
      status = excluded.status,
      updated_at = excluded.updated_at,
      sync_status = 'pending',
      is_deleted = 0`,
    [
      id,
      userId,
      friendId,
      friendship.friendName,
      friendship.friendEmail ?? null,
      friendship.friendPhotoUrl ?? null,
      friendship.status,
      userId,
      now,
      now,
    ]
  );

  // Enqueue background remote synchronization
  await syncQueue.enqueue('friendship', id, 'CREATE_FRIENDSHIP', {
    id,
    userId,
    friendId,
    friendName: friendship.friendName,
    friendEmail: friendship.friendEmail || null,
    friendPhotoUrl: friendship.friendPhotoUrl || null,
    status: friendship.status,
    initiatedBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return friendship;
}

/**
 * Soft deletes a friendship locally and enqueues remote deletion.
 * Note: Historical transactions and group memberships remain preserved.
 */
export async function deleteLocalFriendship(id: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  await database.runAsync(
    `UPDATE local_friendships SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`,
    [now, id]
  );

  await syncQueue.enqueue('friendship', id, 'DELETE_FRIENDSHIP', { id });
}

/**
 * Reads all direct expenses between two users from SQLite.
 */
export async function getDirectExpensesLocal(uid1: string, uid2: string): Promise<Expense[]> {
  const database = await getDatabase();
  const directGid = getDirectGroupId(uid1, uid2);

  const rows = await database.getAllAsync<any>(
    `SELECT * FROM local_expenses 
     WHERE is_deleted = 0 AND group_id = ?
     ORDER BY created_at DESC`,
    [directGid]
  );

  return rows.map((row: any) => ({
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    paidBy: row.paid_by,
    description: row.description,
    amount: row.amount,
    splits: JSON.parse(row.splits_json || '[]'),
    splitType: row.split_type,
    currency: row.currency || 'INR',
    tags: JSON.parse(row.tags_json || '[]'),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status,
    isDeleted: Boolean(row.is_deleted),
  }));
}

/**
 * Reads all direct settlements between two users from SQLite.
 */
export async function getDirectSettlementsLocal(uid1: string, uid2: string): Promise<Settlement[]> {
  const database = await getDatabase();
  const directGid = getDirectGroupId(uid1, uid2);

  const rows = await database.getAllAsync<any>(
    `SELECT * FROM local_settlements 
     WHERE is_deleted = 0 
       AND (group_id = ? OR ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)))
     ORDER BY created_at DESC`,
    [directGid, uid1, uid2, uid2, uid1]
  );

  return rows.map((row: any) => ({
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
  }));
}

/**
 * Upserts remote friendships into SQLite cache without clobbering pending local edits.
 */
export async function upsertRemoteFriendships(friendships: Friendship[]): Promise<void> {
  const database = await getDatabase();

  for (const f of friendships) {
    const existing = await database.getFirstAsync<LocalFriendshipRow>(
      `SELECT * FROM local_friendships WHERE id = ?`,
      [f.id]
    );

    if (existing && existing.sync_status === 'pending') {
      continue;
    }

    const createdMs = f.createdAt.getTime();
    const updatedMs = f.updatedAt ? f.updatedAt.getTime() : createdMs;

    await database.runAsync(
      `INSERT INTO local_friendships (
        id, user_id, friend_id, friend_name, friend_email, friend_photo_url, status, initiated_by, created_at, updated_at, sync_status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
      ON CONFLICT(id) DO UPDATE SET
        friend_name = excluded.friend_name,
        friend_email = excluded.friend_email,
        friend_photo_url = excluded.friend_photo_url,
        status = excluded.status,
        updated_at = excluded.updated_at,
        sync_status = 'synced',
        is_deleted = 0`,
      [
        f.id,
        f.userId,
        f.friendId,
        f.friendName,
        f.friendEmail ?? null,
        f.friendPhotoUrl ?? null,
        f.status,
        f.initiatedBy,
        createdMs,
        updatedMs,
      ]
    );
  }
}

