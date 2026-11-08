import { auth, db } from '../config/firebase';
import { signOutNativeGoogle } from './useGoogleAuth';
import {
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { AppUser } from '../types';
import { updateLocalMemberProfile } from '../repositories/groupRepository';
import { updateUserAcrossGroups } from './groups';
import { syncQueue } from '../sync/syncQueue';

// ─── Root path ────────────────────────────────────────────────────────────────
// All Splitwiser data is nested under /splitwiser/data/...
// Users are stored at /splitwiser/data/users/{uid}
const usersPath = (uid: string) => doc(db, 'splitwiser', 'data', 'users', uid);
const groupsCol = () => collection(db, 'splitwiser', 'data', 'groups');

/**
 * Sign in anonymously and create a Firestore user profile.
 */
export async function signInAndCreateProfile(name: string): Promise<AppUser> {
  const credential = await signInAnonymously(auth);
  const { uid } = credential.user;
  const now = new Date();

  const profile: AppUser = {
    uid,
    name: name.trim(),
    createdAt: now,
    isAnonymous: true,
    authProvider: 'anonymous',
  };

  await setDoc(usersPath(uid), {
    uid,
    name: profile.name,
    createdAt: serverTimestamp(),
    isAnonymous: true,
    authProvider: 'anonymous',
  });

  return profile;
}

/**
 * Load the Firestore user profile for a given Firebase UID.
 */
export async function loadUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(usersPath(uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    uid,
    name: data.name ?? 'Anonymous User',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    isAnonymous: data.isAnonymous ?? true,
    imageUrl: data.imageUrl || data.photoURL,
    email: data.email,
    photoURL: data.photoURL,
    authProvider: data.authProvider,
    updatedAt: data.updatedAt?.toDate?.(),
    accountLinkedAt: data.accountLinkedAt?.toDate?.(),
  };
}

/**
 * Update display name / imageUrl in Firestore user profile, SQLite groups, and Firestore groups.
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<AppUser>
): Promise<void> {
  // 1. Update user document in Firestore
  try {
    await setDoc(
      usersPath(uid),
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e: any) {
    console.warn('[updateUserProfile] Firestore user doc update warning:', e?.message);
  }

  // 2. Immediately update local SQLite group memberships so all local views show the new name
  if (updates.name || updates.imageUrl !== undefined) {
    await updateLocalMemberProfile(uid, updates.name, updates.imageUrl);
  }

  // 3. Update all groups in Firestore where this user is a member
  if (updates.name || updates.imageUrl !== undefined) {
    try {
      await updateUserAcrossGroups(uid, updates.name, updates.imageUrl);
    } catch {
      // If offline, enqueue sync operation to sync when back online
      await syncQueue.enqueue('user', uid, 'UPDATE_USER_PROFILE', {
        uid,
        name: updates.name,
        imageUrl: updates.imageUrl,
      });
    }
  }
}

/**
 * Link an existing anonymous account with a Google credential.
 * CRITICAL: The existing Firebase UID remains exactly the same!
 */
export async function linkGoogleCredential(
  idToken: string,
  accessToken?: string
): Promise<{ user: AppUser; isSameUid: boolean }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No active user session to link.');
  }

  const prevUid = currentUser.uid;
  const credential = GoogleAuthProvider.credential(idToken, accessToken);

  // Link credential directly to currentUser
  const userCredential = await linkWithCredential(currentUser, credential);
  const linkedFirebaseUser = userCredential.user;

  // Strict verification: Firebase UID must remain unchanged
  const isSameUid = linkedFirebaseUser.uid === prevUid;
  if (!isSameUid) {
    console.warn(
      `[Auth Linking] Warning: UID changed from ${prevUid} to ${linkedFirebaseUser.uid}`
    );
  }

  // Update Firestore user document with Google profile information
  const now = serverTimestamp();
  const updates: Record<string, any> = {
    uid: linkedFirebaseUser.uid,
    isAnonymous: false,
    authProvider: 'google',
    accountLinkedAt: now,
    updatedAt: now,
  };

  if (linkedFirebaseUser.email) {
    updates.email = linkedFirebaseUser.email;
  }
  if (linkedFirebaseUser.photoURL) {
    updates.photoURL = linkedFirebaseUser.photoURL;
    updates.imageUrl = linkedFirebaseUser.photoURL;
  }
  if (linkedFirebaseUser.displayName) {
    updates.name = linkedFirebaseUser.displayName;
    await updateLocalMemberProfile(
      linkedFirebaseUser.uid,
      linkedFirebaseUser.displayName,
      linkedFirebaseUser.photoURL || undefined
    );
    await updateUserAcrossGroups(
      linkedFirebaseUser.uid,
      linkedFirebaseUser.displayName,
      linkedFirebaseUser.photoURL || undefined
    ).catch(() => {});
  }

  await setDoc(usersPath(linkedFirebaseUser.uid), updates, { merge: true });

  const refreshedProfile = await loadUserProfile(linkedFirebaseUser.uid);
  return {
    user: refreshedProfile!,
    isSameUid,
  };
}

/**
 * Sign in using an existing Google account (or link if currently anonymous).
 * Preserves anonymous UID and data if the user is currently anonymous.
 */
export async function signInWithGoogleCredential(
  idToken: string,
  accessToken?: string
): Promise<AppUser> {
  const currentUser = auth.currentUser;

  // If there is an active anonymous session, link the Google credentials directly to preserve the UID!
  if (currentUser && currentUser.isAnonymous) {
    try {
      const { user } = await linkGoogleCredential(idToken, accessToken);
      return user;
    } catch (linkError: any) {
      if (linkError?.code === 'auth/credential-already-in-use') {
        // The Google account is already registered as a separate Firebase user.
        // Migrate all groups, expenses, and splits from the anonymous account to the Google account.
        return await migrateAnonymousDataToExistingGoogleAccount(
          currentUser.uid,
          idToken,
          accessToken
        );
      }
      throw linkError;
    }
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const userCredential = await signInWithCredential(auth, credential);
  const googleUser = userCredential.user;

  // Check if profile exists
  let profile = await loadUserProfile(googleUser.uid);
  if (!profile) {
    // Brand new Google user: create profile
    const now = serverTimestamp();
    const newProfile = {
      uid: googleUser.uid,
      name: googleUser.displayName || 'Splitwiser User',
      email: googleUser.email || null,
      photoURL: googleUser.photoURL || null,
      imageUrl: googleUser.photoURL || null,
      isAnonymous: false,
      authProvider: 'google',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(usersPath(googleUser.uid), newProfile);
    profile = await loadUserProfile(googleUser.uid);
  }

  return (
    profile || {
      uid: googleUser.uid,
      name: googleUser.displayName || 'Splitwiser User',
      email: googleUser.email || undefined,
      photoURL: googleUser.photoURL || undefined,
      imageUrl: googleUser.photoURL || undefined,
      isAnonymous: false,
      authProvider: 'google',
      createdAt: new Date(),
    }
  );
}

/**
 * Handle account conflict migration:
 * When an anonymous user links a Google account that already belongs to another Firebase user,
 * securely migrate groups, expenses, and memberships from the anonymous UID to the Google UID.
 */
export async function migrateAnonymousDataToExistingGoogleAccount(
  anonymousUid: string,
  idToken: string,
  accessToken?: string
): Promise<AppUser> {
  // 1. First, find all groups belonging to the anonymous user before switching accounts
  const q = query(groupsCol(), where('memberIds', 'array-contains', anonymousUid));
  const groupSnaps = await getDocs(q);

  // 2. Sign in to the existing Google account
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const userCredential = await signInWithCredential(auth, credential);
  const googleUid = userCredential.user.uid;
  const googleUserName = userCredential.user.displayName || 'Splitwiser User';

  // 3. Migrate group memberships, expenses, and settlements to the Google UID
  for (const groupDocSnap of groupSnaps.docs) {
    const groupId = groupDocSnap.id;
    const groupRef = doc(db, 'splitwiser', 'data', 'groups', groupId);
    const groupData = groupDocSnap.data();

    // Update memberIds array & createdBy in group doc
    const groupUpdates: Record<string, any> = {
      memberIds: arrayUnion(googleUid),
    };
    if (groupData.createdBy === anonymousUid) {
      groupUpdates.createdBy = googleUid;
    }
    await updateDoc(groupRef, groupUpdates);
    await updateDoc(groupRef, {
      memberIds: arrayRemove(anonymousUid),
    });

    // Transfer group member subcollection doc
    const anonMemberRef = doc(db, 'splitwiser', 'data', 'groups', groupId, 'members', anonymousUid);
    const anonMemberSnap = await getDoc(anonMemberRef);

    if (anonMemberSnap.exists()) {
      const memberData = anonMemberSnap.data();
      const googleMemberRef = doc(db, 'splitwiser', 'data', 'groups', groupId, 'members', googleUid);
      await setDoc(googleMemberRef, {
        userId: googleUid,
        userName: googleUserName,
        role: memberData.role || 'member',
        joinedAt: memberData.joinedAt || serverTimestamp(),
      });
      await deleteDoc(anonMemberRef);
    }

    // Migrate expenses in group
    const expensesColRef = collection(db, 'splitwiser', 'data', 'groups', groupId, 'expenses');
    const expensesSnap = await getDocs(expensesColRef);

    for (const expDoc of expensesSnap.docs) {
      const expData = expDoc.data();
      let needsUpdate = false;
      const updates: Record<string, any> = {};

      if (expData.paidBy === anonymousUid) {
        updates.paidBy = googleUid;
        needsUpdate = true;
      }
      if (expData.createdBy === anonymousUid) {
        updates.createdBy = googleUid;
        needsUpdate = true;
      }
      if (Array.isArray(expData.splits)) {
        const updatedSplits = expData.splits.map((s: any) =>
          s.userId === anonymousUid ? { ...s, userId: googleUid } : s
        );
        updates.splits = updatedSplits;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', expDoc.id), updates);
      }
    }

    // Migrate settlements in group
    const settlementsColRef = collection(db, 'splitwiser', 'data', 'groups', groupId, 'settlements');
    const settlementsSnap = await getDocs(settlementsColRef);

    for (const setDocSnap of settlementsSnap.docs) {
      const setData = setDocSnap.data();
      let needsUpdate = false;
      const updates: Record<string, any> = {};

      if (setData.fromUserId === anonymousUid) {
        updates.fromUserId = googleUid;
        updates.fromUserName = googleUserName;
        needsUpdate = true;
      }
      if (setData.toUserId === anonymousUid) {
        updates.toUserId = googleUid;
        updates.toUserName = googleUserName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(doc(db, 'splitwiser', 'data', 'groups', groupId, 'settlements', setDocSnap.id), updates);
      }
    }
  }

  // Load and return the Google user profile
  let profile = await loadUserProfile(googleUid);
  if (!profile) {
    const now = serverTimestamp();
    const newProfile = {
      uid: googleUid,
      name: googleUserName,
      email: userCredential.user.email || null,
      photoURL: userCredential.user.photoURL || null,
      imageUrl: userCredential.user.photoURL || null,
      isAnonymous: false,
      authProvider: 'google',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(usersPath(googleUid), newProfile);
    profile = await loadUserProfile(googleUid);
  }
  return profile!;
}

/**
 * Sign out current user.
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOutNativeGoogle();
  } catch (err) {
    console.warn('[signOutUser] Failed to sign out from native Google:', err);
  }
  await signOut(auth);
}

/**
 * Subscribe to Firebase Auth state changes.
 */
export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
