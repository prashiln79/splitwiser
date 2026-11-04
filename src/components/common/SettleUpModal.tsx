import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Check, X, ArrowRight, DollarSign } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography, spacing, radii, shadows } from '../../theme';
import { OptimizedSettlement } from '../../types';
import { recordSettlement } from '../../services/settlements';
import { formatCurrency } from '../../utils/currency';

interface SettleUpModalProps {
  visible: boolean;
  onDismiss: () => void;
  groupId: string;
  settlements: OptimizedSettlement[];
  currentUserId: string;
  onSuccess: () => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  visible,
  onDismiss,
  groupId,
  settlements,
  currentUserId,
  onSuccess,
}) => {
  const { colors } = useAppTheme();
  const [selectedSettlement, setSelectedSettlement] = useState<OptimizedSettlement | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Relevant settlements for current user (where user is debtor or creditor)
  const mySettlements = settlements.filter(
    (s) => s.fromUserId === currentUserId || s.toUserId === currentUserId
  );
  const displaySettlements = mySettlements.length > 0 ? mySettlements : settlements;

  const handleSelect = (s: OptimizedSettlement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedSettlement(s);
  };

  const handleConfirmSettlement = async () => {
    if (!selectedSettlement) return;
    setIsSubmitting(true);
    try {
      await recordSettlement(
        groupId,
        selectedSettlement.fromUserId,
        selectedSettlement.toUserId,
        selectedSettlement.fromUserName,
        selectedSettlement.toUserName,
        selectedSettlement.amount,
        note.trim() || 'Paid via Splitwiser'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Settled Up!',
        `Recorded settlement of ${formatCurrency(selectedSettlement.amount)} between ${selectedSettlement.fromUserName} and ${selectedSettlement.toUserName}.`
      );
      setSelectedSettlement(null);
      setNote('');
      onSuccess();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            shadows.lg,
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Record a Settlement
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.closeButton, { backgroundColor: colors.surfaceVariant }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {displaySettlements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                There are no outstanding balances to settle in this group!
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                Select the balance being settled:
              </Text>

              <View style={styles.settlementsList}>
                {displaySettlements.map((s, idx) => {
                  const isSelected =
                    selectedSettlement?.fromUserId === s.fromUserId &&
                    selectedSettlement?.toUserId === s.toUserId;

                  return (
                    <TouchableOpacity
                      key={`${s.fromUserId}-${s.toUserId}-${idx}`}
                      style={[
                        styles.settlementRow,
                        {
                          backgroundColor: isSelected
                            ? colors.primaryLight
                            : colors.surfaceVariant,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleSelect(s)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <View style={styles.settlementInfo}>
                        <Text
                          style={[
                            styles.partyName,
                            {
                              color:
                                s.fromUserId === currentUserId
                                  ? colors.expense
                                  : colors.textPrimary,
                            },
                          ]}
                        >
                          {s.fromUserId === currentUserId ? 'You' : s.fromUserName}
                        </Text>
                        <ArrowRight size={14} color={colors.textMuted} style={{ marginHorizontal: 6 }} />
                        <Text
                          style={[
                            styles.partyName,
                            {
                              color:
                                s.toUserId === currentUserId
                                  ? colors.income
                                  : colors.textPrimary,
                            },
                          ]}
                        >
                          {s.toUserId === currentUserId ? 'You' : s.toUserName}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.settlementAmount,
                          {
                            color: isSelected ? colors.primaryDark : colors.textPrimary,
                          },
                        ]}
                      >
                        {formatCurrency(s.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedSettlement && (
                <View style={styles.selectedContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Payment Note (optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.noteInput,
                      {
                        backgroundColor: colors.surfaceVariant,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="e.g. Paid via UPI / Cash"
                    placeholderTextColor={colors.textMuted}
                    value={note}
                    onChangeText={setNote}
                  />

                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleConfirmSettlement}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm settlement"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                        <Text style={styles.confirmButtonText}>
                          Record {formatCurrency(selectedSettlement.amount)}
                        </Text>
                      </>
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  settlementsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  settlementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partyName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  settlementAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  selectedContainer: {
    marginTop: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
    marginBottom: 4,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.base,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
});

