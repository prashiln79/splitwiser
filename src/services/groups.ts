import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Group, GroupMember, MemberRole } from '../types';

import {
  updateGroupLocal,
  deleteGroupLocal,
  removeMemberLocal,
  leaveGroupLocal,
  upsertRemoteGroups,
} from '../repositories/groupRepository';
import { networkMonitor } from '../sync/networkMonitor';

// ─── Path helpers ─────────────────────────────────────────────────────────────
// All data lives under /splitwiser/data/groups/...
const groupsCol = () => collection(db, 'splitwiser', 'data', 'groups');
const groupDoc = (gid: string) => doc(db, 'splitwiser', 'data', 'groups', gid);
const membersCol = (gid: string) => collection(db, 'splitwiser', 'data', 'groups', gid, 'members');
const memberDoc = (gid: string, uid: string) => doc(db, 'splitwiser', 'data', 'groups', gid, 'members', uid);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateJoinCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

function mapGroup(id: string, data: Record<string, any>): Group {
  return {
    id,
    name: data.name,
    currency: data.currency ?? 'INR',
    joinCode: data.joinCode,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    imageUrl: data.imageUrl,
    bannerUrl: data.bannerUrl,
    icon: data.icon,
    memberIds: data.memberIds ?? [],
  };
}

function mapMember(id: string, data: Record<string, any>): GroupMember {
  return {
    userId: id,
    userName: data.userName ?? 'Unknown',
    role: data.role ?? 'member',
    joinedAt: data.joinedAt?.toDate() ?? new Date(),
    imageUrl: data.imageUrl,
  };
}

// ─── Groups CRUD ──────────────────────────────────────────────────────────────

export async function createGroup(
  name: string,
  creatorUid: string,
  creatorName: string,
  currency = 'INR',
  imageUrl?: string,
  icon?: string
): Promise<Group> {
  const joinCode = generateJoinCode();

  const groupRef = await addDoc(groupsCol(), {
    name: name.trim(),
    currency,
    joinCode,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    memberIds: [creatorUid],
    imageUrl: imageUrl || null,
    icon: icon || null,
  });

  await setDoc(memberDoc(groupRef.id, creatorUid), {
    userId: creatorUid,
    userName: creatorName,
    role: 'admin' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  const snap = await getDoc(groupRef);
  const created = mapGroup(groupRef.id, snap.data()!);
  // Cache in SQLite immediately
  await upsertRemoteGroups([created]);
  return created;
}

export async function getGroups(uid: string): Promise<Group[]> {
  const q = query(groupsCol(), where('memberIds', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapGroup(d.id, d.data()));
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const snap = await getDoc(groupDoc(groupId));
  if (!snap.exists()) return null;
  return mapGroup(snap.id, snap.data());
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Pick<Group, 'name' | 'imageUrl' | 'bannerUrl' | 'icon'>>
): Promise<void> {
  await updateGroupLocal(groupId, updates);
  await updateDoc(groupDoc(groupId), updates);
}

export async function deleteGroup(groupId: string): Promise<void> {
  // 1. Delete immediately in local SQLite so the UI reflects with zero latency
  await deleteGroupLocal(groupId);

  // 2. If online, also delete from Firestore
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await deleteDoc(groupDoc(groupId));
    } catch (e: any) {
      console.warn('[deleteGroup] remote delete skipped/queued:', e?.message);
    }
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const snap = await getDocs(membersCol(groupId));
  return snap.docs.map((d) => mapMember(d.id, d.data()));
}

export async function joinGroup(
  joinCode: string,
  uid: string,
  userName: string
): Promise<Group> {
  const q = query(groupsCol(), where('joinCode', '==', joinCode.toUpperCase().trim()));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error('No group found with that join code.');

  const groupDocSnap = snap.docs[0];
  const groupId = groupDocSnap.id;

  if (groupDocSnap.data().memberIds?.includes(uid)) {
    throw new Error('You are already a member of this group.');
  }

  await setDoc(memberDoc(groupId, uid), {
    userId: uid,
    userName,
    role: 'member' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  await updateDoc(groupDoc(groupId), { memberIds: arrayUnion(uid) });

  return mapGroup(groupId, groupDocSnap.data());
}

export async function removeMember(groupId: string, memberUid: string): Promise<void> {
  await removeMemberLocal(groupId, memberUid);
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await deleteDoc(memberDoc(groupId, memberUid));
      await updateDoc(groupDoc(groupId), { memberIds: arrayRemove(memberUid) });
    } catch (e: any) {
      console.warn('[removeMember] remote remove failed:', e?.message);
    }
  }
}

export async function updateMemberRole(
  groupId: string,
  memberUid: string,
  role: MemberRole
): Promise<void> {
  await updateDoc(memberDoc(groupId, memberUid), { role });
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await leaveGroupLocal(groupId, uid);
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await deleteDoc(memberDoc(groupId, uid));
      await updateDoc(groupDoc(groupId), { memberIds: arrayRemove(uid) });
    } catch (e: any) {
      console.warn('[leaveGroup] remote leave failed:', e?.message);
    }
  }
}

// ─── Real-time Listeners ──────────────────────────────────────────────────────

export function subscribeToGroups(
  uid: string,
  callback: (groups: Group[]) => void
): Unsubscribe {
  const q = query(groupsCol(), where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapGroup(d.id, d.data())));
  });
}
