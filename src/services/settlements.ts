import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Settlement } from '../types';
import { dispatchNotificationEvent } from './notificationService';

// ─── Path helpers ─────────────────────────────────────────────────────────────
// /splitwiser/data/groups/{groupId}/settlements/{settlementId}
const settlementsCol = (groupId: string) =>
  collection(db, 'splitwiser', 'data', 'groups', groupId, 'settlements');

function mapSettlement(id: string, data: Record<string, any>): Settlement {
  return {
    id,
    groupId: data.groupId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    fromUserName: data.fromUserName,
    toUserName: data.toUserName,
    amount: data.amount,
    status: data.status ?? 'pending',
    createdAt: data.createdAt?.toDate() ?? new Date(),
    note: data.note,
  };
}

export async function recordSettlement(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  toUserName: string,
  amount: number,
  note?: string
): Promise<Settlement> {
  const ref = await addDoc(settlementsCol(groupId), {
    groupId,
    fromUserId,
    toUserId,
    fromUserName,
    toUserName,
    amount,
    status: 'completed',
    createdAt: serverTimestamp(),
    note: note ?? null,
  });

  // Dispatch in-app notification to the recipient of the settlement
  try {
    if (toUserId && toUserId !== fromUserId) {
      dispatchNotificationEvent({
        type: 'settlement_created',
        actor: {
          id: fromUserId,
          name: fromUserName || 'A member',
        },
        groupId,
        settlementId: ref.id,
        targetUserIds: [toUserId],
        params: {
          actorName: fromUserName || 'A member',
          amount: String(amount),
        },
        dedupeKey: `settlement_created_${ref.id}`,
      }).catch((err) => console.warn('[recordSettlement] Notification dispatch failed:', err?.message));
    }
  } catch (e: any) {
    // Non-blocking
  }

  return {
    id: ref.id,
    groupId,
    fromUserId,
    toUserId,
    fromUserName,
    toUserName,
    amount,
    status: 'completed',
    createdAt: new Date(),
    note,
  };
}

export async function getGroupSettlements(groupId: string): Promise<Settlement[]> {
  const q = query(settlementsCol(groupId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapSettlement(d.id, d.data()));
}

export function subscribeToSettlements(
  groupId: string,
  callback: (settlements: Settlement[]) => void
): Unsubscribe {
  const q = query(settlementsCol(groupId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapSettlement(d.id, d.data())));
  });
}
