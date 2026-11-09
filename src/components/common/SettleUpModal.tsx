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
import { Check, X, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MemberAvatar } from './MemberAvatar';
import { OptimizedSettlement } from '../../types';
import { recordSettlementLocal } from '../../repositories/settlementRepository';
import { formatCurrency } from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';

interface SettleUpModalProps {
  visible: boolean;
  onDismiss: () => void;
  groupId: string;
  settlements: OptimizedSettlement[];
  currentUserId: string;
  onSuccess?: () => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  visible,
  onDismiss,
  groupId,
  settlements,
  currentUserId,
  onSuccess,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [selectedSettlement, setSelectedSettlement] = useState<OptimizedSettlement | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter settlements to those involving the current user first
  const mySettlements = settlements.filter(
    (s) => s.fromUserId === currentUserId || s.toUserId === currentUserId
  );
  const displaySettlements = mySettlements.length > 0 ? mySettlements : settlements;

  // Auto-select if only 1 settlement exists
  useEffect(() => {
    if (visible && displaySettlements.length === 1 && !selectedSettlement) {
      setSelectedSettlement(displaySettlements[0]);
    }
  }, [visible, displaySettlements, selectedSettlement]);

  const handleSelect = (s: OptimizedSettlement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedSettlement(s);
  };

  const handleConfirmSettlement = async () => {
    if (!selectedSettlement) return;
    setIsSubmitting(true);
    try {
      await recordSettlementLocal(
        groupId,
        selectedSettlement.fromUserId,
        selectedSettlement.toUserId,
        selectedSettlement.fromUserName,
        selectedSettlement.toUserName,
        selectedSettlement.amount,
        note.trim() || undefined
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert(
        'Payment Recorded',
        `Recorded ${formatCurrency(selectedSettlement.amount)} paid from ${selectedSettlement.fromUserName} to ${selectedSettlement.toUserName}.`
      );
      setSelectedSettlement(null);
      setNote('');
      onDismiss();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromName = selectedSettlement?.fromUserId === currentUserId ? 'You' : selectedSettlement?.fromUserName;
  const toName = selectedSettlement?.toUserId === currentUserId ? 'you' : selectedSettlement?.toUserName;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
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
                      const isSelected =
                        selectedSettlement?.fromUserId === s.fromUserId &&
                        selectedSettlement?.toUserId === s.toUserId;
                      return (
                        <TouchableOpacity
                          key={`${s.fromUserId}-${s.toUserId}-${idx}`}
                          style={[
                            styles.settlementChoice,
                            isSelected && styles.settlementChoiceActive,
                          ]}
                          onPress={() => handleSelect(s)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.choiceText, isSelected && styles.choiceTextActive]}>
                            {s.fromUserId === currentUserId ? 'You' : s.fromUserName} →{' '}
                            {s.toUserId === currentUserId ? 'You' : s.toUserName}:{' '}
                            {formatCurrency(s.amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Splitwise Avatar Transfer Hero (Reference Image 4) */}
              {selectedSettlement && (
                <View style={styles.paymentCard}>
                  <View style={styles.avatarTransferRow}>
                    <View style={styles.avatarCol}>
                      <MemberAvatar name={selectedSettlement.fromUserName} size={48} />
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {fromName}
                      </Text>
                    </View>

                    <View style={styles.arrowBox}>
                      <ArrowRight size={20} color="#059669" strokeWidth={2.5} />
                    </View>

                    <View style={styles.avatarCol}>
                      <MemberAvatar name={selectedSettlement.toUserName} size={48} />
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {toName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transferSummary}>
                    {fromName} paid {toName}
                  </Text>
                  <Text style={styles.transferAmount}>
                    {formatCurrency(selectedSettlement.amount)}
                  </Text>

                  {/* Note Input */}
                  <View style={styles.noteContainer}>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add a payment note (e.g. Paid via UPI / Cash)"
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
                        Record Payment
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
      maxWidth: 400,
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
    choiceText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    choiceTextActive: {
      fontWeight: '700',
      color: colors.primary,
    },
    paymentCard: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    avatarTransferRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 16,
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
      fontSize: 15,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: 'center',
    },
    transferAmount: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 16,
      letterSpacing: -0.5,
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
