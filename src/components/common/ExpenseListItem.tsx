import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography, spacing, radii } from '../../theme';
import { CategoryIcon } from './CategoryIcon';
import { Expense } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface ExpenseListItemProps {
  expense: Expense;
  currentUserId: string;
  payerName: string;
  onPress?: () => void;
}

export const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
  expense,
  currentUserId,
  payerName,
  onPress,
}) => {
  const { colors } = useAppTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPress();
    }
  };

  const payerId = expense.paidBy || expense.createdBy;
  const isPayerMe = payerId === currentUserId;
  const mySplit = expense.splits?.find((s) => s.userId === currentUserId);
  const myShare = mySplit ? mySplit.amount : 0;

  // Compute what I lent or borrowed
  // If I paid: I lent (total - myShare)
  // If another paid: I borrowed (myShare)
  const lentAmount = isPayerMe ? expense.amount - myShare : 0;
  const borrowedAmount = !isPayerMe ? myShare : 0;

  // Format date
  const dateStr = expense.createdAt
    ? new Date(expense.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderLight,
        },
      ]}
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${expense.description}, amount ${formatCurrency(expense.amount)}`}
    >
      {/* Category Icon */}
      <CategoryIcon
        description={expense.description}
        tags={expense.tags}
        size={44}
      />

      {/* Description & Payer Meta */}
      <View style={styles.centerSection}>
        <Text
          style={[styles.description, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {expense.description}
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {isPayerMe ? 'You paid' : `${payerName} paid`} • {dateStr}
        </Text>
      </View>

      {/* Financial Details (Total + Net) */}
      <View style={styles.rightSection}>
        <Text style={[styles.totalAmount, { color: colors.textPrimary }]}>
          {formatCurrency(expense.amount)}
        </Text>
        {isPayerMe ? (
          lentAmount > 0 ? (
            <Text style={[styles.shareText, { color: colors.income }]}>
              you lent {formatCurrency(lentAmount)}
            </Text>
          ) : (
            <Text style={[styles.shareText, { color: colors.textMuted }]}>
              no one owes
            </Text>
          )
        ) : borrowedAmount > 0 ? (
          <Text style={[styles.shareText, { color: colors.expense }]}>
            you borrowed {formatCurrency(borrowedAmount)}
          </Text>
        ) : (
          <Text style={[styles.shareText, { color: colors.textMuted }]}>
            not involved
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centerSection: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  metaText: {
    fontSize: typography.sizes.xs,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  shareText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginTop: 2,
  },
});

