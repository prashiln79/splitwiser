import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Share,
} from 'react-native';
import {
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember, OptimizedSettlement } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import { formatCurrency } from '../../utils/currency';
import { logGroupActivity } from '../../services/activityService';
import { dispatchNotificationEvent } from '../../services/notificationService';
import { useAppTheme, ThemeColors } from '../../theme';

interface BalanceRemindersModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  currency: string;
  currentUserId: string;
  currentUserName: string;
  settlements: OptimizedSettlement[];
  members: GroupMember[];
  onClose: () => void;
}

export const BalanceRemindersModal: React.FC<BalanceRemindersModalProps> = ({
  visible,
  groupId,
  groupName,
  currency,
  currentUserId,
  currentUserName,
  settlements,
  members,
  onClose,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [remindedUserIds, setRemindedUserIds] = useState<Set<string>>(new Set());

  // Members who owe ME money
  const debtorsToMe = settlements.filter(
    (s) => s.toUserId === currentUserId && s.amount > 0.01
  );

  const handleSendReminder = async (settlement: OptimizedSettlement) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const message = `Hey ${settlement.fromUserName}! Just a friendly reminder from our group "${groupName}" on Splitwiser. You have an outstanding balance of ${formatCurrency(
      settlement.amount,
      currency
    )} with me. Let's settle up whenever you have a moment! 👍`;

    try {
      await Share.share({
        message,
        title: `Balance Reminder for ${groupName}`,
      });

      setRemindedUserIds((prev) => new Set(prev).add(settlement.fromUserId));

      // Log activity
      await logGroupActivity(
        groupId,
        { id: currentUserId, name: currentUserName },
        'reminder_sent',
        `${currentUserName} sent a balance reminder to ${settlement.fromUserName} (${formatCurrency(
          settlement.amount,
          currency
        )})`
      );

      // In-app notification to the debtor
      dispatchNotificationEvent({
        type: 'payment_reminder',
        actor: { id: currentUserId, name: currentUserName },
        groupId,
        groupName,
        targetUserIds: [settlement.fromUserId],
        params: {
          actorName: currentUserName,
          groupName,
          amount: formatCurrency(settlement.amount, currency),
        },
        dedupeKey: `reminder_${currentUserId}_${settlement.fromUserId}_${Date.now()}`,
      }).catch(() => {});
    } catch {
      // Ignored
    }
  };

  const handleRemindAll = async () => {
    if (debtorsToMe.length === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const message = `Hey everyone! Friendly balance check for our group "${groupName}" on Splitwiser. Please review your pending balances and settle up when convenient. Thanks!`;

    try {
      await Share.share({
        message,
        title: `Group Balance Reminder for ${groupName}`,
      });

      const allIds = new Set(debtorsToMe.map((d) => d.fromUserId));
      setRemindedUserIds(allIds);

      await logGroupActivity(
        groupId,
        { id: currentUserId, name: currentUserName },
        'reminder_sent',
        `${currentUserName} sent a balance reminder to all debtors in the group`
      );

      // In-app notifications to all debtors
      dispatchNotificationEvent({
        type: 'payment_reminder',
        actor: { id: currentUserId, name: currentUserName },
        groupId,
        groupName,
        targetUserIds: debtorsToMe.map((d) => d.fromUserId),
        params: {
          actorName: currentUserName,
          groupName,
        },
        dedupeKey: `reminder_all_${currentUserId}_${groupId}_${Date.now()}`,
      }).catch(() => {});
    } catch {
      // Ignored
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Balance Reminders</Text>
              <Text style={styles.sheetSubtitle}>Send polite payment reminders</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {debtorsToMe.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CheckCircle2 size={44} color="#059669" strokeWidth={2.2} />
                <Text style={styles.emptyTitle}>No pending debts to you</Text>
                <Text style={styles.emptySubtitle}>
                  No one in this group currently owes you money. You are all settled up!
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.infoBanner}>
                  <AlertCircle size={16} color="#0284C7" style={{ marginRight: 8 }} />
                  <Text style={styles.infoBannerText}>
                    Tapping "Send Reminder" prepares a friendly message you can send directly via
                    WhatsApp, SMS, or any messaging app.
                  </Text>
                </View>

                <View style={styles.debtorsList}>
                  {debtorsToMe.map((d) => {
                    const alreadyReminded = remindedUserIds.has(d.fromUserId);
                    return (
                      <View key={d.fromUserId} style={styles.debtorCard}>
                        <MemberAvatar name={d.fromUserName} size={40} />
                        <View style={styles.debtorMeta}>
                          <Text style={styles.debtorName}>{d.fromUserName}</Text>
                          <Text style={styles.debtorAmount}>
                            Owes you {formatCurrency(d.amount, currency)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.remindBtn,
                            alreadyReminded && styles.remindBtnSent,
                          ]}
                          onPress={() => handleSendReminder(d)}
                          activeOpacity={0.8}
                        >
                          <Send size={13} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 5 }} />
                          <Text style={styles.remindBtnText}>
                            {alreadyReminded ? 'Sent' : 'Remind'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {debtorsToMe.length > 1 && (
                  <TouchableOpacity
                    style={styles.remindAllBtn}
                    onPress={handleRemindAll}
                    activeOpacity={0.85}
                  >
                    <Clock size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={styles.remindAllBtnText}>
                      Remind All Members ({debtorsToMe.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
      maxHeight: '80%',
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
    sheetSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
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
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(3, 105, 161, 0.15)' : '#F0F9FF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(3, 105, 161, 0.3)' : '#BAE6FD',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    infoBannerText: {
      flex: 1,
      fontSize: 12,
      color: isDark ? '#38BDF8' : '#0369A1',
      lineHeight: 16,
    },
    debtorsList: {
      gap: 10,
      marginBottom: 16,
    },
    debtorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    debtorMeta: {
      flex: 1,
      marginLeft: 12,
    },
    debtorName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    debtorAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.expense,
      marginTop: 2,
    },
    remindBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
    },
    remindBtnSent: {
      backgroundColor: colors.textMuted,
    },
    remindBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    remindAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 20,
    },
    remindAllBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
  });

