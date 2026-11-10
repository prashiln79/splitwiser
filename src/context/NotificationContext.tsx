import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import {
  InAppNotification,
  NotificationSummary,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../types/notifications';
import {
  getUserNotifications,
  subscribeToNotificationSummary,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  reconcileUnreadCount,
} from '../services/notificationService';
import { triggerLocalNotification } from '../services/localNotificationService';

interface NotificationContextType {
  notifications: InAppNotification[];
  unreadCount: number;
  activeBanner: InAppNotification | null;
  preferences: NotificationPreferences;
  isLoading: boolean;
  hasMore: boolean;
  dismissBanner: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeBanner, setActiveBanner] = useState<InAppNotification | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const lastDocRef = useRef<any>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerQueueRef = useRef<InAppNotification[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

  // ─── Dismiss Active Banner ──────────────────────────────────────────────────
  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setActiveBanner(null);

    // Process next queued banner if any
    if (bannerQueueRef.current.length > 0) {
      const next = bannerQueueRef.current.shift()!;
      setTimeout(() => {
        setActiveBanner(next);
        bannerTimerRef.current = setTimeout(() => {
          dismissBanner();
        }, 4500);
      }, 300);
    }
  }, []);

  // ─── Trigger In-App Toast Banner ───────────────────────────────────────────
  const showBanner = useCallback(
    (item: InAppNotification) => {
      if (!preferences.inAppBanners) return;

      if (!activeBanner) {
        setActiveBanner(item);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => {
          dismissBanner();
        }, 4500);
      } else {
        // Queue banner (limit max 3 queued items)
        if (bannerQueueRef.current.length < 3) {
          bannerQueueRef.current.push(item);
        }
      }
    },
    [activeBanner, preferences.inAppBanners, dismissBanner]
  );

  // ─── Initial Load & Refresh ────────────────────────────────────────────────
  const refreshNotifications = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const [res, prefs] = await Promise.all([
        getUserNotifications(user.uid, 20),
        getNotificationPreferences(user.uid),
      ]);
      setNotifications(res.notifications);
      lastDocRef.current = res.lastVisible;
      setHasMore(res.hasMore);
      setPreferences(prefs);
    } catch (e) {
      console.warn('[NotificationContext] Refresh error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  // ─── Load More Notifications (Pagination) ──────────────────────────────────
  const loadMoreNotifications = useCallback(async () => {
    if (!user?.uid || !hasMore || isLoading || !lastDocRef.current) return;
    try {
      const res = await getUserNotifications(user.uid, 20, lastDocRef.current);
      setNotifications((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        const newItems = res.notifications.filter((n) => !ids.has(n.id));
        return [...prev, ...newItems];
      });
      lastDocRef.current = res.lastVisible;
      setHasMore(res.hasMore);
    } catch (e) {
      console.warn('[NotificationContext] Load more error:', e);
    }
  }, [user?.uid, hasMore, isLoading]);

  // ─── Action Handlers ────────────────────────────────────────────────────────
  const handleMarkAsRead = useCallback(
    async (id: string) => {
      if (!user?.uid) return;
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: new Date() } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationAsRead(user.uid, id);
    },
    [user?.uid]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user?.uid) return;
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, readAt: item.readAt || new Date() }))
    );
    setUnreadCount(0);
    await markAllNotificationsAsRead(user.uid);
  }, [user?.uid]);

  const handleArchive = useCallback(
    async (id: string) => {
      if (!user?.uid) return;
      const target = notifications.find((n) => n.id === id);
      if (target && !target.readAt) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      await archiveNotification(user.uid, id);
    },
    [user?.uid, notifications]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!user?.uid) return;
      const target = notifications.find((n) => n.id === id);
      if (target && !target.readAt) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      await deleteNotification(user.uid, id);
    },
    [user?.uid, notifications]
  );

  const handleUpdatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!user?.uid) return;
      const updated = await updateNotificationPreferences(user.uid, updates);
      setPreferences(updated);
    },
    [user?.uid]
  );

  // ─── Real-Time Listeners & App Lifecycle Sync ──────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setActiveBanner(null);
      bannerQueueRef.current = [];
      setIsLoading(false);
      return;
    }

    refreshNotifications();

    // 1. Subscribe to atomic summary doc (unread badge count)
    const unsubSummary = subscribeToNotificationSummary(user.uid, (summary: NotificationSummary) => {
      setUnreadCount(summary.unreadCount);
    });

    // 2. Subscribe to new incoming notifications for in-app banner
    const unsubStream = subscribeToUserNotifications(
      user.uid,
      (newNotif: InAppNotification) => {
        // Prepend to active list if not already present
        setNotifications((prev) => {
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });
        showBanner(newNotif);
        triggerLocalNotification(newNotif).catch(() => {});
      },
      (modifiedNotif: InAppNotification) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === modifiedNotif.id ? modifiedNotif : n))
        );
      },
      (removedId: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== removedId));
      }
    );

    // 3. App State listener: sync missed notifications on resume
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App returned to foreground: refresh and reconcile
        refreshNotifications();
        reconcileUnreadCount(user.uid);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      unsubSummary();
      unsubStream();
      appStateSub.remove();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [user?.uid, refreshNotifications, showBanner]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeBanner,
        preferences,
        isLoading,
        hasMore,
        dismissBanner,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
        archiveNotification: handleArchive,
        deleteNotification: handleDelete,
        refreshNotifications,
        loadMoreNotifications,
        updatePreferences: handleUpdatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
