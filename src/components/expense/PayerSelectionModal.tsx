import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { X, Check, AlertCircle, RefreshCw, Users, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import { toCents, fromCents, formatCents, distributeCentsEqually } from '../../utils/splitMath';
import { useAppTheme, ThemeColors } from '../../theme';

interface PayerSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  members: GroupMember[];
  currentUserId: string;
  payerId: string | null; // member uid or '__MULTIPLE__'
  payerAmounts: Record<string, string>;
  totalAmount: number;
  currency: string;
  onSelectSinglePayer: (userId: string) => void;
  onConfirmMultiplePayers: (amounts: Record<string, string>) => void;
}

export const PayerSelectionModal: React.FC<PayerSelectionModalProps> = ({
  visible,
  onClose,
  members,
  currentUserId,
  payerId,
  payerAmounts,
  totalAmount,
  currency,
  onSelectSinglePayer,
  onConfirmMultiplePayers,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [mode, setMode] = useState<'single' | 'multiple'>(
    payerId === '__MULTIPLE__' ? 'multiple' : 'single'
  );
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setMode(payerId === '__MULTIPLE__' ? 'multiple' : 'single');
      const copy: Record<string, string> = {};
      members.forEach((m) => {
        copy[m.userId] = payerAmounts[m.userId] || '';
      });
      setLocalAmounts(copy);
    }
  }, [visible, payerId, payerAmounts, members]);

  const totalExpenseCents = toCents(totalAmount);

  const totalPaidCents = useMemo(() => {
    return Object.values(localAmounts).reduce((sum, v) => sum + toCents(v), 0);
  }, [localAmounts]);

  const diffCents = totalExpenseCents - totalPaidCents;
  const isBalanced = Math.abs(diffCents) === 0;

  const handleSplitEvenlyAmongPayers = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const count = members.length;
    if (count === 0 || totalExpenseCents <= 0) return;

    const distributed = distributeCentsEqually(totalExpenseCents, count);
    const updated: Record<string, string> = {};
    members.forEach((m, idx) => {
      updated[m.userId] = (distributed[idx] / 100).toFixed(2);
    });
    setLocalAmounts(updated);
  };

  const handleConfirmMultiple = () => {
    if (!isBalanced) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      Alert.alert(
        'Amounts Do Not Match',
        `Total paid is ${formatCents(totalPaidCents, currency)}, but total expense is ${formatCents(totalExpenseCents, currency)}.`
      );
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onConfirmMultiplePayers(localAmounts);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dialogContainer}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Who paid?</Text>
                <Text style={styles.modalSubtitle}>
                  Choose who paid for this expense
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Segmented Mode Control */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  mode === 'single' && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setMode('single');
                }}
                activeOpacity={0.7}
              >
                <User size={15} color={mode === 'single' ? '#059669' : '#6B7280'} />
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'single' && styles.segmentTextActive,
                  ]}
                >
                  Single person
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  mode === 'multiple' && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setMode('multiple');
                }}
                activeOpacity={0.7}
              >
                <Users size={15} color={mode === 'multiple' ? '#059669' : '#6B7280'} />
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'multiple' && styles.segmentTextActive,
                  ]}
                >
                  Multiple people
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode Content */}
            {mode === 'single' ? (
              <ScrollView
                style={styles.membersScrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {members.map((m) => {
                  const isSelected = payerId === m.userId;
                  const isMe = m.userId === currentUserId;
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      style={[
                        styles.singlePayerRow,
                        isSelected && styles.singlePayerRowSelected,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        onSelectSinglePayer(m.userId);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.payerLeft}>
                        <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                        <View style={styles.payerMeta}>
                          <Text
                            style={[
                              styles.payerName,
                              isSelected && styles.payerNameSelected,
                            ]}
                          >
                            {isMe ? `${m.userName} (You)` : m.userName}
                          </Text>
                          {isSelected && (
                            <Text style={styles.payerStatusText}>Paid full amount</Text>
                          )}
                        </View>
                      </View>

                      {isSelected && (
                        <View style={styles.checkCircle}>
                          <Check size={16} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.multipleContainer}>
                {/* Live validation strip */}
                <View style={styles.validationStrip}>
                  <View style={styles.validationAmounts}>
                    <Text style={styles.validationText}>
                      Total paid:{' '}
                      <Text style={styles.validationValue}>
                        {formatCents(totalPaidCents, currency)}
                      </Text>{' '}
                      of {formatCents(totalExpenseCents, currency)}
                    </Text>
                  </View>

                  {isBalanced ? (
                    <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                      <Check size={12} color="#059669" strokeWidth={3} />
                      <Text style={[styles.statusText, { color: '#059669' }]}>
                        Balanced
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                      <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                      <Text style={[styles.statusText, { color: '#E11D48' }]}>
                        {diffCents > 0
                          ? `${formatCents(diffCents, currency)} left`
                          : `${formatCents(Math.abs(diffCents), currency)} over`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quick Action: Split evenly */}
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    style={styles.splitEvenlyBtn}
                    onPress={handleSplitEvenlyAmongPayers}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={13} color="#059669" />
                    <Text style={styles.splitEvenlyBtnText}>
                      Split paid amount evenly
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.multipleScrollView}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {members.map((m) => {
                    const isMe = m.userId === currentUserId;
                    return (
                      <View key={m.userId} style={styles.multiPayerRow}>
                        <View style={styles.payerLeft}>
                          <MemberAvatar name={m.userName} size={34} imageUrl={m.imageUrl} />
                          <Text style={styles.payerName} numberOfLines={1}>
                            {isMe ? `${m.userName} (You)` : m.userName}
                          </Text>
                        </View>

                        <View style={styles.amountInputBox}>
                          <Text style={styles.currencyPrefix}>{currency}</Text>
                          <TextInput
                            style={styles.multiAmountInput}
                            value={localAmounts[m.userId] || ''}
                            onChangeText={(val) => {
                              const cleaned = val.replace(/[^0-9.]/g, '');
                              const parts = cleaned.split('.');
                              if (parts.length > 2) return;
                              if (parts[1] && parts[1].length > 2) return;
                              setLocalAmounts((prev) => ({
                                ...prev,
                                [m.userId]: cleaned,
                              }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            selectTextOnFocus
                          />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Confirm Action */}
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    !isBalanced && styles.confirmBtnDisabled,
                  ]}
                  onPress={handleConfirmMultiple}
                  activeOpacity={0.85}
                  disabled={!isBalanced}
                >
                  <Text style={styles.confirmBtnText}>Confirm Multiple Payers</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    keyboardWrap: {
      width: '100%',
      maxWidth: 420,
    },
    dialogContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: 12,
      padding: 3,
      marginBottom: 16,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    segmentTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    membersScrollView: {
      maxHeight: 320,
    },
    singlePayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    singlePayerRowSelected: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
    },
    payerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    payerMeta: {
      flex: 1,
    },
    payerName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    payerNameSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    payerStatusText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
      marginTop: 2,
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    multipleContainer: {
      width: '100%',
    },
    validationStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    validationAmounts: {
      flex: 1,
    },
    validationText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    validationValue: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
    },
    statusBadgeBalanced: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
    },
    statusBadgeUnbalanced: {
      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.2)' : '#FEF2F2',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    quickActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 8,
    },
    splitEvenlyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    splitEvenlyBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    multipleScrollView: {
      maxHeight: 220,
    },
    multiPayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    amountInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      width: 105,
    },
    currencyPrefix: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginRight: 4,
    },
    multiAmountInput: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'right',
      padding: 0,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    confirmBtnDisabled: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#9CA3AF',
      opacity: 0.7,
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

