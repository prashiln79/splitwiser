import { auth, db } from '../config/firebase';
import { signOutNativeGoogle, getNativeGoogleUser } from './useGoogleAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
import { clearLocalData } from '../db/sqlite';
import {
  resolveProfilePicture,
  calculateGoogleSyncUpdates,
} from '../utils/profilePhotoHelper';

// ─── Root path ────────────────────────────────────────────────────────────────
// All Splitwiser data is nested under /splitwiser/data/...
// Users are stored at /splitwiser/data/users/{uid}
const usersPath = (uid: string) => doc(db, 'splitwiser', 'data', 'users', uid);
const groupsCol = () => collection(db, 'splitwiser', 'data', 'groups');

const ONBOARDING_COMPLETED_KEY = (uid: string) => `@splitwiser:onboarding_completed:${uid}`;

export async function markOnboardingCompleted(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY(uid), 'true');
    await setDoc(usersPath(uid), { onboardingCompleted: true, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn('[auth] markOnboardingCompleted notice:', e);
  }
}

export async function isOnboardingCompleted(uid: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY(uid));
    if (val === 'true') return true;
  } catch {}
  return false;
}

/**
 * Sign in as Guest using Firebase Anonymous Authentication.
 * Preserves existing anonymous session if already active.
 */
export async function signInAsGuest(): Promise<AppUser> {
  let credentialUser: FirebaseUser;

  if (auth.currentUser && auth.currentUser.isAnonymous) {
    credentialUser = auth.currentUser;
  } else {
    const credential = await signInAnonymously(auth);
    credentialUser = credential.user;
  }

  const { uid } = credentialUser;
  const existing = await loadUserProfile(uid);
  if (existing) return existing;

  const now = new Date();
  const profile: AppUser = {
    uid,
    name: '',
    createdAt: now,
    isAnonymous: true,
    authProvider: 'anonymous',
    hasCompletedProfile: false,
    onboardingCompleted: false,
  };

  await setDoc(usersPath(uid), {
    uid,
    name: '',
    createdAt: serverTimestamp(),
    isAnonymous: true,
    authProvider: 'anonymous',
    hasCompletedProfile: false,
    onboardingCompleted: false,
  });

  return profile;
}

/**
 * Register with Email and Password.
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  name?: string
): Promise<AppUser> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const { uid } = credential.user;
  const now = new Date();
  const displayName = (name || '').trim();

  const profile: AppUser = {
    uid,
    name: displayName,
    email: email.trim(),
    createdAt: now,
    isAnonymous: false,
    authProvider: 'password',
    hasCompletedProfile: Boolean(displayName),
    onboardingCompleted: false,
  };

  await setDoc(usersPath(uid), {
    uid,
    name: displayName,
    email: email.trim(),
    createdAt: serverTimestamp(),
    isAnonymous: false,
    authProvider: 'password',
    hasCompletedProfile: Boolean(displayName),
    onboardingCompleted: false,
  });

  return profile;
}

/**
 * Sign in with Email and Password.
 */
export async function signInWithEmail(
  email: string,
  pass: string
): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const { uid } = credential.user;
  let profile = await loadUserProfile(uid);

  if (!profile) {
    profile = {
      uid,
      name: credential.user.displayName || '',
      email: credential.user.email || email.trim(),
      createdAt: new Date(),
      isAnonymous: false,
      authProvider: 'password',
      hasCompletedProfile: Boolean(credential.user.displayName),
      onboardingCompleted: true,
    };
    await setDoc(usersPath(uid), {
      uid,
      name: profile.name,
      email: profile.email,
      createdAt: serverTimestamp(),
      isAnonymous: false,
      authProvider: 'password',
      hasCompletedProfile: profile.hasCompletedProfile,
      onboardingCompleted: true,
    });
  }

  return profile;
}

/**
 * Complete profile setup (display name, avatar, currency).
 */
export async function completeProfileSetup(
  uid: string,
  data: { name: string; avatarUrl?: string; currency?: string }
): Promise<AppUser> {
  const updates: Record<string, any> = {
    name: data.name.trim(),
    hasCompletedProfile: true,
    updatedAt: serverTimestamp(),
  };

  if (data.avatarUrl) {
    updates.imageUrl = data.avatarUrl;
    updates.customPhotoUrl = data.avatarUrl;
    updates.photoSource = 'custom';
  }

  if (data.currency) {
    updates.currency = data.currency;
  }

  await setDoc(usersPath(uid), updates, { merge: true });

  await updateLocalMemberProfile(uid, data.name.trim(), data.avatarUrl);
  updateUserAcrossGroups(uid, data.name.trim(), data.avatarUrl).catch(() => {});

  const updated = await loadUserProfile(uid);
  return updated || {
    uid,
    name: data.name.trim(),
    createdAt: new Date(),
    isAnonymous: auth.currentUser?.isAnonymous ?? true,
    imageUrl: data.avatarUrl,
    currency: data.currency || 'INR',
    hasCompletedProfile: true,
  };
}

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
    hasCompletedProfile: true,
    onboardingCompleted: false,
  };

  await setDoc(usersPath(uid), {
    uid,
    name: profile.name,
    createdAt: serverTimestamp(),
    isAnonymous: true,
    authProvider: 'anonymous',
    hasCompletedProfile: true,
    onboardingCompleted: false,
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
  const localOnboardingDone = await isOnboardingCompleted(uid);
  const hasCompletedProfile = data.hasCompletedProfile !== undefined
    ? Boolean(data.hasCompletedProfile)
    : Boolean(data.name && data.name.trim() !== '' && data.name !== 'Anonymous User');

  const onboardingCompleted = data.onboardingCompleted !== undefined
    ? Boolean(data.onboardingCompleted)
    : (localOnboardingDone || (hasCompletedProfile && Boolean(data.createdAt)));

  const rawUser: AppUser = {
    uid,
    name: data.name ?? 'Anonymous User',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    isAnonymous: data.isAnonymous ?? true,
    customPhotoUrl: data.customPhotoUrl || undefined,
    googlePhotoUrl: data.googlePhotoUrl || undefined,
    photoSource: data.photoSource || undefined,
    imageUrl: data.imageUrl || data.photoURL || undefined,
    email: data.email,
    photoURL: data.photoURL,
    authProvider: data.authProvider,
    updatedAt: data.updatedAt?.toDate?.(),
    accountLinkedAt: data.accountLinkedAt?.toDate?.(),
    phone: data.phone,
    currency: data.currency,
    timezone: data.timezone,
    language: data.language,
    onboardingCompleted,
    hasCompletedProfile,
  };

  const { displayUrl, source } = resolveProfilePicture(rawUser);

  return {
    ...rawUser,
    imageUrl: displayUrl || undefined,
    photoSource: rawUser.photoSource || source,
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
  accessToken?: string,
  nativePhotoUrl?: string | null,
  nativeDisplayName?: string | null,
  nativeEmail?: string | null
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

  // Retrieve provider-specific Google photo and display name
  const googleProvider = linkedFirebaseUser.providerData?.find(
    (p) => p.providerId === 'google.com'
  );
  let googlePhoto =
    googleProvider?.photoURL ||
    nativePhotoUrl ||
    linkedFirebaseUser.photoURL ||
    null;
  let googleDisplayName =
    linkedFirebaseUser.displayName ||
    nativeDisplayName ||
    googleProvider?.displayName ||
    null;
  let googleEmail =
    linkedFirebaseUser.email ||
    nativeEmail ||
    googleProvider?.email ||
    null;

  if (!googlePhoto || !googleEmail) {
    try {
      const nativeGoogle = await getNativeGoogleUser();
      if (nativeGoogle) {
        if (!googlePhoto && nativeGoogle.photo) googlePhoto = nativeGoogle.photo;
        if (!googleDisplayName && nativeGoogle.name) googleDisplayName = nativeGoogle.name;
        if (!googleEmail && nativeGoogle.email) googleEmail = nativeGoogle.email;
      }
    } catch {}
  }

  // Check existing profile to guarantee we never overwrite a manually uploaded custom picture!
  const existingProfile = await loadUserProfile(linkedFirebaseUser.uid);
  const sync = calculateGoogleSyncUpdates(
    existingProfile,
    googlePhoto,
    googleDisplayName,
    googleEmail
  );

  // Update Firestore user document with Google profile information
  const now = serverTimestamp();
  const updates: Record<string, any> = {
    uid: linkedFirebaseUser.uid,
    isAnonymous: false,
    authProvider: 'google',
    accountLinkedAt: now,
    updatedAt: now,
    ...sync.updates,
  };

  if (googlePhoto) {
    updates.googlePhotoUrl = googlePhoto;
    updates.photoURL = googlePhoto;
    const isCustomActive = existingProfile?.photoSource === 'custom' && existingProfile?.customPhotoUrl;
    if (!isCustomActive) {
      updates.imageUrl = googlePhoto;
      updates.photoSource = 'google';
    }
  }

  if (googleEmail) {
    updates.email = googleEmail;
  }

  await setDoc(usersPath(linkedFirebaseUser.uid), updates, { merge: true });

  const refreshedProfile = await loadUserProfile(linkedFirebaseUser.uid);

  // Propagate name and image across groups
  if (refreshedProfile) {
    await updateLocalMemberProfile(
      refreshedProfile.uid,
      refreshedProfile.name,
      refreshedProfile.imageUrl
    );
    await updateUserAcrossGroups(
      refreshedProfile.uid,
      refreshedProfile.name,
      refreshedProfile.imageUrl
    ).catch(() => {});
  }

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
  accessToken?: string,
  nativePhotoUrl?: string | null,
  nativeDisplayName?: string | null,
  nativeEmail?: string | null
): Promise<AppUser> {
  const currentUser = auth.currentUser;

  // If there is an active anonymous session, link the Google credentials directly to preserve the UID!
  if (currentUser && currentUser.isAnonymous) {
    try {
      const { user } = await linkGoogleCredential(
        idToken,
        accessToken,
        nativePhotoUrl,
        nativeDisplayName,
        nativeEmail
      );
      return user;
    } catch (linkError: any) {
      if (linkError?.code === 'auth/credential-already-in-use') {
        // The Google account is already registered as a separate Firebase user.
        // Migrate all groups, expenses, and splits from the anonymous account to the Google account.
        return await migrateAnonymousDataToExistingGoogleAccount(
          currentUser.uid,
          idToken,
          accessToken,
          nativePhotoUrl,
          nativeDisplayName,
          nativeEmail
        );
      }
      throw linkError;
    }
  }

  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const userCredential = await signInWithCredential(auth, credential);
  const googleUser = userCredential.user;

  // Retrieve provider-specific Google photo and display name
  const googleProvider = googleUser.providerData?.find((p) => p.providerId === 'google.com');
  let googlePhoto =
    googleProvider?.photoURL ||
    nativePhotoUrl ||
    googleUser.photoURL ||
    null;
  let googleDisplayName =
    googleUser.displayName ||
    nativeDisplayName ||
    googleProvider?.displayName ||
    null;
  let googleEmail =
    googleUser.email ||
    nativeEmail ||
    googleProvider?.email ||
    null;

  if (!googlePhoto || !googleEmail) {
    try {
      const nativeGoogle = await getNativeGoogleUser();
      if (nativeGoogle) {
        if (!googlePhoto && nativeGoogle.photo) googlePhoto = nativeGoogle.photo;
        if (!googleDisplayName && nativeGoogle.name) googleDisplayName = nativeGoogle.name;
        if (!googleEmail && nativeGoogle.email) googleEmail = nativeGoogle.email;
      }
    } catch {}
  }

  // Check if profile exists
  let profile = await loadUserProfile(googleUser.uid);
  if (!profile) {
    // Brand new Google user: initialize with Google profile picture as default
    const now = serverTimestamp();
    const newProfile = {
      uid: googleUser.uid,
      name: googleDisplayName || googleUser.displayName || 'Splitwiser User',
      email: googleEmail || googleUser.email || null,
      photoURL: googlePhoto,
      googlePhotoUrl: googlePhoto,
      photoSource: googlePhoto ? 'google' : 'none',
      imageUrl: googlePhoto,
      isAnonymous: false,
      authProvider: 'google',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(usersPath(googleUser.uid), newProfile);
    profile = await loadUserProfile(googleUser.uid);
    if (profile) {
      await updateLocalMemberProfile(profile.uid, profile.name, profile.imageUrl);
      await updateUserAcrossGroups(profile.uid, profile.name, profile.imageUrl).catch(() => {});
    }
  } else {
    // Existing user: check if Google profile changed externally, while strictly preserving any custom photo!
    const sync = calculateGoogleSyncUpdates(
      profile,
      googlePhoto,
      googleDisplayName || googleUser.displayName,
      googleEmail || googleUser.email
    );

    const isCustomActive = profile.photoSource === 'custom' && profile.customPhotoUrl;
    const needsPhotoFix =
      googlePhoto &&
      !isCustomActive &&
      (!profile.imageUrl || profile.imageUrl !== googlePhoto || profile.photoSource !== 'google');

    if (sync.hasChanges || needsPhotoFix) {
      const firestoreUpdates = {
        ...sync.updates,
        ...(needsPhotoFix
          ? {
              googlePhotoUrl: googlePhoto,
              imageUrl: googlePhoto,
              photoSource: 'google' as const,
              photoURL: googlePhoto,
            }
          : {}),
        ...(googleEmail && !profile.email ? { email: googleEmail } : {}),
      };
      await setDoc(
        usersPath(googleUser.uid),
        { ...firestoreUpdates, updatedAt: serverTimestamp() },
        { merge: true }
      );
      profile = await loadUserProfile(googleUser.uid);
      if (profile) {
        await updateLocalMemberProfile(profile.uid, profile.name, profile.imageUrl);
        await updateUserAcrossGroups(profile.uid, profile.name, profile.imageUrl).catch(() => {});
      }
    }
  }

  return (
    profile || {
      uid: googleUser.uid,
      name: googleDisplayName || googleUser.displayName || 'Splitwiser User',
      email: googleEmail || googleUser.email || undefined,
      photoURL: googlePhoto || googleUser.photoURL || undefined,
      imageUrl: googlePhoto || googleUser.photoURL || undefined,
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
  accessToken?: string,
  nativePhotoUrl?: string | null,
  nativeDisplayName?: string | null,
  nativeEmail?: string | null
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
  const googleProvider = userCredential.user.providerData?.find((p) => p.providerId === 'google.com');
  let googlePhoto =
    googleProvider?.photoURL ||
    nativePhotoUrl ||
    userCredential.user.photoURL ||
    null;
  let resolvedDisplayName =
    nativeDisplayName ||
    googleUserName ||
    googleProvider?.displayName ||
    null;
  let resolvedEmail =
    nativeEmail ||
    userCredential.user.email ||
    googleProvider?.email ||
    null;

  if (!googlePhoto || !resolvedEmail) {
    try {
      const nativeGoogle = await getNativeGoogleUser();
      if (nativeGoogle) {
        if (!googlePhoto && nativeGoogle.photo) googlePhoto = nativeGoogle.photo;
        if (!resolvedDisplayName && nativeGoogle.name) resolvedDisplayName = nativeGoogle.name;
        if (!resolvedEmail && nativeGoogle.email) resolvedEmail = nativeGoogle.email;
      }
    } catch {}
  }

  if (!profile) {
    const now = serverTimestamp();
    const newProfile = {
      uid: googleUid,
      name: resolvedDisplayName || 'Splitwiser User',
      email: resolvedEmail || null,
      photoURL: googlePhoto,
      googlePhotoUrl: googlePhoto,
      photoSource: googlePhoto ? 'google' : 'none',
      imageUrl: googlePhoto,
      isAnonymous: false,
      authProvider: 'google',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(usersPath(googleUid), newProfile);
    profile = await loadUserProfile(googleUid);
    if (profile) {
      await updateLocalMemberProfile(profile.uid, profile.name, profile.imageUrl);
      await updateUserAcrossGroups(profile.uid, profile.name, profile.imageUrl).catch(() => {});
    }
  } else {
    // Preserve customPhotoUrl if present
    const sync = calculateGoogleSyncUpdates(
      profile,
      googlePhoto,
      resolvedDisplayName || googleUserName,
      resolvedEmail || userCredential.user.email
    );

    const isCustomActive = profile.photoSource === 'custom' && profile.customPhotoUrl;
    const needsPhotoFix =
      googlePhoto &&
      !isCustomActive &&
      (!profile.imageUrl || profile.imageUrl !== googlePhoto || profile.photoSource !== 'google');

    if (sync.hasChanges || needsPhotoFix) {
      const firestoreUpdates = {
        ...sync.updates,
        ...(needsPhotoFix
          ? {
              googlePhotoUrl: googlePhoto,
              imageUrl: googlePhoto,
              photoSource: 'google' as const,
              photoURL: googlePhoto,
            }
          : {}),
        ...(resolvedEmail && !profile.email ? { email: resolvedEmail } : {}),
      };
      await setDoc(
        usersPath(googleUid),
        { ...firestoreUpdates, updatedAt: serverTimestamp() },
        { merge: true }
      );
      profile = await loadUserProfile(googleUid);
      if (profile) {
        await updateLocalMemberProfile(profile.uid, profile.name, profile.imageUrl);
        await updateUserAcrossGroups(profile.uid, profile.name, profile.imageUrl).catch(() => {});
      }
    }
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
  try {
    await clearLocalData();
  } catch (err) {
    console.warn('[signOutUser] Failed to clear local SQLite data:', err);
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

/**
 * Automatically synchronizes Google account profile picture on auth refresh without
 * ever overwriting a user's manually uploaded custom picture.
 */
export async function syncGoogleProfileOnAuth(
  firebaseUser: FirebaseUser
): Promise<AppUser | null> {
  const profile = await loadUserProfile(firebaseUser.uid);
  if (!profile) return null;

  const isGoogle =
    profile.authProvider === 'google' ||
    firebaseUser.providerData?.some((p) => p.providerId === 'google.com');

  if (isGoogle) {
    const googleProvider = firebaseUser.providerData.find((p) => p.providerId === 'google.com');
    let googlePhoto = googleProvider?.photoURL || firebaseUser.photoURL || null;
    let googleDisplayName = firebaseUser.displayName || googleProvider?.displayName || null;
    let googleEmail = firebaseUser.email || googleProvider?.email || null;

    if (!googlePhoto || !googleEmail) {
      try {
        const nativeGoogle = await getNativeGoogleUser();
        if (nativeGoogle) {
          if (!googlePhoto && nativeGoogle.photo) googlePhoto = nativeGoogle.photo;
          if (!googleDisplayName && nativeGoogle.name) googleDisplayName = nativeGoogle.name;
          if (!googleEmail && nativeGoogle.email) googleEmail = nativeGoogle.email;
        }
      } catch {}
    }

    const sync = calculateGoogleSyncUpdates(
      profile,
      googlePhoto,
      googleDisplayName,
      googleEmail
    );

    // Also force-fix if googlePhoto exists and imageUrl/photoSource need to be set
    const isCustomActive = profile.photoSource === 'custom' && profile.customPhotoUrl;
    const needsPhotoFix =
      googlePhoto &&
      !isCustomActive &&
      (!profile.imageUrl || profile.imageUrl !== googlePhoto || profile.photoSource !== 'google');

    if (sync.hasChanges || needsPhotoFix) {
      const firestoreUpdates = {
        ...sync.updates,
        ...(needsPhotoFix
          ? {
              googlePhotoUrl: googlePhoto,
              imageUrl: googlePhoto,
              photoSource: 'google' as const,
              photoURL: googlePhoto,
            }
          : {}),
        ...(googleEmail && !profile.email ? { email: googleEmail } : {}),
      };
      await setDoc(
        usersPath(firebaseUser.uid),
        { ...firestoreUpdates, updatedAt: serverTimestamp() },
        { merge: true }
      );
      const updated = await loadUserProfile(firebaseUser.uid);
      if (updated) {
        await updateLocalMemberProfile(updated.uid, updated.name, updated.imageUrl);
        await updateUserAcrossGroups(updated.uid, updated.name, updated.imageUrl).catch(() => {});
        return updated;
      }
    }
  }

  return profile;
}
