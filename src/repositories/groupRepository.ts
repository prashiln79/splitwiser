import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Group, GroupMember, MemberRole, GroupCoverPhoto } from '../types';
import { syncQueue } from '../sync/syncQueue';

export interface LocalGroupRow {
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

export interface LocalMemberRow {
  group_id: string;
  user_id: string;
  user_name: string;
  role: MemberRole;
  joined_at: number;
  image_url: string | null;
}

function rowToGroup(row: LocalGroupRow): Group {
  let memberIds: string[] = [];
  try {
    memberIds = JSON.parse(row.member_ids_json);
  } catch {
    memberIds = [];
  }

  let coverPhoto = undefined;
  if (row.banner_url) {
    if (row.banner_url.startsWith('{')) {
      try {
        coverPhoto = JSON.parse(row.banner_url);
      } catch {
        coverPhoto = { type: 'preset' as const, imageUrl: row.banner_url };
      }
    } else {
      coverPhoto = { type: 'preset' as const, imageUrl: row.banner_url };
    }
  }

  return {
    id: row.id,
    name: row.name,
    currency: row.currency || 'INR',
    joinCode: row.join_code ?? '',
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    imageUrl: row.image_url ?? undefined,
    bannerUrl: coverPhoto?.imageUrl || row.banner_url || undefined,
    coverPhoto,
    icon: row.icon ?? undefined,
    memberIds,
    updatedAt: new Date(row.updated_at),
    syncStatus: row.sync_status as any,
    isDeleted: Boolean(row.is_deleted),
  };
}

function rowToMember(row: LocalMemberRow): GroupMember {
  return {
    userId: row.user_id,
    userName: row.user_name,
    role: row.role,
    joinedAt: new Date(row.joined_at),
    imageUrl: row.image_url ?? undefined,
  };
}

/**
 * Returns groups for a user from local SQLite.
 */
export async function getLocalGroups(userId: string): Promise<Group[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalGroupRow>(
    `SELECT * FROM local_groups 
     WHERE is_deleted = 0 
     ORDER BY updated_at DESC`
  );

  return rows
    .map(rowToGroup)
    .filter((g) => g.memberIds.includes(userId));
}

/**
 * Returns a specific group by ID from local SQLite.
 */
export async function getLocalGroupById(groupId: string): Promise<Group | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<LocalGroupRow>(
    `SELECT * FROM local_groups WHERE id = ? AND is_deleted = 0`,
    [groupId]
  );
  return row ? rowToGroup(row) : null;
}

/**
 * Returns members of a group from local SQLite.
 */
export async function getLocalGroupMembers(groupId: string): Promise<GroupMember[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalMemberRow>(
    `SELECT * FROM local_group_members WHERE group_id = ? ORDER BY joined_at ASC`,
    [groupId]
  );
  return rows.map(rowToMember);
}

/**
 * Creates a group locally and enqueues sync.
 */
export async function createGroupLocal(
  name: string,
  creatorUid: string,
  creatorName: string,
  currency = 'INR',
  imageUrl?: string,
  icon?: string,
  coverPhoto?: GroupCoverPhoto
): Promise<Group> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = Date.now();

  const group: Group = {
    id,
    name: name.trim(),
    currency,
    joinCode,
    createdBy: creatorUid,
    createdAt: new Date(now),
    imageUrl: imageUrl || undefined,
    bannerUrl: coverPhoto?.imageUrl || undefined,
    coverPhoto,
    icon: icon || undefined,
    memberIds: [creatorUid],
    updatedAt: new Date(now),
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_groups (
      id, name, currency, join_code, created_by, created_at, image_url, banner_url, icon, member_ids_json, updated_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [
      id,
      name.trim(),
      currency,
      joinCode,
      creatorUid,
      now,
      imageUrl ?? null,
      coverPhoto?.imageUrl ?? null,
      icon ?? null,
      JSON.stringify([creatorUid]),
      now,
    ]
  );

  await database.runAsync(
    `INSERT INTO local_group_members (
      group_id, user_id, user_name, role, joined_at
    ) VALUES (?, ?, ?, 'admin', ?)`,
    [id, creatorUid, creatorName, now]
  );

  await syncQueue.enqueue('group', id, 'CREATE_GROUP', {
    id,
    name: name.trim(),
    currency,
    joinCode,
    createdBy: creatorUid,
    creatorName,
    imageUrl: imageUrl || null,
    icon: icon || null,
    memberIds: [creatorUid],
    createdAt: now,
  });

  return group;
}

/**
 * Updates a group locally in SQLite immediately.
 */
export async function updateGroupLocal(
  groupId: string,
  updates: Partial<Group>
): Promise<void> {
  const database = await getDatabase();
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.currency !== undefined) {
    fields.push('currency = ?');
    params.push(updates.currency);
  }
  if (updates.imageUrl !== undefined) {
    fields.push('image_url = ?');
    params.push(updates.imageUrl);
  }
  if (updates.coverPhoto !== undefined) {
    fields.push('banner_url = ?');
    params.push(updates.coverPhoto?.imageUrl || null);
  } else if (updates.bannerUrl !== undefined) {
    fields.push('banner_url = ?');
    params.push(updates.bannerUrl);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    params.push(updates.icon);
  }
  if (updates.isDeleted !== undefined) {
    fields.push('is_deleted = ?');
    params.push(updates.isDeleted ? 1 : 0);
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(groupId);

    await database.runAsync(
      `UPDATE local_groups SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }
}

/**
 * Deletes a group locally immediately (soft delete) and cascades deletion to local expenses.
 * Enqueues a DELETE_GROUP operation for background/online synchronization.
 */
export async function deleteGroupLocal(groupId: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  // 1. Mark group as deleted in local SQLite immediately
  await database.runAsync(
    `UPDATE local_groups SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`,
    [now, groupId]
  );

  // 2. Mark its local expenses as deleted
  await database.runAsync(
    `UPDATE local_expenses SET is_deleted = 1, updated_at = ? WHERE group_id = ?`,
    [now, groupId]
  );

  // 3. Mark its local settlements as cleaned
  await database.runAsync(
    `DELETE FROM local_settlements WHERE group_id = ?`,
    [groupId]
  );

  // 4. Remove cached members
  await database.runAsync(
    `DELETE FROM local_group_members WHERE group_id = ?`,
    [groupId]
  );

  // 5. Enqueue remote deletion
  await syncQueue.enqueue('group', groupId, 'DELETE_GROUP', {
    groupId,
  });
}

/**
 * Removes a member from a group locally.
 */
export async function removeMemberLocal(groupId: string, memberUid: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  const row = await database.getFirstAsync<LocalGroupRow>(
    `SELECT * FROM local_groups WHERE id = ?`,
    [groupId]
  );
  if (row) {
    const memberIds: string[] = JSON.parse(row.member_ids_json || '[]');
    const updatedMemberIds = memberIds.filter((id) => id !== memberUid);
    await database.runAsync(
      `UPDATE local_groups SET member_ids_json = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(updatedMemberIds), now, groupId]
    );
  }

  await database.runAsync(
    `DELETE FROM local_group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, memberUid]
  );
}

/**
 * Leaves a group locally.
 */
export async function leaveGroupLocal(groupId: string, uid: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  // 1. Soft-delete the group locally so it no longer appears in local_groups for this user
  await database.runAsync(
    `UPDATE local_groups 
     SET is_deleted = 1, updated_at = ? 
     WHERE id = ?`,
    [now, groupId]
  );

  // 2. Remove member from local_groups member_ids_json and local_group_members
  await removeMemberLocal(groupId, uid);

  // 3. Clean up cached local expenses & settlements for this group
  await database.runAsync(
    `DELETE FROM local_expenses WHERE group_id = ?`,
    [groupId]
  );
  await database.runAsync(
    `DELETE FROM local_settlements WHERE group_id = ?`,
    [groupId]
  );
}

/**
 * Saves remote groups into SQLite cache.
 */
export async function upsertRemoteGroups(remoteGroups: Group[], userId?: string): Promise<void> {
  const database = await getDatabase();

  for (const group of remoteGroups) {
    const createdAtMs = group.createdAt.getTime();
    const updatedAtMs = group.updatedAt ? group.updatedAt.getTime() : createdAtMs;

    await database.runAsync(
      `INSERT INTO local_groups (
        id, name, currency, join_code, created_by, created_at, image_url, banner_url, icon, member_ids_json, updated_at, sync_status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        currency = excluded.currency,
        join_code = excluded.join_code,
        image_url = excluded.image_url,
        banner_url = excluded.banner_url,
        icon = excluded.icon,
        member_ids_json = excluded.member_ids_json,
        updated_at = excluded.updated_at,
        sync_status = 'synced',
        is_deleted = 0
      WHERE local_groups.sync_status != 'pending'`,
      [
        group.id,
        group.name,
        group.currency || 'INR',
        group.joinCode,
        group.createdBy,
        createdAtMs,
        group.imageUrl ?? null,
        group.bannerUrl ?? null,
        group.icon ?? null,
        JSON.stringify(group.memberIds || []),
        updatedAtMs,
      ]
    );
  }

  // If userId is provided, soft-delete any local synced groups that no longer exist on remote
  if (userId) {
    const remoteIds = remoteGroups.map((g) => g.id);
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => '?').join(',');
      await database.runAsync(
        `UPDATE local_groups 
         SET is_deleted = 1, updated_at = ? 
         WHERE sync_status = 'synced' 
           AND (member_ids_json LIKE ? OR created_by = ?)
           AND id NOT IN (${placeholders})`,
        [Date.now(), `%"${userId}"%`, userId, ...remoteIds]
      );
    } else {
      await database.runAsync(
        `UPDATE local_groups 
         SET is_deleted = 1, updated_at = ? 
         WHERE sync_status = 'synced' 
           AND (member_ids_json LIKE ? OR created_by = ?)`,
        [Date.now(), `%"${userId}"%`, userId]
      );
    }
  }
}

/**
 * Updates a user's name and image across all local group memberships in SQLite.
 */
export async function updateLocalMemberProfile(
  userId: string,
  newName?: string,
  newImageUrl?: string
): Promise<void> {
  const database = await getDatabase();
  if (newName && newImageUrl !== undefined) {
    await database.runAsync(
      `UPDATE local_group_members SET user_name = ?, image_url = ? WHERE user_id = ?`,
      [newName, newImageUrl, userId]
    );
  } else if (newName) {
    await database.runAsync(
      `UPDATE local_group_members SET user_name = ? WHERE user_id = ?`,
      [newName, userId]
    );
  } else if (newImageUrl !== undefined) {
    await database.runAsync(
      `UPDATE local_group_members SET image_url = ? WHERE user_id = ?`,
      [newImageUrl, userId]
    );
  }
}

/**
 * Saves remote group members into SQLite cache.
 */
export async function upsertRemoteMembers(groupId: string, members: GroupMember[]): Promise<void> {
  const database = await getDatabase();

  for (const member of members) {
    const joinedAtMs = member.joinedAt ? member.joinedAt.getTime() : Date.now();

    await database.runAsync(
      `INSERT INTO local_group_members (
        group_id, user_id, user_name, role, joined_at, image_url
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_id, user_id) DO UPDATE SET
        user_name = excluded.user_name,
        role = excluded.role,
        image_url = excluded.image_url`,
      [
        groupId,
        member.userId,
        member.userName,
        member.role || 'member',
        joinedAtMs,
        member.imageUrl ?? null,
      ]
    );
  }
}

