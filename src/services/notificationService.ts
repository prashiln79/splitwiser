import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import {
  InAppNotification,
  NotificationSummary,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationEventInput,
  InAppNotificationType,
} from '../types/notifications';
import { networkMonitor } from '../sync/networkMonitor';
import {
  generateDeterministicNotificationId,
  getNotificationTranslationKeys,
  mapNotificationDoc,
  filterRecipients,
  isNotificationAllowed,
  calculateUnreadChange,
  getNotificationDefaultRoute,
} from '../utils/notificationUtils';

export {
  generateDeterministicNotificationId,
  getNotificationTranslationKeys,
  mapNotificationDoc,
  filterRecipients,
  isNotificationAllowed,
  calculateUnreadChange,
  getNotificationDefaultRoute,
};

// ─── Path Helpers ─────────────────────────────────────────────────────────────
// All data lives under /splitwiser/data/...
export const userNotificationsCol = (userId: string) =>
  collection(db, 'splitwiser', 'data', 'users', userId, 'notifications');

export const userNotificationDoc = (userId: string, notificationId: string) =>
  doc(db, 'splitwiser', 'data', 'users', userId, 'notifications', notificationId);

export const userSummaryDoc = (userId: string) =>
  doc(db, 'splitwiser', 'data', 'users', userId, 'notificationMeta', 'summary');

export const userPrefDoc = (userId: string) =>
  doc(db, 'splitwiser', 'data', 'users', userId, 'notificationMeta', 'preferences');

// ─── Local Storage Keys ───────────────────────────────────────────────────────
const NOTIF_CACHE_KEY = (userId: string) => `@splitwiser_notifications_${userId}`;
const SUMMARY_CACHE_KEY = (userId: string) => `@splitwiser_notif_summary_${userId}`;
const PREF_CACHE_KEY = (userId: string) => `@splitwiser_notif_prefs_${userId}`;

// ─── Dispatch Notification Event ──────────────────────────────────────────────
export async function dispatchNotificationEvent(event: NotificationEventInput): Promise<string[]> {
  const { titleKey, bodyKey } = getNotificationTranslationKeys(event.type);
  const createdIds: string[] = [];

  // Filter out the actor itself (no self-notifications) and duplicates
  const recipients = Array.from(new Set(event.targetUserIds.filter((id) => id && id !== event.actor.id)));

  for (const recipientId of recipients) {
    try {
      // 1. Check user preferences and group mute status
      const prefs = await getNotificationPreferences(recipientId);

      // Group-level mute check
      if (event.groupId && prefs.mutedGroupIds.includes(event.groupId)) {
        continue;
      }

      // Event-type preference checks
      if (event.type === 'expense_created' && !prefs.expenseAdded) continue;
      if (event.type === 'expense_updated' && !prefs.expenseUpdated) continue;
      if (event.type === 'expense_deleted' && !prefs.expenseDeleted) continue;
      if ((event.type === 'settlement_created' || event.type === 'settlement_updated') && !prefs.settlements) continue;
      if (event.type === 'group_invitation' && !prefs.groupInvites) continue;
      if (event.type === 'payment_reminder' && !prefs.paymentReminders) continue;
      if (event.type === 'expense_comment' && !prefs.comments) continue;
      if (event.type === 'member_joined' && !prefs.memberActivity) continue;

      // 2. Deterministic notification ID for idempotency
      const notifId = generateDeterministicNotificationId(event.type, event.dedupeKey, recipientId);
      const targetDocRef = userNotificationDoc(recipientId, notifId);
      const summaryRef = userSummaryDoc(recipientId);

      const payload = {
        type: event.type,
        schemaVersion: 1,
        actorId: event.actor.id,
        actorName: event.actor.name,
        actorAvatarUrl: event.actor.avatarUrl || null,
        groupId: event.groupId || null,
        groupName: event.groupName || null,
        expenseId: event.expenseId || null,
        settlementId: event.settlementId || null,
        titleKey,
        bodyKey,
        params: event.params,
        createdAt: serverTimestamp(),
        readAt: null,
        archivedAt: null,
        dedupeKey: `${event.dedupeKey}_${recipientId}`,
      };

      await runTransaction(db, async (tx) => {
        // 1. ALL READS FIRST (Firestore requires all reads before any writes)
        const existing = await tx.get(targetDocRef);
        const sumSnap = await tx.get(summaryRef);

        if (existing.exists()) {
          // Already created; idempotent skip
          return;
        }

        // 2. ALL WRITES AFTER
        tx.set(targetDocRef, payload);

        // Atomic summary unread count increment
        if (sumSnap.exists()) {
          const currentCount = sumSnap.data().unreadCount || 0;
          tx.update(summaryRef, {
            unreadCount: currentCount + 1,
            lastNotificationAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(summaryRef, {
            unreadCount: 1,
            lastNotificationAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      createdIds.push(notifId);
    } catch (e: any) {
      console.warn(`[notificationService] Error dispatching to ${recipientId}:`, e?.message);
    }
  }

  return createdIds;
}

// ─── Fetch Paginated Notifications ───────────────────────────────────────────
export async function getUserNotifications(
  userId: string,
  pageSize: number = 20,
  lastSnapshot?: QueryDocumentSnapshot | DocumentSnapshot | null
): Promise<{
  notifications: InAppNotification[];
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> {
  // If offline or starting fresh, check local AsyncStorage cache
  if (!lastSnapshot) {
    try {
      const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId));
      if (raw && !networkMonitor.isCurrentlyOnline()) {
        const parsed = JSON.parse(raw).map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          readAt: item.readAt ? new Date(item.readAt) : null,
          archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
        }));
        return { notifications: parsed, lastVisible: null, hasMore: false };
      }
    } catch (e) {
      // ignore
    }
  }

  if (!networkMonitor.isCurrentlyOnline()) {
    return { notifications: [], lastVisible: null, hasMore: false };
  }

  try {
    let q = query(
      userNotificationsCol(userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize * 2)
    );

    if (lastSnapshot) {
      q = query(
        userNotificationsCol(userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastSnapshot),
        limit(pageSize * 2)
      );
    }

    const snap = await getDocs(q);
    const nonArchivedDocs = snap.docs.filter((d) => d.data().archivedAt == null);
    const hasMore = nonArchivedDocs.length > pageSize;
    const resultDocs = hasMore ? nonArchivedDocs.slice(0, pageSize) : nonArchivedDocs;
    const notifications = resultDocs.map((d) => mapNotificationDoc(d.id, d.data()));

    // Cache first page locally
    if (!lastSnapshot) {
      await AsyncStorage.setItem(NOTIF_CACHE_KEY(userId), JSON.stringify(notifications)).catch(() => {});
    }

    const newLastVisible = resultDocs.length > 0 ? (resultDocs[resultDocs.length - 1] as QueryDocumentSnapshot) : null;
    return { notifications, lastVisible: newLastVisible, hasMore };
  } catch (err: any) {
    console.warn('[getUserNotifications] Remote fetch failed:', err?.message);
    // Fallback to cache
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId)).catch(() => null);
    if (raw) {
      const parsed = JSON.parse(raw).map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        readAt: item.readAt ? new Date(item.readAt) : null,
        archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
      }));
      return { notifications: parsed, lastVisible: null, hasMore: false };
    }
    return { notifications: [], lastVisible: null, hasMore: false };
  }
}

// ─── Mark Notification As Read ────────────────────────────────────────────────
export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  const docRef = userNotificationDoc(userId, notificationId);
  const summaryRef = userSummaryDoc(userId);

  try {
    await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const snap = await tx.get(docRef);
      const sumSnap = await tx.get(summaryRef);

      if (!snap.exists()) return;

      const data = snap.data();
      if (data.readAt) {
        // Already read; do not decrement again
        return;
      }

      // 2. ALL WRITES AFTER
      tx.update(docRef, { readAt: serverTimestamp() });

      if (sumSnap.exists()) {
        const currentCount = sumSnap.data().unreadCount || 0;
        tx.update(summaryRef, {
          unreadCount: Math.max(0, currentCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Update local cache
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId));
    if (raw) {
      const list: InAppNotification[] = JSON.parse(raw);
      const updated = list.map((item) =>
        item.id === notificationId ? { ...item, readAt: new Date() } : item
      );
      await AsyncStorage.setItem(NOTIF_CACHE_KEY(userId), JSON.stringify(updated));
    }
  } catch (e: any) {
    console.warn('[markNotificationAsRead] Error:', e?.message);
  }
}

// ─── Mark All Notifications As Read ───────────────────────────────────────────
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      userNotificationsCol(userId),
      limit(100)
    );

    const snap = await getDocs(q);
    const unreadDocs = snap.docs.filter((d) => {
      const data = d.data();
      return data.readAt == null && data.archivedAt == null;
    });

    if (unreadDocs.length > 0) {
      const batch = writeBatch(db);
      unreadDocs.forEach((d) => {
        batch.update(d.ref, { readAt: serverTimestamp() });
      });
      batch.set(userSummaryDoc(userId), {
        unreadCount: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await batch.commit();
    } else {
      await setDoc(userSummaryDoc(userId), {
        unreadCount: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    // Update local cache
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId));
    if (raw) {
      const list: InAppNotification[] = JSON.parse(raw);
      const updated = list.map((item) => ({ ...item, readAt: item.readAt || new Date() }));
      await AsyncStorage.setItem(NOTIF_CACHE_KEY(userId), JSON.stringify(updated));
    }
  } catch (e: any) {
    console.warn('[markAllNotificationsAsRead] Error:', e?.message);
  }
}

// ─── Archive Notification ─────────────────────────────────────────────────────
export async function archiveNotification(userId: string, notificationId: string): Promise<void> {
  const docRef = userNotificationDoc(userId, notificationId);
  const summaryRef = userSummaryDoc(userId);

  try {
    await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const snap = await tx.get(docRef);
      const sumSnap = await tx.get(summaryRef);

      if (!snap.exists()) return;

      const data = snap.data();
      const wasUnread = !data.readAt && !data.archivedAt;

      // 2. ALL WRITES AFTER
      tx.update(docRef, { archivedAt: serverTimestamp() });

      if (wasUnread && sumSnap.exists()) {
        const current = sumSnap.data().unreadCount || 0;
        tx.update(summaryRef, {
          unreadCount: Math.max(0, current - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Remove from local cache
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId));
    if (raw) {
      const list: InAppNotification[] = JSON.parse(raw);
      const updated = list.filter((item) => item.id !== notificationId);
      await AsyncStorage.setItem(NOTIF_CACHE_KEY(userId), JSON.stringify(updated));
    }
  } catch (e: any) {
    console.warn('[archiveNotification] Error:', e?.message);
  }
}

// ─── Delete Notification ──────────────────────────────────────────────────────
export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const docRef = userNotificationDoc(userId, notificationId);
  const summaryRef = userSummaryDoc(userId);

  try {
    await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const snap = await tx.get(docRef);
      const sumSnap = await tx.get(summaryRef);

      if (!snap.exists()) return;

      const data = snap.data();
      const wasUnread = !data.readAt && !data.archivedAt;

      // 2. ALL WRITES AFTER
      tx.delete(docRef);

      if (wasUnread && sumSnap.exists()) {
        const current = sumSnap.data().unreadCount || 0;
        tx.update(summaryRef, {
          unreadCount: Math.max(0, current - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Remove from local cache
    const raw = await AsyncStorage.getItem(NOTIF_CACHE_KEY(userId));
    if (raw) {
      const list: InAppNotification[] = JSON.parse(raw);
      const updated = list.filter((item) => item.id !== notificationId);
      await AsyncStorage.setItem(NOTIF_CACHE_KEY(userId), JSON.stringify(updated));
    }
  } catch (e: any) {
    console.warn('[deleteNotification] Error:', e?.message);
  }
}

// ─── Reconcile Unread Count ───────────────────────────────────────────────────
export async function reconcileUnreadCount(userId: string): Promise<number> {
  if (!networkMonitor.isCurrentlyOnline()) return 0;

  try {
    const q = query(
      userNotificationsCol(userId),
      limit(100)
    );
    const snap = await getDocs(q);
    const actualUnread = snap.docs.filter((d) => {
      const data = d.data();
      return data.readAt == null && data.archivedAt == null;
    }).length;

    await setDoc(
      userSummaryDoc(userId),
      {
        unreadCount: actualUnread,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await AsyncStorage.setItem(SUMMARY_CACHE_KEY(userId), JSON.stringify({ unreadCount: actualUnread }));
    return actualUnread;
  } catch (e: any) {
    console.warn('[reconcileUnreadCount] Error:', e?.message);
    return 0;
  }
}

// ─── Get & Update User Notification Preferences ───────────────────────────────
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const cached = await AsyncStorage.getItem(PREF_CACHE_KEY(userId));
    if (cached) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(cached) };
    }
  } catch {
    // ignore
  }

  if (networkMonitor.isCurrentlyOnline()) {
    try {
      const snap = await getDoc(userPrefDoc(userId));
      if (snap.exists()) {
        const merged: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...snap.data(),
        };
        await AsyncStorage.setItem(PREF_CACHE_KEY(userId), JSON.stringify(merged));
        return merged;
      }
    } catch (e: any) {
      console.warn('[getNotificationPreferences] Remote read error:', e?.message);
    }
  }

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const updated: NotificationPreferences = { ...current, ...updates };

  await AsyncStorage.setItem(PREF_CACHE_KEY(userId), JSON.stringify(updated)).catch(() => {});

  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await setDoc(userPrefDoc(userId), updated, { merge: true });
    } catch (e: any) {
      console.warn('[updateNotificationPreferences] Remote save error:', e?.message);
    }
  }

  return updated;
}

// ─── Real-Time Summary & Unread Badge Listener ────────────────────────────────
export function subscribeToNotificationSummary(
  userId: string,
  onUpdate: (summary: NotificationSummary) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    userSummaryDoc(userId),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const summary: NotificationSummary = {
          unreadCount: data.unreadCount ?? 0,
          lastNotificationAt: data.lastNotificationAt?.toDate ? data.lastNotificationAt.toDate() : null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        };
        AsyncStorage.setItem(SUMMARY_CACHE_KEY(userId), JSON.stringify(summary)).catch(() => {});
        onUpdate(summary);
      } else {
        onUpdate({ unreadCount: 0, updatedAt: new Date() });
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

// ─── Real-Time Notification Stream Listener ───────────────────────────────────
export function subscribeToUserNotifications(
  userId: string,
  onAdded: (notification: InAppNotification) => void,
  onModified?: (notification: InAppNotification) => void,
  onRemoved?: (notificationId: string) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    userNotificationsCol(userId),
    orderBy('createdAt', 'desc'),
    limit(30)
  );

  let isFirstBatch = true;

  return onSnapshot(
    q,
    (snap) => {
      if (isFirstBatch) {
        // Initial historical load – do NOT fire onAdded banners
        isFirstBatch = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (data.archivedAt != null) return;
        const item = mapNotificationDoc(change.doc.id, data);
        if (change.type === 'added') {
          onAdded(item);
        } else if (change.type === 'modified' && onModified) {
          onModified(item);
        } else if (change.type === 'removed' && onRemoved) {
          onRemoved(change.doc.id);
        }
      });
    },
    (err) => {
      console.warn('[subscribeToUserNotifications] Firestore listener error:', err?.message);
      if (onError) onError(err);
    }
  );
}
