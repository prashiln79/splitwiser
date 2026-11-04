import { auth, db } from '../config/firebase';
import {
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { AppUser } from '../types';

// ─── Root path ────────────────────────────────────────────────────────────────
// All Splitwiser data is nested under /splitwiser/data/...
// Users are stored at /splitwiser/data/users/{uid}
const usersPath = (uid: string) => doc(db, 'splitwiser', 'data', 'users', uid);

/**
 * Sign in anonymously and create a Firestore user profile.
 */
export async function signInAndCreateProfile(name: string): Promise<AppUser> {
  const credential = await signInAnonymously(auth);
  const { uid } = credential.user;

  const profile: AppUser = {
    uid,
    name: name.trim(),
    createdAt: new Date(),
    isAnonymous: true,
  };

  await setDoc(usersPath(uid), {
    name: profile.name,
    createdAt: serverTimestamp(),
    isAnonymous: true,
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
    name: data.name ?? 'Anonymous',
    createdAt: data.createdAt?.toDate() ?? new Date(),
    isAnonymous: data.isAnonymous ?? true,
    imageUrl: data.imageUrl,
  };
}

/**
 * Update display name / imageUrl in Firestore user profile.
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<AppUser, 'name' | 'imageUrl'>>
): Promise<void> {
  await setDoc(usersPath(uid), updates, { merge: true });
}

/**
 * Subscribe to Firebase Auth state changes.
 */
export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
