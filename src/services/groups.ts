import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
import { Group, GroupMember, MemberRole, GroupCoverPhoto } from '../types';

import {
  updateGroupLocal,
  deleteGroupLocal,
  removeMemberLocal,
  leaveGroupLocal,
  upsertRemoteGroups,
} from '../repositories/groupRepository';
import { networkMonitor } from '../sync/networkMonitor';
import { syncQueue } from '../sync/syncQueue';

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
  const coverPhoto = data.coverPhoto || (data.bannerUrl ? { type: 'preset', imageUrl: data.bannerUrl } : undefined);
  return {
    id,
    name: data.name,
    currency: data.currency ?? 'INR',
    joinCode: data.joinCode,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    imageUrl: data.imageUrl,
    bannerUrl: coverPhoto?.imageUrl || data.bannerUrl,
    coverPhoto,
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
  icon?: string,
  coverPhoto?: GroupCoverPhoto
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
    bannerUrl: coverPhoto?.imageUrl || null,
    coverPhoto: coverPhoto || null,
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
  updates: Partial<Pick<Group, 'name' | 'imageUrl' | 'bannerUrl' | 'coverPhoto' | 'icon'>>
): Promise<void> {
  // 1. Immediately update SQLite so local UI updates with zero latency
  await updateGroupLocal(groupId, updates);

  // 2. Persist to Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      const firestoreUpdates: Record<string, any> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined && v !== null) {
          firestoreUpdates[k] = v;
        } else {
          firestoreUpdates[k] = deleteField();
        }
      }
      await updateDoc(groupDoc(groupId), firestoreUpdates);
    } catch (e: any) {
      console.warn('[updateGroup] remote update skipped/failed:', e?.message);
    }
  }
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
  // 1. Immediately remove member locally from SQLite
  await removeMemberLocal(groupId, memberUid);

  // 2. Enqueue in sync queue so it works offline/retries properly
  await syncQueue.enqueue('group', `${groupId}_remove_${memberUid}`, 'LEAVE_GROUP', {
    groupId,
    uid: memberUid,
  });

  // 3. If online, also execute immediately with Firestore
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await deleteDoc(memberDoc(groupId, memberUid)).catch(() => {});
      const groupSnap = await getDoc(groupDoc(groupId)).catch(() => null);
      if (groupSnap && groupSnap.exists()) {
        await updateDoc(groupDoc(groupId), { memberIds: arrayRemove(memberUid) }).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[removeMember] remote remove failed (queued):', e?.message);
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
  // 1. Immediately soft-delete group locally & clear local data for this user
  await leaveGroupLocal(groupId, uid);

  // 2. Enqueue in sync queue so it works offline/retries properly
  await syncQueue.enqueue('group', `${groupId}_leave_${uid}`, 'LEAVE_GROUP', {
    groupId,
    uid,
  });

  // 3. If online, also execute immediately with Firestore
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await deleteDoc(memberDoc(groupId, uid)).catch(() => {});
      const groupSnap = await getDoc(groupDoc(groupId)).catch(() => null);
      if (groupSnap && groupSnap.exists()) {
        await updateDoc(groupDoc(groupId), { memberIds: arrayRemove(uid) }).catch(() => {});
        const remainingSnap = await getDocs(membersCol(groupId)).catch(() => null);
        if (remainingSnap && !remainingSnap.empty) {
          const hasAdmin = remainingSnap.docs.some((d) => d.data().role === 'admin');
          if (!hasAdmin) {
            await updateDoc(remainingSnap.docs[0].ref, { role: 'admin' }).catch(() => {});
          }
        }
      }
    } catch (e: any) {
      console.warn('[leaveGroup] remote leave failed (queued):', e?.message);
    }
  }
}

// ─── Real-time Listeners ──────────────────────────────────────────────────────

/**
 * Updates a member's display name and photo across all groups they belong to in Firestore.
 */
export async function updateUserAcrossGroups(
  uid: string,
  newName?: string,
  imageUrl?: string
): Promise<void> {
  if (!newName && !imageUrl) return;
  try {
    const q = query(groupsCol(), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    const updates: Record<string, any> = {};
    if (newName) updates.userName = newName;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const promises = snap.docs.map((docSnap) => {
      const memberRef = memberDoc(docSnap.id, uid);
      return setDoc(memberRef, updates, { merge: true });
    });
    await Promise.all(promises);
  } catch (e: any) {
    console.warn('[updateUserAcrossGroups] Error updating member in groups:', e.message);
  }
}

export function subscribeToGroups(
  uid: string,
  callback: (groups: Group[]) => void
): Unsubscribe {
  const q = query(groupsCol(), where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapGroup(d.id, d.data())));
  });
}
