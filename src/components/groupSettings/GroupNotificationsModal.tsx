import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Bell,
  BellOff,
  Receipt,
  RotateCcw,
  MessageSquare,
  Clock,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupUserPreferences } from '../../types';
import {
  getGroupUserPreferences,
  updateGroupUserPreferences,
} from '../../services/groupPreferencesService';
import { useAppTheme, ThemeColors } from '../../theme';

interface GroupNotificationsModalProps {
  visible: boolean;
  groupId: string;
  userId: string;
  groupName: string;
  onClose: () => void;
}

export const GroupNotificationsModal: React.FC<GroupNotificationsModalProps> = ({
  visible,
  groupId,
  userId,
  groupName,
  onClose,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [prefs, setPrefs] = useState<GroupUserPreferences | null>(null);

  useEffect(() => {
    if (visible && groupId && userId) {
      getGroupUserPreferences(groupId, userId).then(setPrefs);
    }
  }, [visible, groupId, userId]);

  const toggleMute = async (value: boolean) => {
    if (!prefs) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const updated = await updateGroupUserPreferences(groupId, userId, { muted: value });
    setPrefs(updated);
  };

  const toggleNotificationItem = async (
    key: keyof GroupUserPreferences['notifications'],
    value: boolean
  ) => {
    if (!prefs) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const updated = await updateGroupUserPreferences(groupId, userId, {
      notifications: {
        ...prefs.notifications,
        [key]: value,
      },
    });
    setPrefs(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Group Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Master Mute Section */}
            <View style={[styles.muteCard, prefs?.muted && styles.muteCardActive]}>
              <View style={styles.muteIconWrapper}>
                {prefs?.muted ? (
                  <BellOff size={22} color="#DC2626" />
                ) : (
                  <Bell size={22} color="#059669" />
                )}
              </View>
              <View style={styles.muteMeta}>
                <Text style={styles.muteTitle}>Mute This Group</Text>
                <Text style={styles.muteSubtitle}>
                  Temporarily stop push notifications from {groupName}
                </Text>
              </View>
              <Switch
                value={Boolean(prefs?.muted)}
                onValueChange={toggleMute}
                trackColor={{ false: '#D1D5DB', true: '#DC2626' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Individual Notification Triggers */}
            <Text style={styles.sectionHeading}>Notification Triggers</Text>
            <View style={[styles.togglesBox, prefs?.muted && { opacity: 0.5 }]}>
              {/* New Expenses */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <Receipt size={17} color="#059669" />
                </View>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>New Expenses</Text>
                  <Text style={styles.toggleSubtitle}>When someone adds an expense in this group</Text>
                </View>
                <Switch
                  value={Boolean(prefs?.notifications.newExpenses)}
                  onValueChange={(val) => toggleNotificationItem('newExpenses', val)}
                  disabled={Boolean(prefs?.muted)}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Expense Updates */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <RotateCcw size={17} color="#0284C7" />
                </View>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>Expense Updates & Edits</Text>
                  <Text style={styles.toggleSubtitle}>When expenses are edited or deleted</Text>
                </View>
                <Switch
                  value={Boolean(prefs?.notifications.expenseUpdates)}
                  onValueChange={(val) => toggleNotificationItem('expenseUpdates', val)}
                  disabled={Boolean(prefs?.muted)}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Settlements */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <ShieldCheck size={17} color="#16A34A" />
                </View>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>Settlements & Payments</Text>
                  <Text style={styles.toggleSubtitle}>When a member records a payment</Text>
                </View>
                <Switch
                  value={Boolean(prefs?.notifications.settlements)}
                  onValueChange={(val) => toggleNotificationItem('settlements', val)}
                  disabled={Boolean(prefs?.muted)}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Comments */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <MessageSquare size={17} color="#7C3AED" />
                </View>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>Comments & Notes</Text>
                  <Text style={styles.toggleSubtitle}>When someone comments on an expense</Text>
                </View>
                <Switch
                  value={Boolean(prefs?.notifications.comments)}
                  onValueChange={(val) => toggleNotificationItem('comments', val)}
                  disabled={Boolean(prefs?.muted)}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Balance Reminders */}
              <View style={[styles.toggleRow, styles.lastRow]}>
                <View style={styles.toggleIcon}>
                  <Clock size={17} color="#D97706" />
                </View>
                <View style={styles.toggleMeta}>
                  <Text style={styles.toggleTitle}>Balance Reminders</Text>
                  <Text style={styles.toggleSubtitle}>Friendly reminders when debts are due</Text>
                </View>
                <Switch
                  value={Boolean(prefs?.notifications.reminders)}
                  onValueChange={(val) => toggleNotificationItem('reminders', val)}
                  disabled={Boolean(prefs?.muted)}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    muteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#BBF7D0',
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    muteCardActive: {
      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(225, 29, 72, 0.3)' : '#FECACA',
    },
    muteIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    muteMeta: {
      flex: 1,
    },
    muteTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    muteSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 8,
    },
    togglesBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 24,
      overflow: 'hidden',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    toggleIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    toggleMeta: {
      flex: 1,
      paddingRight: 10,
    },
    toggleTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    toggleSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
  });

