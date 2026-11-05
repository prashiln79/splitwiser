import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_NAME = 'splitwiser_offline.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        -- Users Table
        CREATE TABLE IF NOT EXISTS local_users (
          uid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          is_anonymous INTEGER NOT NULL DEFAULT 0,
          photo_url TEXT,
          updated_at INTEGER NOT NULL
        );

        -- Groups Table
        CREATE TABLE IF NOT EXISTS local_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'INR',
          join_code TEXT,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          image_url TEXT,
          banner_url TEXT,
          icon TEXT,
          member_ids_json TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'synced',
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        -- Group Members Table
        CREATE TABLE IF NOT EXISTS local_group_members (
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          joined_at INTEGER NOT NULL,
          image_url TEXT,
          PRIMARY KEY (group_id, user_id)
        );

        -- Expenses Table
        CREATE TABLE IF NOT EXISTS local_expenses (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          paid_by TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          split_type TEXT NOT NULL,
          splits_json TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'INR',
          tags_json TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'synced',
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        -- Settlements Table
        CREATE TABLE IF NOT EXISTS local_settlements (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          from_user_id TEXT NOT NULL,
          to_user_id TEXT NOT NULL,
          from_user_name TEXT NOT NULL,
          to_user_name TEXT NOT NULL,
          amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          note TEXT,
          created_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'synced',
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        -- Friendships Table
        CREATE TABLE IF NOT EXISTS local_friendships (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          friend_id TEXT NOT NULL,
          friend_name TEXT NOT NULL,
          friend_email TEXT,
          friend_photo_url TEXT,
          status TEXT NOT NULL DEFAULT 'accepted',
          initiated_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'synced',
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        -- Durable Synchronization Queue
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at INTEGER,
          error_message TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
        );

        -- Sync Metadata (cursors, last sync times, etc.)
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Indexes for high-performance querying
        CREATE INDEX IF NOT EXISTS idx_expenses_group_created 
          ON local_expenses (group_id, is_deleted, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_expenses_sync_status 
          ON local_expenses (sync_status);

        CREATE INDEX IF NOT EXISTS idx_settlements_group_created 
          ON local_settlements (group_id, is_deleted, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_members_group 
          ON local_group_members (group_id);

        CREATE INDEX IF NOT EXISTS idx_friendships_user 
          ON local_friendships (user_id, is_deleted);

        CREATE INDEX IF NOT EXISTS idx_queue_status_created 
          ON sync_queue (status, created_at ASC);
      `);
      dbInstance = db;
      return db;
    })();
  }
  return initPromise;
}

/**
 * Resets local data for testing or account logout isolation if needed.
 */
export async function clearLocalData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM local_users;
    DELETE FROM local_groups;
    DELETE FROM local_group_members;
    DELETE FROM local_expenses;
    DELETE FROM local_settlements;
    DELETE FROM sync_queue;
    DELETE FROM sync_metadata;
  `);
}

