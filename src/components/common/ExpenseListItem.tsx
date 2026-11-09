import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CategoryIcon } from './CategoryIcon';
import { useAppTheme, ThemeColors } from '../../theme';
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
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
  const lentAmount = isPayerMe ? expense.amount - myShare : 0;
  const borrowedAmount = !isPayerMe ? myShare : 0;

  // Format date like Splitwise: "Mar 18"
  const dateObj = expense.createdAt ? new Date(expense.createdAt) : null;
  const monthStr = dateObj
    ? dateObj.toLocaleDateString('en-US', { month: 'short' })
    : '';
  const dayStr = dateObj ? dateObj.getDate().toString().padStart(2, '0') : '';

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${expense.description}, amount ${formatCurrency(expense.amount)}`}
    >
      {/* Date column */}
      <View style={styles.dateCol}>
        <Text style={[styles.dateMonth, { color: colors.textMuted }]}>{monthStr}</Text>
        <Text style={[styles.dateDay, { color: colors.textPrimary }]}>{dayStr}</Text>
      </View>

      {/* Category icon */}
      <View style={styles.iconCol}>
        <CategoryIcon
          description={expense.description}
          tags={expense.tags}
          size={36}
        />
      </View>

      {/* Description & payer */}
      <View style={styles.infoCol}>
        <View style={styles.descRow}>
          <Text style={[styles.description, { color: colors.textPrimary }]} numberOfLines={1}>
            {expense.description}
          </Text>
          {expense.syncStatus === 'pending' && (
            <View style={styles.syncBadge} testID="sync-pending-badge">
              <Clock size={12} color={colors.textMuted} />
            </View>
          )}
          {expense.syncStatus === 'failed' && (
            <View style={styles.syncBadge} testID="sync-failed-badge">
              <AlertCircle size={12} color={colors.danger} />
            </View>
          )}
        </View>
        <Text style={[styles.payer, { color: colors.textMuted }]} numberOfLines={1}>
          {isPayerMe ? 'You' : payerName} paid {formatCurrency(expense.amount)}
        </Text>
      </View>

      {/* Amount & net share */}
      <View style={styles.amountCol}>
        {isPayerMe ? (
          lentAmount > 0 ? (
            <>
              <Text style={[styles.lentLabel, { color: colors.income }]}>you lent</Text>
              <Text style={[styles.lentAmount, { color: colors.income }]}>
                {formatCurrency(lentAmount)}
              </Text>
            </>
          ) : (
            <Text style={[styles.notInvolved, { color: colors.textMuted }]}>not involved</Text>
          )
        ) : borrowedAmount > 0 ? (
          <>
            <Text style={[styles.borrowedLabel, { color: colors.expense }]}>you borrowed</Text>
            <Text style={[styles.borrowedAmount, { color: colors.expense }]}>
              {formatCurrency(borrowedAmount)}
            </Text>
          </>
        ) : (
          <Text style={[styles.notInvolved, { color: colors.textMuted }]}>not involved</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dateCol: {
      width: 34,
      alignItems: 'center',
      marginRight: 10,
    },
    dateMonth: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    dateDay: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 1,
    },
    iconCol: {
      marginRight: 12,
    },
    infoCol: {
      flex: 1,
      marginRight: 10,
    },
    descRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    syncBadge: {
      marginLeft: 6,
    },
    description: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
      letterSpacing: -0.1,
    },
    payer: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '400',
    },
    amountCol: {
      alignItems: 'flex-end',
    },
    lentLabel: {
      fontSize: 12,
      color: colors.income,
      fontWeight: '500',
    },
    lentAmount: {
      fontSize: 14,
      color: colors.income,
      fontWeight: '700',
      marginTop: 1,
    },
    borrowedLabel: {
      fontSize: 12,
      color: colors.expense,
      fontWeight: '500',
    },
    borrowedAmount: {
      fontSize: 14,
      color: colors.expense,
      fontWeight: '700',
      marginTop: 1,
    },
    notInvolved: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '400',
    },
  });
