import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { GroupActivity } from '../types';
import { networkMonitor } from '../sync/networkMonitor';

const activitiesCol = (groupId: string) =>
  collection(db, 'splitwiser', 'data', 'groups', groupId, 'activities');

const getLocalActivityKey = (groupId: string) => `@splitwiser_activities_${groupId}`;

export async function logGroupActivity(
  groupId: string,
  actor: { id: string; name: string },
  action: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const newActivity: GroupActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    groupId,
    actorId: actor.id,
    actorName: actor.name || 'Group member',
    action,
    description,
    metadata,
    createdAt: new Date(),
  };

  // 1. Immediately cache locally in AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(getLocalActivityKey(groupId));
    const cached: GroupActivity[] = raw ? JSON.parse(raw) : [];
    cached.unshift(newActivity);
    // Keep max 50 recent activities locally
    await AsyncStorage.setItem(getLocalActivityKey(groupId), JSON.stringify(cached.slice(0, 50)));
  } catch (e) {
    console.warn('[logGroupActivity] local cache error:', e);
  }

  // 2. Persist to Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      await addDoc(activitiesCol(groupId), {
        groupId,
        actorId: actor.id,
        actorName: actor.name || 'Group member',
        action,
        description,
        metadata: metadata || null,
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.warn('[logGroupActivity] remote persist error:', e?.message);
    }
  }
}

export async function getGroupActivities(groupId: string): Promise<GroupActivity[]> {
  // 1. Read from local cache first for instant response
  let localActivities: GroupActivity[] = [];
  try {
    const raw = await AsyncStorage.getItem(getLocalActivityKey(groupId));
    if (raw) {
      const parsed = JSON.parse(raw);
      localActivities = parsed.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    }
  } catch (e) {
    console.warn('[getGroupActivities] local read error:', e);
  }

  // 2. Fetch fresh from Firestore if online
  if (networkMonitor.isCurrentlyOnline()) {
    try {
      const q = query(activitiesCol(groupId), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      const remoteActivities: GroupActivity[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          groupId,
          actorId: data.actorId || '',
          actorName: data.actorName || 'Group member',
          action: data.action || '',
          description: data.description || '',
          metadata: data.metadata || undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        };
      });

      if (remoteActivities.length > 0) {
        await AsyncStorage.setItem(getLocalActivityKey(groupId), JSON.stringify(remoteActivities));
        return remoteActivities;
      }
    } catch (e: any) {
      console.warn('[getGroupActivities] remote fetch error:', e?.message);
    }
  }

  return localActivities;
}

