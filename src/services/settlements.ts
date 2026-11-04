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
