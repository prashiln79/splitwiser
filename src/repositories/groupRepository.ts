import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { Group, GroupMember, MemberRole } from '../types';
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

  return {
    id: row.id,
    name: row.name,
    currency: row.currency || 'INR',
    joinCode: row.join_code ?? '',
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    imageUrl: row.image_url ?? undefined,
    bannerUrl: row.banner_url ?? undefined,
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
    .filter((g) => g.memberIds.includes(userId) || g.createdBy === userId);
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
  icon?: string
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
    icon: icon || undefined,
    memberIds: [creatorUid],
    updatedAt: new Date(now),
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_groups (
      id, name, currency, join_code, created_by, created_at, image_url, icon, member_ids_json, updated_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [
      id,
      name.trim(),
      currency,
      joinCode,
      creatorUid,
      now,
      imageUrl ?? null,
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
  updates: Partial<Pick<Group, 'name' | 'imageUrl' | 'bannerUrl' | 'icon'>>
): Promise<void> {
  const database = await getDatabase();
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.imageUrl !== undefined) {
    fields.push('image_url = ?');
    params.push(updates.imageUrl);
  }
  if (updates.bannerUrl !== undefined) {
    fields.push('banner_url = ?');
    params.push(updates.bannerUrl);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    params.push(updates.icon);
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
 * Saves remote groups into SQLite cache.
 */
export async function upsertRemoteGroups(remoteGroups: Group[]): Promise<void> {
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

