import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Keyboard,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, AlertCircle, RefreshCw, Users, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import { toCents, formatCents, distributeCentsEqually } from '../../utils/splitMath';
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [mode, setMode] = useState<'single' | 'multiple'>(
    payerId === '__MULTIPLE__' ? 'multiple' : 'single'
  );
  const [selectedSinglePayerId, setSelectedSinglePayerId] = useState<string>(
    payerId && payerId !== '__MULTIPLE__'
      ? payerId
      : currentUserId || members[0]?.userId || ''
  );
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const multipleScrollRef = useRef<any>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMode(payerId === '__MULTIPLE__' ? 'multiple' : 'single');
      setSelectedSinglePayerId(
        payerId && payerId !== '__MULTIPLE__'
          ? payerId
          : currentUserId || members[0]?.userId || ''
      );
      const copy: Record<string, string> = {};
      members.forEach((m) => {
        copy[m.userId] = payerAmounts[m.userId] || '';
      });
      setLocalAmounts(copy);
    }
  }, [visible, payerId, payerAmounts, members, currentUserId]);

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

  const handleConfirmSingle = (userIdToConfirm?: string) => {
    const targetId = userIdToConfirm || selectedSinglePayerId;
    if (!targetId) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onSelectSinglePayer(targetId);
    onClose();
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

  // Proper generous bottom sheet height matching Split Options popup
  const sheetMinHeight = Math.min(Math.max(windowHeight * 0.68, 490), 600);
  const sheetMaxHeight = Math.max(windowHeight - keyboardHeight - Math.max(insets.top, 24) - 10, 280);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={() => {
          if (isKeyboardVisible) {
            Keyboard.dismiss();
          } else {
            onClose();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.keyboardWrap,
            Platform.OS === 'android' && isKeyboardVisible ? { paddingBottom: keyboardHeight } : null,
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.sheetContainer,
              {
                minHeight: isKeyboardVisible ? undefined : sheetMinHeight,
                maxHeight: isKeyboardVisible ? sheetMaxHeight : '92%',
                paddingTop: isKeyboardVisible ? 10 : 14,
                paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 8, 16),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Who paid?</Text>
                <Text style={styles.modalSubtitle}>
                  {mode === 'single'
                    ? 'Choose who paid for this expense'
                    : `Expense Total: ${formatCents(totalExpenseCents, currency)}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Segmented Mode Tabs */}
            <View style={styles.segmentedControlWrapper}>
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
                  <User size={16} color={mode === 'single' ? colors.primary : colors.textMuted} />
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
                  <Users size={16} color={mode === 'multiple' ? colors.primary : colors.textMuted} />
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
            </View>

            {/* Tab Body Container (Proper Height Matching Split Options) */}
            <View
              style={[
                styles.bodyContainer,
                isKeyboardVisible && {
                  minHeight: 120,
                  maxHeight: Math.max(sheetMaxHeight - 170, 140),
                },
              ]}
            >
              {mode === 'single' ? (
                <View style={styles.tabContent}>
                  <View style={styles.bodySubheaderRow}>
                    <Text style={styles.bodySubheading}>
                      Select the person who covered the full bill
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.membersScrollView}
                    contentContainerStyle={styles.membersScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {members.map((m) => {
                      const isSelected = selectedSinglePayerId === m.userId;
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
                            setSelectedSinglePayerId(m.userId);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.payerLeft}>
                            <MemberAvatar name={m.userName} size={42} imageUrl={m.imageUrl} />
                            <View style={styles.payerMeta}>
                              <Text
                                style={[
                                  styles.payerName,
                                  isSelected && styles.payerNameSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </Text>
                              {isSelected ? (
                                <Text style={styles.payerStatusText}>Paid full amount</Text>
                              ) : (
                                <Text style={styles.payerHintText}>Tap to select</Text>
                              )}
                            </View>
                          </View>

                          {isSelected ? (
                            <View style={styles.checkCircle}>
                              <Check size={16} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          ) : (
                            <View style={styles.uncheckCircle} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.tabContent}>
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
                      <RefreshCw size={13} color={colors.primary} />
                      <Text style={styles.splitEvenlyBtnText}>
                        Split paid amount evenly
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    ref={multipleScrollRef}
                    style={styles.multipleScrollView}
                    contentContainerStyle={[
                      styles.multipleScrollContent,
                      isKeyboardVisible && { paddingBottom: 60 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                  >
                    {members.map((m, idx) => {
                      const isMe = m.userId === currentUserId;
                      const hasValue =
                        (localAmounts[m.userId] || '').trim().length > 0 &&
                        parseFloat(localAmounts[m.userId] || '0') > 0;
                      return (
                        <View key={m.userId} style={styles.multiPayerRow}>
                          <View style={styles.payerLeft}>
                            <MemberAvatar name={m.userName} size={38} imageUrl={m.imageUrl} />
                            <View style={styles.payerMeta}>
                              <Text style={styles.payerName} numberOfLines={1}>
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </Text>
                              {hasValue && (
                                <Text style={styles.multiAmountHint}>
                                  Paid {currency}{localAmounts[m.userId]}
                                </Text>
                              )}
                            </View>
                          </View>

                          <View
                            style={[
                              styles.amountInputBox,
                              hasValue && styles.amountInputBoxActive,
                            ]}
                          >
                            <Text style={styles.currencyPrefix}>{currency}</Text>
                            <TextInput
                              style={styles.multiAmountInput}
                              value={localAmounts[m.userId] || ''}
                              onFocus={() => {
                                setTimeout(() => {
                                  multipleScrollRef.current?.scrollTo({
                                    y: Math.max(0, idx * 56 - 10),
                                    animated: true,
                                  });
                                }, 100);
                              }}
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
                              placeholderTextColor={colors.textMuted}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Bottom Bar with CTA (Fixed at bottom matching Split Options) */}
            <View style={styles.bottomBar}>
              {mode === 'single' ? (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => handleConfirmSingle()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>Confirm Payer</Text>
                </TouchableOpacity>
              ) : (
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
              )}
            </View>
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
      justifyContent: 'flex-end',
    },
    keyboardWrap: {
      width: '100%',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 14,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      maxHeight: '92%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.35 : 0.15,
      shadowRadius: 10,
      elevation: 10,
    },
    dragHandle: {
      width: 40,
      height: 4.5,
      borderRadius: 3,
      backgroundColor: isDark ? colors.border : '#E2E8F0',
      alignSelf: 'center',
      marginBottom: 12,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    closeBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    segmentedControlWrapper: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: 12,
      padding: 3,
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
    bodyContainer: {
      flex: 1,
      minHeight: 280,
      maxHeight: 390,
    },
    bodyContainerKeyboard: {
      minHeight: 160,
      maxHeight: 220,
    },
    tabContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    bodySubheaderRow: {
      marginBottom: 10,
    },
    bodySubheading: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    membersScrollView: {
      flex: 1,
    },
    membersScrollContent: {
      paddingBottom: 16,
    },
    singlePayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      marginBottom: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
    },
    singlePayerRowSelected: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ECFDF5',
      borderColor: colors.primary,
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
      fontWeight: '600',
      marginTop: 2,
    },
    payerHintText: {
      fontSize: 12,
      color: colors.textMuted,
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
    uncheckCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    validationStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9,
      paddingHorizontal: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
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
      paddingVertical: 3.5,
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
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
    },
    splitEvenlyBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.primary,
    },
    multipleScrollView: {
      flex: 1,
    },
    multipleScrollContent: {
      paddingBottom: 16,
    },
    multiPayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    multiAmountHint: {
      fontSize: 11.5,
      color: colors.primary,
      fontWeight: '500',
      marginTop: 2,
    },
    amountInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      width: 115,
    },
    amountInputBoxActive: {
      borderColor: colors.primary,
    },
    currencyPrefix: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginRight: 4,
    },
    multiAmountInput: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'right',
      padding: 0,
    },
    bottomBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: colors.surface,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    confirmBtnDisabled: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#9CA3AF',
      opacity: 0.6,
      shadowOpacity: 0,
      elevation: 0,
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
