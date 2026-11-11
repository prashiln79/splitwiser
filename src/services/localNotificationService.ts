import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InAppNotification } from '../types/notifications';
import i18n from '../i18n';

let Notifications: any = null;

try {
  Notifications = require('expo-notifications');
} catch (err) {
  console.warn('[localNotificationService] expo-notifications not available:', err);
}

// ─── Initialize Local Notification Configuration ──────────────────────────────
/**
 * Sets up notification handler and Android channel.
 * Safe to call at app startup — does NOT request OS permission.
 * Permission is requested separately via requestNotificationPermission()
 * which should only be called after the user has completed onboarding and
 * reached Groups Home, or when they first open the notification center.
 */
export async function initLocalNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    // 1. Set notification presentation handler so local alerts show in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // 2. Set Android Notification Channel (required BEFORE any notification can appear)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Splitwiser Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // NOTE: Permission is NOT requested here.
    // Call requestNotificationPermission() after onboarding is complete.
  } catch (e: any) {
    console.warn('[initLocalNotifications] Setup notice:', e?.message);
  }
}

/**
 * Request OS notification permission.
 * Call this AFTER the user has completed onboarding and landed on Groups Home,
 * or when the user first opens the Notification Center.
 * Never call during onboarding screens.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e: any) {
    console.warn('[requestNotificationPermission] notice:', e?.message);
    return false;
  }
}

import {
  updateMemberNameCache,
  globalMemberNameCache,
  resolveNotificationDisplay,
} from '../utils/notificationUtils';

export {
  updateMemberNameCache,
  globalMemberNameCache,
  resolveNotificationDisplay,
};

// ─── Track Notified IDs to Prevent Spam / Duplicate Alerts ────────────────────
const NOTIFIED_IDS_KEY = '@splitwiser:notified_notification_ids';
let notifiedIdsCache: Set<string> | null = null;

export async function getNotifiedIds(): Promise<Set<string>> {
  if (notifiedIdsCache) return notifiedIdsCache;
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      notifiedIdsCache = new Set(Array.isArray(arr) ? arr : []);
    } else {
      notifiedIdsCache = new Set();
    }
  } catch {
    notifiedIdsCache = new Set();
  }
  return notifiedIdsCache;
}

export async function markAsNotified(notificationId: string): Promise<void> {
  const ids = await getNotifiedIds();
  ids.add(notificationId);
  // Keep the most recent 200 IDs to avoid unbounded memory growth
  const arr = Array.from(ids).slice(-200);
  notifiedIdsCache = new Set(arr);
  try {
    await AsyncStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(arr));
  } catch {}
}

export async function isAlreadyNotified(notificationId: string): Promise<boolean> {
  const ids = await getNotifiedIds();
  return ids.has(notificationId);
}

// ─── Trigger Native Local OS Notification ─────────────────────────────────────
export async function triggerLocalNotification(notif: InAppNotification): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    const { title, body } = resolveNotificationDisplay(notif);

    await Notifications.scheduleNotificationAsync({
      identifier: notif.id,
      content: {
        title,
        body,
        data: {
          notificationId: notif.id,
          groupId: notif.groupId,
          expenseId: notif.expenseId,
          settlementId: notif.settlementId,
          type: notif.type,
        },
        sound: 'default',
        channelId: 'default',
        badge: 1,
      },
      trigger: null, // null means trigger immediately
    });

    await markAsNotified(notif.id);
  } catch (err: any) {
    console.warn('[triggerLocalNotification] Failed to present notification:', err?.message);
  }
}

// ─── Trigger All Pending Unread Notifications (On App Open / Resume) ───────────
export async function triggerPendingLocalNotifications(
  notifications: InAppNotification[]
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications || !Array.isArray(notifications)) return;

  try {
    const ids = await getNotifiedIds();

    // Filter unread and non-archived notifications that have not been delivered to OS tray
    const unnotified: InAppNotification[] = [];
    for (const n of notifications) {
      if (!n.readAt && !n.archivedAt && !ids.has(n.id)) {
        unnotified.push(n);
      }
    }

    if (unnotified.length === 0) return;

    // Cap at most recent 10 to avoid notification flood
    const toFire = unnotified.slice(0, 10);

    // Reverse so older transactions are posted first, leaving newest at the top of the notification shade
    toFire.reverse();

    for (const notif of toFire) {
      await triggerLocalNotification(notif);
      if (toFire.length > 1) {
        // 200ms spacing ensures Android notification manager processes and vibrates/alerts each one cleanly
        await new Promise((resolve) => setTimeout(() => resolve(undefined), 200));
      }
    }
  } catch (err: any) {
    console.warn('[triggerPendingLocalNotifications] Error:', err?.message);
  }
}

// ─── Dismiss Local OS Notification When Read in App ───────────────────────────
export async function dismissLocalNotification(id: string): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch {}
}

export async function dismissAllLocalNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}

// ─── Listen for User Taps on Local OS Notifications ───────────────────────────
export function attachNotificationResponseListener(
  onNotificationSelected: (data: any) => void
): () => void {
  if (Platform.OS === 'web' || !Notifications) return () => {};

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data) {
        onNotificationSelected(data);
      }
    });

    return () => {
      subscription.remove();
    };
  } catch (err: any) {
    console.warn('[attachNotificationResponseListener] Failed to attach listener:', err?.message);
    return () => {};
  }
}

