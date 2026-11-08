import { AppState, AppStateStatus } from 'react-native';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
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

class SyncService {
  private activeGroupUnsubscribers: Map<string, Unsubscribe[]> = new Map();
  private userGroupsUnsubscribe: Unsubscribe | null = null;
  private isInitialized = false;

  public initialize(currentUserId?: string) {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for app state changes (foreground catch-up sync)
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.onAppForeground(currentUserId);
      }
    });

    // Listen for network connectivity restoration
    networkMonitor.subscribe((online) => {
      if (online) {
        syncQueue.processQueue();
        if (currentUserId) {
          this.syncUserGroups(currentUserId);
        }
      }
    });
  }

  private async onAppForeground(currentUserId?: string) {
    if (networkMonitor.isCurrentlyOnline()) {
      syncQueue.processQueue();
      if (currentUserId) {
        this.syncUserGroups(currentUserId);
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
        const remoteGroups: Group[] = snap.docs.map((d) => {
          const data = d.data();
          const coverPhoto = data.coverPhoto || (data.bannerUrl ? { type: 'preset', imageUrl: data.bannerUrl } : undefined);
          return {
            id: d.id,
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
        });

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
   * One-time sync for user groups when coming online or manually refreshing.
   */
  public async syncUserGroups(userId: string): Promise<void> {
    if (!networkMonitor.isCurrentlyOnline()) return;

    try {
      const groupsCol = collection(db, 'splitwiser', 'data', 'groups');
      const q = query(groupsCol, where('memberIds', 'array-contains', userId));
      const snap = await getDocs(q);

      const remoteGroups: Group[] = snap.docs.map((d) => {
        const data = d.data();
        const coverPhoto = data.coverPhoto || (data.bannerUrl ? { type: 'preset', imageUrl: data.bannerUrl } : undefined);
        return {
          id: d.id,
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
      });

      await upsertRemoteGroups(remoteGroups, userId);
    } catch (e) {
      console.warn('[SyncService] failed to sync user groups:', e);
    }
  }
}

export const syncService = new SyncService();

