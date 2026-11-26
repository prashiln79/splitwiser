import { AppState, AppStateStatus } from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getDatabase } from '../db/sqlite';
import { networkMonitor } from './networkMonitor';
import { syncQueue } from './syncQueue';
import { upsertRemoteExpenses } from '../repositories/expenseRepository';
import { upsertRemoteSettlements } from '../repositories/settlementRepository';
import { upsertRemoteGroups, upsertRemoteMembers } from '../repositories/groupRepository';
import { Expense, Settlement, Group, GroupMember } from '../types';

// Overlap window in ms to avoid missing records at cursor boundary
const SYNC_OVERLAP_MS = 5 * 60 * 1000; // 5 minutes

function mapFirestoreDocToGroup(id: string, data: Record<string, any>): Group {
  const coverPhoto =
    data.coverPhoto ||
    (data.bannerUrl ? { type: 'preset', imageUrl: data.bannerUrl } : undefined);
  return {
    id,
    name: data.name,
    currency: data.currency ?? 'INR',
    joinCode: data.joinCode ?? '',
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    imageUrl: data.imageUrl,
    bannerUrl: coverPhoto?.imageUrl || data.bannerUrl,
    coverPhoto,
    icon: data.icon,
    memberIds: data.memberIds ?? [],
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    syncStatus: 'synced',
  };
}

class SyncService {
  private activeGroupUnsubscribers: Map<string, Unsubscribe[]> = new Map();
  private userGroupsUnsubscribe: Unsubscribe | null = null;
  private isInitialized = false;
  private currentUserId: string | null = null;
  private appStateSubscription: any = null;
  private networkUnsubscribe: (() => void) | null = null;

  public initialize(currentUserId?: string) {
    if (currentUserId) {
      this.currentUserId = currentUserId;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for app state changes (foreground catch-up sync)
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.onAppForeground();
      }
    });

    // Listen for network connectivity restoration
    this.networkUnsubscribe = networkMonitor.subscribe((online) => {
      if (online) {
        syncQueue.processQueue();
        if (this.currentUserId) {
          this.syncUserGroups(this.currentUserId);
        }
      }
    });
  }

  public reset(): void {
    // 1. Unsubscribe user groups listener
    if (this.userGroupsUnsubscribe) {
      try {
        this.userGroupsUnsubscribe();
      } catch {}
      this.userGroupsUnsubscribe = null;
    }

    // 2. Unsubscribe all active group listeners
    for (const [, unsubs] of this.activeGroupUnsubscribers.entries()) {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    }
    this.activeGroupUnsubscribers.clear();

    // 3. Remove AppState and network listeners
    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch {}
      this.appStateSubscription = null;
    }
    if (this.networkUnsubscribe) {
      try {
        this.networkUnsubscribe();
      } catch {}
      this.networkUnsubscribe = null;
    }

    this.currentUserId = null;
    this.isInitialized = false;
  }

  private async onAppForeground() {
    if (networkMonitor.isCurrentlyOnline()) {
      syncQueue.processQueue();
      if (this.currentUserId) {
        this.syncUserGroups(this.currentUserId);
      }
    }
  }

  /**
   * Retrieves a sync cursor from SQLite.
   */
  public async getSyncCursor(key: string): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?`,
      [key]
    );
    return row ? parseInt(row.value, 10) : 0;
  }

  /**
   * Updates a sync cursor in SQLite.
   */
  public async setSyncCursor(key: string, timestamp: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, timestamp.toString(), Date.now()]
    );
  }

  /**
   * Subscribes to the actively opened group with Firestore onSnapshot.
   * Remote updates are merged directly into SQLite, and onDataUpdated callback is triggered.
   * Returns a cleanup function to unsubscribe when leaving the screen.
   */
  public subscribeToActiveGroup(
    groupId: string,
    onDataUpdated: () => void
  ): () => void {
    // Unsubscribe any previous listeners for this group
    this.unsubscribeActiveGroup(groupId);

    const unsubscribers: Unsubscribe[] = [];

    // 1. Group expenses listener
    const expensesCol = collection(db, 'splitwiser', 'data', 'groups', groupId, 'expenses');
    const expensesQuery = query(expensesCol, orderBy('createdAt', 'desc'));

    const unsubExpenses = onSnapshot(
      expensesQuery,
      async (snap) => {
        const remoteExpenses: Expense[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            groupId,
            createdBy: data.createdBy,
            paidBy: data.paidBy,
            description: data.description,
            amount: data.amount,
            splits: data.splits ?? [],
            splitType: data.splitType ?? 'equal',
            currency: data.currency ?? 'INR',
            tags: data.tags ?? [],
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            syncStatus: 'synced',
          };
        });

        await upsertRemoteExpenses(groupId, remoteExpenses);
        onDataUpdated();
      },
      (error) => {
        console.warn(`[SyncService] expenses snapshot error: ${error.message}`);
      }
    );
    unsubscribers.push(unsubExpenses);

    // 2. Group settlements listener
    const settlementsCol = collection(db, 'splitwiser', 'data', 'groups', groupId, 'settlements');
    const settlementsQuery = query(settlementsCol, orderBy('createdAt', 'desc'));

    const unsubSettlements = onSnapshot(
      settlementsQuery,
      async (snap) => {
        const remoteSettlements: Settlement[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            groupId,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            fromUserName: data.fromUserName,
            toUserName: data.toUserName,
            amount: data.amount,
            status: data.status ?? 'completed',
            note: data.note,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            syncStatus: 'synced',
          };
        });

        await upsertRemoteSettlements(groupId, remoteSettlements);
        onDataUpdated();
      },
      (error) => {
        console.warn(`[SyncService] settlements snapshot error: ${error.message}`);
      }
    );
    unsubscribers.push(unsubSettlements);

    // 3. Group members listener
    const membersCol = collection(db, 'splitwiser', 'data', 'groups', groupId, 'members');
    const unsubMembers = onSnapshot(
      membersCol,
      async (snap) => {
        const remoteMembers: GroupMember[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            userId: d.id,
            userName: data.userName ?? 'Member',
            role: data.role ?? 'member',
            joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
            imageUrl: data.imageUrl,
          };
        });

        await upsertRemoteMembers(groupId, remoteMembers);
        onDataUpdated();
      },
      (error) => {
        console.warn(`[SyncService] members snapshot error: ${error.message}`);
      }
    );
    unsubscribers.push(unsubMembers);

    this.activeGroupUnsubscribers.set(groupId, unsubscribers);

    return () => {
      this.unsubscribeActiveGroup(groupId);
    };
  }

  public unsubscribeActiveGroup(groupId: string) {
    const existing = this.activeGroupUnsubscribers.get(groupId);
    if (existing) {
      existing.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      this.activeGroupUnsubscribers.delete(groupId);
    }
  }

  /**
   * Subscribes to or syncs user groups into local SQLite.
   */
  public subscribeToUserGroups(
    userId: string,
    onGroupsUpdated: () => void
  ): () => void {
    if (this.userGroupsUnsubscribe) {
      this.userGroupsUnsubscribe();
      this.userGroupsUnsubscribe = null;
    }

    const groupsCol = collection(db, 'splitwiser', 'data', 'groups');
    const q = query(groupsCol, where('memberIds', 'array-contains', userId));

    this.userGroupsUnsubscribe = onSnapshot(
      q,
      async (snap) => {
        const remoteGroups: Group[] = snap.docs.map((d) =>
          mapFirestoreDocToGroup(d.id, d.data())
        );

        await upsertRemoteGroups(remoteGroups, userId);
        onGroupsUpdated();
      },
      (error) => {
        console.warn(`[SyncService] groups snapshot error: ${error.message}`);
      }
    );

    return () => {
      if (this.userGroupsUnsubscribe) {
        this.userGroupsUnsubscribe();
        this.userGroupsUnsubscribe = null;
      }
    };
  }

  /**
   * Incremental one-time sync for user groups.
   * On first call: fetches all groups (no cursor).
   * On subsequent calls: fetches only groups updated since the last cursor
   * minus an overlap window to handle clock skew.
   * Advances the cursor only after successful SQLite persistence.
   */
  public async syncUserGroups(userId: string): Promise<void> {
    if (!networkMonitor.isCurrentlyOnline()) return;

    try {
      const cursorKey = `groups_sync_${userId}`;
      const lastSyncMs = await this.getSyncCursor(cursorKey);
      const overlapMs = lastSyncMs > 0 ? lastSyncMs - SYNC_OVERLAP_MS : 0;

      const groupsCol = collection(db, 'splitwiser', 'data', 'groups');

      let snap;
      if (overlapMs > 0) {
        try {
          const incrementalQuery = query(
            groupsCol,
            where('memberIds', 'array-contains', userId),
            where('updatedAt', '>', Timestamp.fromMillis(overlapMs)),
            orderBy('updatedAt', 'asc')
          );
          snap = await getDocs(incrementalQuery);
        } catch (indexErr: any) {
          // If Firestore composite index is missing, gracefully fall back to full query
          console.warn('[SyncService] incremental query fallback:', indexErr?.message);
          snap = await getDocs(query(groupsCol, where('memberIds', 'array-contains', userId)));
        }
      } else {
        snap = await getDocs(query(groupsCol, where('memberIds', 'array-contains', userId)));
      }

      if (snap.empty) return;

      let maxUpdatedAtMs = lastSyncMs;

      const remoteGroups: Group[] = snap.docs.map((d) => {
        const group = mapFirestoreDocToGroup(d.id, d.data());
        maxUpdatedAtMs = Math.max(maxUpdatedAtMs, (group.updatedAt ?? new Date()).getTime());
        return group;
      });

      await upsertRemoteGroups(remoteGroups, overlapMs > 0 ? undefined : userId);

      // Advance cursor only after successful local persistence
      if (maxUpdatedAtMs > lastSyncMs) {
        await this.setSyncCursor(cursorKey, maxUpdatedAtMs);
      }

      // If this was an incremental sync, also trigger full soft-delete sweep
      // so that groups removed from Firestore still get marked locally deleted.
      // We do this at most once per hour to avoid overhead.
      if (overlapMs > 0) {
        const sweepKey = `groups_sweep_${userId}`;
        const lastSweepMs = await this.getSyncCursor(sweepKey);
        if (Date.now() - lastSweepMs > 60 * 60 * 1000) {
          await this.sweepDeletedGroups(userId);
          await this.setSyncCursor(sweepKey, Date.now());
        }
      }
    } catch (e) {
      console.warn('[SyncService] failed to sync user groups:', e);
    }
  }

  /**
   * Full sweep to soft-delete local groups that are no longer in Firestore
   * (e.g. user was removed from group by another member). Called periodically.
   */
  private async sweepDeletedGroups(userId: string): Promise<void> {
    try {
      const groupsCol = collection(db, 'splitwiser', 'data', 'groups');
      const q = query(groupsCol, where('memberIds', 'array-contains', userId));
      const snap = await getDocs(q);
      const remoteGroups: Group[] = snap.docs.map((d) =>
        mapFirestoreDocToGroup(d.id, d.data())
      );
      // Pass userId so soft-deletes are applied to groups no longer returned
      await upsertRemoteGroups(remoteGroups, userId);
    } catch (e) {
      console.warn('[SyncService] sweepDeletedGroups failed:', e);
    }
  }
}

export const syncService = new SyncService();

