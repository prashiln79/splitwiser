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
  upsertRemoteMembers,
  getLocalGroupById,
} from '../repositories/groupRepository';
import { networkMonitor } from '../sync/networkMonitor';
import { syncQueue } from '../sync/syncQueue';
import { dispatchNotificationEvent } from './notificationService';

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
  const rawType = (data.type || data.icon || undefined) as any;
  const isPersonal = Boolean(data.isPersonal || rawType === 'personal' || data.icon === 'personal');

  return {
    id,
    name: data.name,
    type: rawType,
    description: data.description || undefined,
    currency: data.currency ?? 'INR',
    joinCode: data.joinCode,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    imageUrl: data.imageUrl,
    bannerUrl: coverPhoto?.imageUrl || data.bannerUrl,
    coverPhoto,
    icon: data.icon,
    isPersonal,
    memberIds: data.memberIds ?? [],
    settings: data.settings || undefined,
    isArchived: Boolean(data.isArchived || data.status === 'archived'),
    status: data.status || (data.isArchived ? 'archived' : 'active'),
  };
}

function mapMember(id: string, data: Record<string, any>): GroupMember {
  return {
    userId: id,
    userName: data.userName ?? 'Unknown',
    role: data.role ?? 'member',
    joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
    imageUrl:
      data.imageUrl ||
      data.photoUrl ||
      data.photoURL ||
      data.googlePhotoUrl ||
      data.customPhotoUrl ||
      undefined,
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
  coverPhoto?: GroupCoverPhoto,
  creatorPhotoUrl?: string,
  isPersonal?: boolean
): Promise<Group> {
  const joinCode = generateJoinCode();
  const personalFlag = Boolean(isPersonal || icon === 'personal');
  const groupType = icon || (personalFlag ? 'personal' : 'home');

  const groupRef = await addDoc(groupsCol(), {
    name: name.trim(),
    type: groupType,
    isPersonal: personalFlag,
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
    imageUrl: creatorPhotoUrl || null,
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
  updates: Partial<Group>
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

export async function archiveGroup(groupId: string): Promise<void> {
  await updateGroup(groupId, { isArchived: true, status: 'archived' });
}

export async function unarchiveGroup(groupId: string): Promise<void> {
  await updateGroup(groupId, { isArchived: false, status: 'active' });
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
  const members = snap.docs.map((d) => mapMember(d.id, d.data()));

  // Hydrate missing photos from user profile docs in Firestore if needed
  const missingPhotoMembers = members.filter((m) => !m.imageUrl && m.userId);
  if (missingPhotoMembers.length > 0) {
    await Promise.all(
      missingPhotoMembers.map(async (m) => {
        try {
          const userDocSnap = await getDoc(doc(db, 'splitwiser', 'data', 'users', m.userId));
          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            const photo =
              uData.imageUrl ||
              uData.googlePhotoUrl ||
              uData.photoURL ||
              uData.customPhotoUrl;
            if (photo) {
              m.imageUrl = photo;
              setDoc(memberDoc(groupId, m.userId), { imageUrl: photo }, { merge: true }).catch(() => {});
            }
          }
        } catch {}
      })
    );
  }

  return members;
}

export async function joinGroup(
  joinCode: string,
  uid: string,
  userName: string,
  userPhotoUrl?: string
): Promise<Group> {
  const q = query(groupsCol(), where('joinCode', '==', joinCode.toUpperCase().trim()));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error('No group found with that join code.');

  const groupDocSnap = snap.docs[0];
  const groupData = groupDocSnap.data();
  if (groupData.isPersonal || groupData.type === 'personal') {
    throw new Error('This is a personal group and cannot be joined.');
  }
  const groupId = groupDocSnap.id;

  if (groupDocSnap.data().memberIds?.includes(uid)) {
    throw new Error('You are already a member of this group.');
  }

  await setDoc(memberDoc(groupId, uid), {
    userId: uid,
    userName,
    role: 'member' as MemberRole,
    imageUrl: userPhotoUrl || null,
    joinedAt: serverTimestamp(),
  });

  await updateDoc(groupDoc(groupId), { memberIds: arrayUnion(uid) });

  // In-app notification to existing members about newly joined member
  try {
    const existingMembers: string[] = groupDocSnap.data().memberIds || [];
    const targetUserIds = existingMembers.filter((m) => m !== uid);
    if (targetUserIds.length > 0) {
      dispatchNotificationEvent({
        type: 'member_joined',
        actor: { id: uid, name: userName },
        groupId,
        groupName: groupDocSnap.data().name,
        targetUserIds,
        params: {
          actorName: userName,
          groupName: groupDocSnap.data().name || 'group',
        },
        dedupeKey: `member_joined_${groupId}_${uid}`,
      }).catch(() => {});
    }
  } catch (e: any) {
    // Non-blocking
  }

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

export async function addMemberDirect(
  groupId: string,
  user: { uid: string; name: string; email?: string; photoUrl?: string },
  role: MemberRole = 'member'
): Promise<void> {
  const localGroup = await getLocalGroupById(groupId);
  if (localGroup?.type === 'personal' || localGroup?.isPersonal) {
    throw new Error('Cannot add members to a personal group.');
  }

  // 1. Immediately cache in SQLite
  await upsertRemoteMembers(groupId, [
    {
      userId: user.uid,
      userName: user.name,
      role,
      joinedAt: new Date(),
      imageUrl: user.photoUrl,
    },
  ]);

  // 2. Persist to Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await setDoc(
        memberDoc(groupId, user.uid),
        {
          userId: user.uid,
          userName: user.name,
          role,
          imageUrl: user.photoUrl || null,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await updateDoc(groupDoc(groupId), {
        memberIds: arrayUnion(user.uid),
      });

      // In-app notification to the invited/added member
      dispatchNotificationEvent({
        type: 'group_invitation',
        actor: { id: 'admin', name: 'Group Admin' },
        groupId,
        targetUserIds: [user.uid],
        params: {
          actorName: 'Group Admin',
          groupName: 'group',
        },
        dedupeKey: `group_invitation_${groupId}_${user.uid}`,
      }).catch(() => {});
    } catch (e: any) {
      console.warn('[addMemberDirect] remote add failed:', e?.message);
    }
  }
}

export async function transferOwnership(
  groupId: string,
  currentAdminUid: string,
  newAdminUid: string
): Promise<void> {
  if (networkMonitor.isCurrentlyOnline()) {
    await updateDoc(memberDoc(groupId, newAdminUid), { role: 'admin' });
    if (currentAdminUid !== newAdminUid) {
      await updateDoc(memberDoc(groupId, currentAdminUid), { role: 'member' });
    }
  }
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
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapGroup(d.id, d.data())));
    },
    (err) => {
      console.warn('[subscribeToGroups] snapshot notice:', err?.message || err);
    }
  );
}
