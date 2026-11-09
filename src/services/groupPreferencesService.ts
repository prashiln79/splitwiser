import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GroupUserPreferences, DEFAULT_GROUP_PREFERENCES } from '../types';
import { networkMonitor } from '../sync/networkMonitor';

const getPrefStorageKey = (groupId: string, userId: string) =>
  `@splitwiser_group_pref_${groupId}_${userId}`;

const prefDoc = (groupId: string, userId: string) =>
  doc(db, 'splitwiser', 'data', 'groups', groupId, 'member_preferences', userId);

export { DEFAULT_GROUP_PREFERENCES };

export async function getGroupUserPreferences(
  groupId: string,
  userId: string
): Promise<GroupUserPreferences> {
  // 1. Instant local read from AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(getPrefStorageKey(groupId, userId));
    if (raw) {
      return { ...DEFAULT_GROUP_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('[getGroupUserPreferences] local read error:', e);
  }

  // 2. Fetch from Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      const snap = await getDoc(prefDoc(groupId, userId));
      if (snap.exists()) {
        const data = snap.data();
        const merged: GroupUserPreferences = {
          ...DEFAULT_GROUP_PREFERENCES,
          ...data,
          notifications: {
            ...DEFAULT_GROUP_PREFERENCES.notifications,
            ...(data.notifications || {}),
          },
        };
        await AsyncStorage.setItem(getPrefStorageKey(groupId, userId), JSON.stringify(merged));
        return merged;
      }
    } catch (e: any) {
      console.warn('[getGroupUserPreferences] remote read error:', e?.message);
    }
  }

  return DEFAULT_GROUP_PREFERENCES;
}

export async function updateGroupUserPreferences(
  groupId: string,
  userId: string,
  updates: Partial<GroupUserPreferences>
): Promise<GroupUserPreferences> {
  const current = await getGroupUserPreferences(groupId, userId);
  const updated: GroupUserPreferences = {
    ...current,
    ...updates,
    notifications: {
      ...current.notifications,
      ...(updates.notifications || {}),
    },
  };

  // 1. Save locally immediately
  try {
    await AsyncStorage.setItem(getPrefStorageKey(groupId, userId), JSON.stringify(updated));
  } catch (e) {
    console.warn('[updateGroupUserPreferences] local save error:', e);
  }

  // 2. Persist to Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await setDoc(prefDoc(groupId, userId), updated, { merge: true });
    } catch (e: any) {
      console.warn('[updateGroupUserPreferences] remote save error:', e?.message);
    }
  }

  return updated;
}
