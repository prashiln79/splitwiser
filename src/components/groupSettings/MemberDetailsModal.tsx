import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  X,
  Shield,
  Trash2,
  Calendar,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import { formatCurrency } from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';

interface MemberDetailsModalProps {
  visible: boolean;
  member: GroupMember | null;
  currency: string;
  netBalance: number; // member's net balance in group
  isCurrentUser: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onRemove: (member: GroupMember) => void;
  onTransferAdmin: (member: GroupMember) => void;
}

export const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({
  visible,
  member,
  currency,
  netBalance,
  isCurrentUser,
  isAdmin,
  onClose,
  onRemove,
  onTransferAdmin,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  if (!member) return null;

  const joinedDateStr = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  const isMemberAdmin = member.role === 'admin';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialogContainer}>
          {/* Header Close */}
          <View style={styles.topRow}>
            <View style={styles.roleBadge}>
              <Shield
                size={12}
                color={isMemberAdmin ? '#059669' : '#6B7280'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.roleBadgeText,
                  { color: isMemberAdmin ? '#065F46' : '#4B5563' },
                ]}
              >
                {isMemberAdmin ? 'Group Admin' : 'Member'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Member Card */}
          <View style={styles.avatarSection}>
            <MemberAvatar name={member.userName} imageUrl={member.imageUrl} size={64} />
            <Text style={styles.memberName}>{member.userName} {isCurrentUser ? '(You)' : ''}</Text>
          </View>

          {/* Details Grid */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Wallet size={15} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Group Net Balance</Text>
              </View>
              <Text
                style={[
                  styles.balanceValue,
                  netBalance > 0.01
                    ? styles.positiveBalance
                    : netBalance < -0.01
                    ? styles.negativeBalance
                    : styles.neutralBalance,
                ]}
              >
                {netBalance > 0.01
                  ? `+${formatCurrency(netBalance, currency)}`
                  : netBalance < -0.01
                  ? `-${formatCurrency(Math.abs(netBalance), currency)}`
                  : 'Settled ($0.00)'}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={styles.infoLeft}>
                <Calendar size={15} color="#6B7280" style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Joined Date</Text>
              </View>
              <Text style={styles.infoValue}>{joinedDateStr}</Text>
            </View>
          </View>

          {/* Admin Management Actions */}
          {isAdmin && !isCurrentUser && (
            <View style={styles.actionSection}>
              {!isMemberAdmin && (
                <TouchableOpacity
                  style={styles.adminActionBtn}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    onTransferAdmin(member);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Shield size={16} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.adminActionText}>Make Group Admin</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.removeActionBtn}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  onRemove(member);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Trash2 size={16} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.removeActionText}>Remove from Group</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialogContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 340,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    closeBtn: {
      padding: 6,
      borderRadius: 14,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 16,
    },
    memberName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 10,
    },
    infoCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    infoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    infoValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    balanceValue: {
      fontSize: 13,
      fontWeight: '700',
    },
    positiveBalance: {
      color: colors.income,
    },
    negativeBalance: {
      color: colors.expense,
    },
    neutralBalance: {
      color: colors.textMuted,
    },
    actionSection: {
      gap: 8,
    },
    adminActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
      paddingVertical: 10,
      borderRadius: 12,
    },
    adminActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    removeActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.2)' : '#FEF2F2',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(225, 29, 72, 0.3)' : '#FECACA',
      paddingVertical: 10,
      borderRadius: 12,
    },
    removeActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.expense,
    },
  });

