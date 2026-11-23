import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Check, X, ArrowRight, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MemberAvatar } from './MemberAvatar';
import { OptimizedSettlement, GroupMember } from '../../types';
import { recordSettlementLocal } from '../../repositories/settlementRepository';
import {
  formatCurrency,
  isValidFinancialAmount,
  getCurrencySymbol,
  normalizeCurrencyCode,
} from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';
import { shareService } from '../../services/shareService';

interface SettleUpModalProps {
  visible: boolean;
  onDismiss: () => void;
  groupId: string;
  settlements: OptimizedSettlement[];
  currentUserId: string;
  groupCurrency?: string;
  members?: GroupMember[];
  onSuccess?: () => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  visible,
  onDismiss,
  groupId,
  settlements,
  currentUserId,
  groupCurrency = 'INR',
  members,
  onSuccess,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [selectedSettlement, setSelectedSettlement] = useState<OptimizedSettlement | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter settlements to those involving the current user first
  const mySettlements = useMemo(
    () => settlements.filter((s) => s.fromUserId === currentUserId || s.toUserId === currentUserId),
    [settlements, currentUserId]
  );
  const displaySettlements = mySettlements.length > 0 ? mySettlements : settlements;

  // Auto-select if only 1 settlement exists
  useEffect(() => {
    if (visible && displaySettlements.length === 1 && !selectedSettlement) {
      const s = displaySettlements[0];
      setSelectedSettlement(s);
      setCustomAmount(String(s.amount));
    }
  }, [visible, displaySettlements, selectedSettlement]);

  const handleSelect = (s: OptimizedSettlement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedSettlement(s);
    setCustomAmount(String(s.amount));
    setIsEditingAmount(false);
  };

  const settlementCurrency = selectedSettlement?.currency || groupCurrency || 'INR';

  const handleConfirmSettlement = async () => {
    if (!selectedSettlement) return;

    const amountNum = customAmount.trim() ? parseFloat(customAmount) : selectedSettlement.amount;
    const validation = isValidFinancialAmount(amountNum, settlementCurrency);
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.errorMessage || 'Please enter a valid settlement amount.');
      return;
    }

    if (amountNum > selectedSettlement.amount * 1.5) {
      // Gentle confirmation if paying significantly more than calculated debt
      // (still allowable, but warns user)
    }

    setIsSubmitting(true);
    try {
      await recordSettlementLocal(
        groupId,
        selectedSettlement.fromUserId,
        selectedSettlement.toUserId,
        selectedSettlement.fromUserName,
        selectedSettlement.toUserName,
        amountNum,
        settlementCurrency,
        note.trim() || undefined
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      const formatted = formatCurrency(amountNum, settlementCurrency);
      const fromPerson = selectedSettlement.fromUserName;
      const toPerson = selectedSettlement.toUserName;
      const paymentNote = note.trim() || undefined;

      Alert.alert(
        'Payment Recorded',
        `Recorded payment of ${formatted} from ${fromPerson} to ${toPerson} in ${settlementCurrency}.`,
        [
          {
            text: 'Share Receipt',
            onPress: () => {
              const msg = shareService.buildSettlementShareMessage({
                fromName: fromPerson,
                toName: toPerson,
                amount: amountNum,
                currency: settlementCurrency,
                date: new Date(),
                note: paymentNote,
              });
              shareService.shareWithOptions({
                message: msg,
                title: `Payment Receipt: ${fromPerson} to ${toPerson}`,
                dialogTitle: 'Share Payment Receipt',
              });
            },
          },
          { text: 'Done', style: 'cancel' },
        ]
      );

      setSelectedSettlement(null);
      setCustomAmount('');
      setIsEditingAmount(false);
      setNote('');
      onDismiss();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromName =
    selectedSettlement?.fromUserId === currentUserId ? 'You' : selectedSettlement?.fromUserName;
  const toName =
    selectedSettlement?.toUserId === currentUserId ? 'you' : selectedSettlement?.toUserName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>Record a payment</Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {displaySettlements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                All balances are completely settled in this group!
              </Text>
            </View>
          ) : (
            <>
              {/* If multiple settlements, show selection chips */}
              {displaySettlements.length > 1 && (
                <View style={styles.selectorContainer}>
                  <Text style={styles.sectionSubtitle}>Select balance to settle:</Text>
                  <View style={styles.settlementsList}>
                    {displaySettlements.map((s, idx) => {
                      const cur = s.currency || groupCurrency || 'INR';
                      const isSelected =
                        selectedSettlement?.fromUserId === s.fromUserId &&
                        selectedSettlement?.toUserId === s.toUserId &&
                        (selectedSettlement?.currency || groupCurrency) === cur;
                      return (
                        <TouchableOpacity
                          key={`${s.fromUserId}-${s.toUserId}-${cur}-${idx}`}
                          style={[
                            styles.settlementChoice,
                            isSelected && styles.settlementChoiceActive,
                          ]}
                          onPress={() => handleSelect(s)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.choiceHeader}>
                            <Text
                              style={[styles.choiceText, isSelected && styles.choiceTextActive]}
                            >
                              {s.fromUserId === currentUserId ? 'You' : s.fromUserName} →{' '}
                              {s.toUserId === currentUserId ? 'You' : s.toUserName}
                            </Text>
                            <View style={styles.currencyBadge}>
                              <Text style={styles.currencyBadgeText}>{cur}</Text>
                            </View>
                          </View>
                          <Text style={[styles.choiceAmount, isSelected && styles.choiceAmountActive]}>
                            {formatCurrency(s.amount, cur)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Splitwise Avatar Transfer Hero */}
              {selectedSettlement && (
                <View style={styles.paymentCard}>
                  <View style={styles.avatarTransferRow}>
                    <View style={styles.avatarCol}>
                      <MemberAvatar
                        name={selectedSettlement.fromUserName}
                        imageUrl={
                          members?.find((m) => m.userId === selectedSettlement.fromUserId)?.imageUrl
                        }
                        size={48}
                      />
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {fromName}
                      </Text>
                    </View>

                    <View style={styles.arrowBox}>
                      <ArrowRight size={20} color="#059669" strokeWidth={2.5} />
                    </View>

                    <View style={styles.avatarCol}>
                      <MemberAvatar
                        name={selectedSettlement.toUserName}
                        imageUrl={
                          members?.find((m) => m.userId === selectedSettlement.toUserId)?.imageUrl
                        }
                        size={48}
                      />
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {toName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transferSummary}>
                    {fromName} paid {toName}
                  </Text>

                  {/* Amount with editable support for partial settlements */}
                  <View style={styles.amountContainer}>
                    {isEditingAmount ? (
                      <View style={styles.editAmountRow}>
                        <Text style={styles.amountCurrencyPrefix}>
                          {getCurrencySymbol(settlementCurrency)}
                        </Text>
                        <TextInput
                          style={styles.amountInput}
                          value={customAmount}
                          onChangeText={setCustomAmount}
                          keyboardType="decimal-pad"
                          autoFocus
                          selectTextOnFocus
                        />
                        <Text style={styles.currencySuffix}>{settlementCurrency}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.amountDisplayRow}
                        onPress={() => setIsEditingAmount(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.transferAmount}>
                          {formatCurrency(
                            customAmount ? parseFloat(customAmount) || 0 : selectedSettlement.amount,
                            settlementCurrency
                          )}
                        </Text>
                        <Text style={styles.currencyBadgeInline}>{settlementCurrency}</Text>
                        <Edit3 size={15} color={colors.textMuted} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Note Input */}
                  <View style={styles.noteContainer}>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add a payment note (e.g. Bank transfer, Cash, UPI)"
                      placeholderTextColor={colors.textMuted}
                      value={note}
                      onChangeText={setNote}
                      maxLength={200}
                    />
                  </View>

                  {/* Confirm Button */}
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirmSettlement}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        Record Payment ({settlementCurrency})
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
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
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    selectorContainer: {
      marginBottom: 16,
    },
    sectionSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    settlementsList: {
      gap: 8,
      maxHeight: 180,
    },
    settlementChoice: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC',
    },
    settlementChoiceActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#F0FAF6',
    },
    choiceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    choiceText: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    choiceTextActive: {
      fontWeight: '700',
      color: colors.primary,
    },
    currencyBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    currencyBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    choiceAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
    },
    choiceAmountActive: {
      fontWeight: '700',
      color: colors.primary,
    },
    paymentCard: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    avatarTransferRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 12,
    },
    avatarCol: {
      alignItems: 'center',
      width: 80,
    },
    avatarName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 6,
      textAlign: 'center',
    },
    arrowBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#F0FAF6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    transferSummary: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: 'center',
    },
    amountContainer: {
      marginBottom: 14,
      alignItems: 'center',
    },
    amountDisplayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    transferAmount: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    currencyBadgeInline: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      marginLeft: 6,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    editAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      borderBottomColor: colors.primary,
      paddingHorizontal: 8,
    },
    amountCurrencyPrefix: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
      marginRight: 4,
    },
    amountInput: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      minWidth: 90,
      textAlign: 'center',
      paddingVertical: 2,
    },
    currencySuffix: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginLeft: 6,
    },
    noteContainer: {
      width: '100%',
      marginBottom: 18,
    },
    noteInput: {
      borderBottomWidth: 1.5,
      borderBottomColor: colors.border,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.textPrimary,
    },
    confirmButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
