import { doc, setDoc, deleteDoc, updateDoc, arrayRemove, collection, getDocs, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from '../config/firebase';
import { getDatabase } from '../db/sqlite';
import { networkMonitor } from './networkMonitor';
import { dispatchNotificationEvent } from '../services/notificationService';

export type QueueOperation = 
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'DELETE_EXPENSE'
  | 'RECORD_SETTLEMENT'
  | 'CREATE_GROUP'
  | 'DELETE_GROUP'
  | 'LEAVE_GROUP'
  | 'CREATE_FRIENDSHIP'
  | 'DELETE_FRIENDSHIP'
  | 'UPDATE_USER_PROFILE';

export interface QueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: QueueOperation;
  payload_json: string;
  created_at: number;
  attempts: number;
  last_attempt_at?: number | null;
  error_message?: string | null;
  status: 'pending' | 'processing' | 'failed';
}

type QueueListener = (pendingCount: number) => void;

class SyncQueue {
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();
  private scheduledTimer: any = null;

  constructor() {
    // Listen for network changes to auto-flush queue when back online
    networkMonitor.subscribe((online) => {
      if (online) {
        this.processQueue();
      }
    });
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners() {
    try {
      const count = await this.getPendingCount();
      for (const listener of this.listeners) {
        listener(count);
      }
    } catch {
      // Ignore count error
    }
  }

  /**
   * Enqueues an operation into the durable SQLite queue.
   */
  public async enqueue(
    entityType: 'expense' | 'settlement' | 'group' | 'friendship' | 'user',
    entityId: string,
    operation: QueueOperation,
    payload: Record<string, any>
  ): Promise<string> {
    const database = await getDatabase();
    const id = Crypto.randomUUID();
    const now = Date.now();

    await database.runAsync(
      `INSERT INTO sync_queue (
        id, entity_type, entity_id, operation, payload_json, created_at, attempts, status
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [id, entityType, entityId, operation, JSON.stringify(payload), now]
    );

    this.notifyListeners();

    // Trigger processing if online
    if (networkMonitor.isCurrentlyOnline()) {
      this.processQueue();
    }

    return id;
  }

  public async getPendingCount(): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending' OR status = 'failed'`
    );
    return row?.count ?? 0;
  }

  /**
   * Processes all pending operations in chronological order.
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!networkMonitor.isCurrentlyOnline()) return;

    this.isProcessing = true;
    const database = await getDatabase();

    try {
      // Fetch pending items
      const items = await database.getAllAsync<QueueItem>(
        `SELECT * FROM sync_queue 
         WHERE status IN ('pending', 'failed') 
         ORDER BY created_at ASC 
         LIMIT 20`
      );

      const now = Date.now();

      for (const item of items) {
        // Exponential backoff check: base 1.5s, max 60s
        const backoffMs = Math.min(1500 * Math.pow(2, item.attempts), 60000);
        if (item.last_attempt_at && now - item.last_attempt_at < backoffMs) {
          continue; // Wait until backoff duration has passed
        }

        // Mark as processing
        await database.runAsync(
          `UPDATE sync_queue SET status = 'processing', attempts = attempts + 1, last_attempt_at = ? WHERE id = ?`,
          [now, item.id]
        );

        try {
          await this.executeItem(item);

          // Success: remove from sync_queue
          await database.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);

          // Mark local item as synced
          await this.markEntitySynced(item.entity_type, item.entity_id);
        } catch (err: any) {
          console.warn(`[SyncQueue] Failed item ${item.id} (${item.operation}):`, err?.message || err);

          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= 8 ? 'failed' : 'pending';

          await database.runAsync(
            `UPDATE sync_queue SET status = ?, error_message = ? WHERE id = ?`,
            [newStatus, String(err?.message || err), item.id]
          );

          if (newStatus === 'failed') {
            await this.markEntityFailed(item.entity_type, item.entity_id);
          }
        }
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  private async executeItem(item: QueueItem): Promise<void> {
    const payload = JSON.parse(item.payload_json);

    switch (item.operation) {
      case 'CREATE_EXPENSE': {
        const { id, groupId, createdBy, paidBy, description, amount, splits, splitType, currency, tags, createdAt, updatedAt } = payload;
        // Ensure local receipt tags never leak to cloud Firestore
        const cleanTags = Array.isArray(tags) ? tags.filter((t: string) => !t.startsWith('receipt:')) : [];
        const ref = doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', id);
        await setDoc(ref, {
          groupId,
          createdBy,
          paidBy,
          description,
          amount,
          splits,
          splitType,
          currency: currency || 'INR',
          tags: cleanTags,
          createdAt: createdAt ? Timestamp.fromMillis(createdAt) : serverTimestamp(),
          updatedAt: updatedAt ? Timestamp.fromMillis(updatedAt) : serverTimestamp(),
        });

        // Dispatch in-app notification to group members involved
        try {
          const targetUserIds = (splits ?? [])
            .map((s: any) => s.userId)
            .filter((uid: string) => uid && uid !== createdBy);

          if (targetUserIds.length > 0) {
            let actorName = 'A member';
            try {
              const database = await getDatabase();
              const row = await database.getFirstAsync<{ user_name: string }>(
                `SELECT user_name FROM local_group_members WHERE group_id = ? AND user_id = ?`,
                [groupId, paidBy || createdBy]
              );
              if (row?.user_name) actorName = row.user_name;
            } catch {}

            const num = Number(amount) || 0;
            const formatted = '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });

            dispatchNotificationEvent({
              type: 'expense_created',
              actor: {
                id: createdBy,
                name: actorName,
              },
              groupId,
              expenseId: id,
              targetUserIds,
              params: {
                actorName,
                expenseDescription: description,
                amount: String(amount),
                amountFormatted: formatted,
                currency: currency || 'INR',
              },
              dedupeKey: `expense_created_${id}`,
            }).catch(() => {});
          }
        } catch {}
        break;
      }

      case 'UPDATE_EXPENSE': {
        const { id, groupId, tags, ...updates } = payload;
        const cleanUpdates: Record<string, any> = { ...updates };
        if (tags !== undefined) {
          cleanUpdates.tags = Array.isArray(tags) ? tags.filter((t: string) => !t.startsWith('receipt:')) : [];
        }
        const ref = doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', id);
        await setDoc(ref, {
          ...cleanUpdates,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }

      case 'DELETE_EXPENSE': {
        const { id, groupId } = payload;
        const ref = doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', id);
        await deleteDoc(ref);
        break;
      }

      case 'RECORD_SETTLEMENT': {
        const { id, groupId, fromUserId, toUserId, fromUserName, toUserName, amount, status, note, createdAt } = payload;
        const ref = doc(db, 'splitwiser', 'data', 'groups', groupId, 'settlements', id);
        await setDoc(ref, {
          groupId,
          fromUserId,
          toUserId,
          fromUserName,
          toUserName,
          amount,
          status: status || 'completed',
          note: note || null,
          createdAt: createdAt ? Timestamp.fromMillis(createdAt) : serverTimestamp(),
        });

        try {
          if (toUserId && toUserId !== fromUserId) {
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
                amountFormatted: '₹' + (Number(amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
                currency: 'INR',
              },
              dedupeKey: `settlement_created_${id}`,
            }).catch(() => {});
          }
        } catch {}
        break;
      }

      case 'CREATE_GROUP': {
        const { id, name, currency, joinCode, createdBy, createdAt, memberIds, creatorName, imageUrl, icon } = payload;
        const groupRef = doc(db, 'splitwiser', 'data', 'groups', id);
        const memberRef = doc(db, 'splitwiser', 'data', 'groups', id, 'members', createdBy);

        await setDoc(groupRef, {
          name,
          currency: currency || 'INR',
          joinCode,
          createdBy,
          createdAt: createdAt ? Timestamp.fromMillis(createdAt) : serverTimestamp(),
          memberIds: memberIds || [createdBy],
          imageUrl: imageUrl || null,
          icon: icon || null,
        });

        await setDoc(memberRef, {
          userId: createdBy,
          userName: creatorName || 'User',
          role: 'admin',
          joinedAt: serverTimestamp(),
        });
        break;
      }

      case 'DELETE_GROUP': {
        const { groupId } = payload;
        const groupRef = doc(db, 'splitwiser', 'data', 'groups', groupId);
        await deleteDoc(groupRef);
        break;
      }

      case 'LEAVE_GROUP': {
        const { groupId, uid } = payload;
        const memberRef = doc(db, 'splitwiser', 'data', 'groups', groupId, 'members', uid);
        await deleteDoc(memberRef).catch(() => {});

        const groupRef = doc(db, 'splitwiser', 'data', 'groups', groupId);
        const groupSnap = await getDoc(groupRef).catch(() => null);
        if (groupSnap && groupSnap.exists()) {
          await updateDoc(groupRef, { memberIds: arrayRemove(uid) }).catch(() => {});

          const membersCol = collection(db, 'splitwiser', 'data', 'groups', groupId, 'members');
          const remainingSnap = await getDocs(membersCol).catch(() => null);
          if (remainingSnap && !remainingSnap.empty) {
            const hasAdmin = remainingSnap.docs.some((d) => d.data().role === 'admin');
            if (!hasAdmin) {
              await updateDoc(remainingSnap.docs[0].ref, { role: 'admin' }).catch(() => {});
            }
          }
        }
        break;
      }

      case 'CREATE_FRIENDSHIP': {
        const { id, userId, friendId, friendName, friendEmail, friendPhotoUrl, status } = payload;
        const ref = doc(db, 'splitwiser', 'data', 'friendships', id);
        await setDoc(ref, {
          id,
          memberUids: [userId, friendId],
          status: status || 'accepted',
          names: { [friendId]: friendName },
          emails: friendEmail ? { [friendId]: friendEmail } : {},
          photos: friendPhotoUrl ? { [friendId]: friendPhotoUrl } : {},
          initiatedBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }

      case 'DELETE_FRIENDSHIP': {
        const { id } = payload;
        const ref = doc(db, 'splitwiser', 'data', 'friendships', id);
        await setDoc(ref, {
          status: 'removed',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }

      case 'UPDATE_USER_PROFILE': {
        const { uid, name, imageUrl } = payload;
        const { updateUserAcrossGroups } = await import('../services/groups');
        await updateUserAcrossGroups(uid, name, imageUrl);
        break;
      }

      default:
        throw new Error(`Unknown queue operation: ${item.operation}`);
    }
  }

  private async markEntitySynced(entityType: string, entityId: string): Promise<void> {
    if (entityType === 'user') return;
    const database = await getDatabase();
    if (entityType === 'expense') {
      await database.runAsync(
        `UPDATE local_expenses SET sync_status = 'synced' WHERE id = ?`,
        [entityId]
      );
    } else if (entityType === 'settlement') {
      await database.runAsync(
        `UPDATE local_settlements SET sync_status = 'synced' WHERE id = ?`,
        [entityId]
      );
    } else if (entityType === 'group') {
      await database.runAsync(
        `UPDATE local_groups SET sync_status = 'synced' WHERE id = ?`,
        [entityId]
      );
    } else if (entityType === 'friendship') {
      await database.runAsync(
        `UPDATE local_friendships SET sync_status = 'synced' WHERE id = ?`,
        [entityId]
      );
    }
  }

  private async markEntityFailed(entityType: string, entityId: string): Promise<void> {
    const database = await getDatabase();
    if (entityType === 'expense') {
      await database.runAsync(
        `UPDATE local_expenses SET sync_status = 'failed' WHERE id = ?`,
        [entityId]
      );
    } else if (entityType === 'settlement') {
      await database.runAsync(
        `UPDATE local_settlements SET sync_status = 'failed' WHERE id = ?`,
        [entityId]
      );
    } else if (entityType === 'friendship') {
      await database.runAsync(
        `UPDATE local_friendships SET sync_status = 'failed' WHERE id = ?`,
        [entityId]
      );
    }
  }
}

export const syncQueue = new SyncQueue();

