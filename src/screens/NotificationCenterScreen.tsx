import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  CheckCheck,
  Receipt,
  CircleDollarSign,
  UserPlus,
  BellRing,
  MessageSquare,
  AlertCircle,
  Archive,
  Trash2,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import { InAppNotification, InAppNotificationType } from '../types/notifications';
import { resolveNotificationRoute } from '../services/notificationRouter';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { resolveNotificationDisplay } from '../services/localNotificationService';

type FilterTab = 'all' | 'unread' | 'expenses' | 'settlements';

interface GroupedNotifications {
  title: string;
  data: InAppNotification[];
}

const toDateSafe = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
};

export const NotificationCenterScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { t } = useTranslation(['notifications', 'common']);

  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    loadMoreNotifications,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedNotifForAction, setSelectedNotifForAction] = useState<InAppNotification | null>(null);

  // ─── Filter Notifications ──────────────────────────────────────────────────
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilter === 'unread') return !item.readAt;
      if (activeFilter === 'expenses') {
        return (
          item.type === 'expense_created' ||
          item.type === 'expense_updated' ||
          item.type === 'expense_deleted' ||
          item.type === 'expense_restored' ||
          item.type === 'expense_comment'
        );
      }
      if (activeFilter === 'settlements') {
        return (
          item.type === 'settlement_created' ||
          item.type === 'settlement_updated' ||
          item.type === 'settlement_deleted' ||
          item.type === 'payment_reminder' ||
          item.type === 'scheduled_reminder'
        );
      }
      return true;
    });
  }, [notifications, activeFilter]);

  // ─── Group Chronologically into Today, Yesterday, Earlier ──────────────────
  const groupedSections = useMemo((): GroupedNotifications[] => {
    const today: InAppNotification[] = [];
    const yesterday: InAppNotification[] = [];
    const earlier: InAppNotification[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

    filteredNotifications.forEach((item) => {
      const date = toDateSafe(item.createdAt);
      if (date >= startOfToday) {
        today.push(item);
      } else if (date >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    const sections: GroupedNotifications[] = [];
    if (today.length > 0) sections.push({ title: t('notifications:today', { defaultValue: 'Today' }), data: today });
    if (yesterday.length > 0) sections.push({ title: t('notifications:yesterday', { defaultValue: 'Yesterday' }), data: yesterday });
    if (earlier.length > 0) sections.push({ title: t('notifications:earlier', { defaultValue: 'Earlier' }), data: earlier });
    return sections;
  }, [filteredNotifications, t]);

  // ─── Flatten Grouped Sections for FlatList ─────────────────────────────────
  const flattenedData = useMemo(() => {
    const list: Array<{ type: 'header' | 'item'; title?: string; item?: InAppNotification; key: string }> = [];
    groupedSections.forEach((section) => {
      list.push({ type: 'header', title: section.title, key: `header_${section.title}` });
      section.data.forEach((item) => {
        list.push({ type: 'item', item, key: item.id });
      });
    });
    return list;
  }, [groupedSections]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refreshNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await markAllAsRead();
  };

  const handleItemPress = async (item: InAppNotification) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }

    if (!item.readAt) {
      await markAsRead(item.id);
    }

    const groupId = item.groupId || (item.params as any)?.groupId;
    const groupName = item.groupName || (item.params as any)?.groupName || 'Group';

    // If it is a transaction or group-related notification with a groupId, navigate directly to GroupDetails
    if (groupId) {
      try {
        (navigation as any).navigate('Main', {
          screen: 'Groups',
          params: {
            screen: 'GroupDetails',
            params: {
              groupId,
              groupName,
              highlightExpenseId: item.expenseId,
            },
          },
        });
        return;
      } catch (e: any) {
        console.warn('[NotificationCenterScreen] Navigation to GroupDetails failed:', e?.message);
      }
    }

    try {
      const target = await resolveNotificationRoute(item);
      if (target.unavailableNotice) {
        Alert.alert('Notice', target.unavailableNotice);
      }
      if (target.screen === 'GroupDetails' && target.params?.groupId) {
        (navigation as any).navigate('Main', {
          screen: 'Groups',
          params: {
            screen: 'GroupDetails',
            params: target.params,
          },
        });
      } else {
        navigation.navigate(target.screen, target.params);
      }
    } catch (e: any) {
      console.warn('[NotificationCenterScreen] Navigation failed:', e?.message);
    }
  };

  const handleItemLongPress = (item: InAppNotification) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const { title, body } = resolveNotificationDisplay(item);
    Alert.alert(
      title,
      body,
      [
        {
          text: !item.readAt
            ? t('notifications:markAsRead', { defaultValue: 'Mark as read' })
            : t('notifications:markAsUnread', { defaultValue: 'Mark as unread' }),
          onPress: () => markAsRead(item.id),
        },
        {
          text: t('notifications:archive', { defaultValue: 'Archive' }),
          onPress: () => archiveNotification(item.id),
        },
        {
          text: t('notifications:delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => deleteNotification(item.id),
        },
        {
          text: t('common:cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
      ]
    );
  };

  // ─── Event Icon & Palette ──────────────────────────────────────────────────
  const getEventBadge = (type: InAppNotificationType) => {
    switch (type) {
      case 'settlement_created':
      case 'settlement_updated':
        return {
          icon: <CircleDollarSign size={18} color={isDark ? '#34D399' : '#059669'} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
        };
      case 'expense_deleted':
      case 'settlement_deleted':
      case 'member_removed':
        return {
          icon: <AlertCircle size={18} color={isDark ? '#F87171' : '#DC2626'} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2',
        };
      case 'payment_reminder':
      case 'scheduled_reminder':
        return {
          icon: <BellRing size={18} color={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FFFBEB',
        };
      case 'group_invitation':
      case 'member_joined':
        return {
          icon: <UserPlus size={18} color={isDark ? '#A78BFA' : '#7C3AED'} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(124, 58, 237, 0.2)' : '#F5F3FF',
        };
      case 'expense_comment':
      case 'member_mention':
        return {
          icon: <MessageSquare size={18} color={isDark ? '#38BDF8' : '#0284C7'} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE',
        };
      default:
        return {
          icon: <Receipt size={18} color={colors.primary} strokeWidth={2.2} />,
          bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
        };
    }
  };

  // Format relative time (e.g. 5m, 2h, Nov 9)
  const formatTimeAgo = (dateInput: Date | string | any): string => {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader
        title={t('notifications:notifications', { defaultValue: 'Notifications' })}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <CheckCheck size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.markAllBtnText}>
                {t('notifications:markAllAsRead', { defaultValue: 'Mark all read' })}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['all', 'unread', 'expenses', 'settlements'] as const).map((tab) => {
          const isActive = activeFilter === tab;
          const label =
            tab === 'all'
              ? t('notifications:filterAll', { defaultValue: 'All' })
              : tab === 'unread'
              ? `${t('notifications:filterUnread', { defaultValue: 'Unread' })}${unreadCount > 0 ? ` (${unreadCount})` : ''}`
              : tab === 'expenses'
              ? t('notifications:filterExpenses', { defaultValue: 'Expenses' })
              : t('notifications:filterSettlements', { defaultValue: 'Settlements' });

          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterPill,
                isActive && styles.filterPillActive,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.selectionAsync().catch(() => {});
                }
                setActiveFilter(tab);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications List */}
      <FlatList
        data={flattenedData}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[
          styles.listContent,
          flattenedData.length === 0 && styles.listContentEmpty,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={loadMoreNotifications}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Bell size={38} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('notifications:emptyState', { defaultValue: "You're all caught up!" })}
              </Text>
              <Text style={styles.emptySub}>
                {t('notifications:emptyStateSub', {
                  defaultValue: 'When expenses, settlements, or updates are shared with you, they will appear here.',
                })}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{item.title}</Text>
              </View>
            );
          }

          const notif = item.item!;
          const isUnread = !notif.readAt;
          const badge = getEventBadge(notif.type);
          const { title, body } = resolveNotificationDisplay(notif);

          return (
            <TouchableOpacity
              style={[
                styles.itemCard,
                isUnread && styles.itemCardUnread,
              ]}
              onPress={() => handleItemPress(notif)}
              onLongPress={() => handleItemLongPress(notif)}
              activeOpacity={0.7}
            >
              {/* Badge Icon */}
              <View style={[styles.badgeCircle, { backgroundColor: badge.bg }]}>
                {badge.icon}
              </View>

              {/* Text Info */}
              <View style={styles.itemMeta}>
                <View style={styles.itemTitleRow}>
                  <Text
                    style={[
                      styles.itemTitle,
                      isUnread && styles.itemTitleUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <Text style={styles.itemTime}>{formatTimeAgo(notif.createdAt)}</Text>
                </View>

                <Text
                  style={[
                    styles.itemBody,
                    isUnread && styles.itemBodyUnread,
                  ]}
                  numberOfLines={2}
                >
                  {body}
                </Text>

                {notif.groupName && (
                  <Text style={styles.itemGroupTag} numberOfLines={1}>
                    {notif.groupName}
                  </Text>
                )}
              </View>

              {/* Unread indicator dot */}
              {isUnread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
    },
    markAllBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    listContent: {
      paddingVertical: 12,
    },
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    sectionHeader: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 6,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 13,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemCardUnread: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.08)' : '#F0FDF4',
    },
    badgeCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemMeta: {
      flex: 1,
      marginLeft: 14,
      marginRight: 8,
    },
    itemTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 6,
    },
    itemTitleUnread: {
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    itemTime: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    itemBody: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    itemBodyUnread: {
      color: colors.textPrimary,
      fontWeight: '500',
    },
    itemGroupTag: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 4,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: 6,
    },
    footerLoader: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyIconCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

export default NotificationCenterScreen;
