import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Friendship, AppUser } from '../types';
import { upsertRemoteFriendships } from '../repositories/friendRepository';

const friendshipsCol = () => collection(db, 'splitwiser', 'data', 'friendships');
const friendshipDoc = (id: string) => doc(db, 'splitwiser', 'data', 'friendships', id);
const usersCol = () => collection(db, 'splitwiser', 'data', 'users');

function mapFriendship(id: string, data: Record<string, any>, currentUserId: string): Friendship {
  const memberUids: string[] = data.memberUids || [];
  const otherUid = memberUids.find((uid) => uid !== currentUserId) || data.friendId || '';
  const names: Record<string, string> = data.names || {};

  return {
    id,
    userId: currentUserId,
    friendId: otherUid,
    friendName: names[otherUid] || data.friendName || 'Friend',
    friendEmail: data.emails?.[otherUid] || data.friendEmail,
    friendPhotoUrl: data.photos?.[otherUid] || data.friendPhotoUrl,
    status: data.status || 'accepted',
    initiatedBy: data.initiatedBy || currentUserId,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
  };
}

/**
 * Search users by email or name in Firestore (excluding the current user).
 */
export async function searchUsers(searchTerm: string, currentUserId: string): Promise<AppUser[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term || term.length < 2) return [];

  try {
    const q = query(usersCol());
    const snap = await getDocs(q);
    const results: AppUser[] = [];

    snap.forEach((d) => {
      if (d.id === currentUserId) return;
      const data = d.data();
      const name = (data.name || '').toLowerCase();
      const email = (data.email || '').toLowerCase();

      if (name.includes(term) || email.includes(term)) {
        results.push({
          uid: d.id,
          name: data.name || 'User',
          email: data.email,
          photoURL: data.photoURL,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          isAnonymous: Boolean(data.isAnonymous),
        });
      }
    });

    return results.slice(0, 10);
  } catch (err) {
    console.warn('[searchUsers] error:', err);
    return [];
  }
}

/**
 * Add a friend in Firestore and cache locally.
 */
export async function addFriendRemote(
  currentUserId: string,
  currentUserName: string,
  friendId: string,
  friendName: string,
  friendEmail?: string,
  friendPhotoUrl?: string
): Promise<Friendship> {
  // Canonical ID for friendship
  const sorted = [currentUserId, friendId].sort();
  const friendshipId = `friend_${sorted[0]}_${sorted[1]}`;

  const payload: any = {
    id: friendshipId,
    memberUids: [currentUserId, friendId],
    names: {
      [currentUserId]: currentUserName,
      [friendId]: friendName.trim(),
    },
    status: 'accepted',
    initiatedBy: currentUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (friendEmail) {
    payload.emails = { [friendId]: friendEmail.trim() };
  }
  if (friendPhotoUrl) {
    payload.photos = { [friendId]: friendPhotoUrl };
  }

  await setDoc(friendshipDoc(friendshipId), payload, { merge: true });

  const friendship: Friendship = {
    id: friendshipId,
    userId: currentUserId,
    friendId,
    friendName: friendName.trim(),
    friendEmail,
    friendPhotoUrl,
    status: 'accepted',
    initiatedBy: currentUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
  };

  await upsertRemoteFriendships([friendship]);
  return friendship;
}

/**
 * Remove friendship remotely.
 */
export async function removeFriendRemote(friendshipId: string): Promise<void> {
  await updateDoc(friendshipDoc(friendshipId), {
    status: 'removed',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Subscribe to real-time friendship changes for a user.
 */
export function subscribeToFriendships(
  userId: string,
  onUpdate: (friendships: Friendship[]) => void
): Unsubscribe {
  const q = query(
    friendshipsCol(),
    where('memberUids', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    async (snap) => {
      const friendships: Friendship[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== 'removed') {
          friendships.push(mapFriendship(docSnap.id, data, userId));
        }
      });

      await upsertRemoteFriendships(friendships);
      onUpdate(friendships);
    },
    (err) => {
      console.warn('[subscribeToFriendships] snapshot error:', err);
    }
  );
}

