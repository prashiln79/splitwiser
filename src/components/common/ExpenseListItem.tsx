import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
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
      style={styles.container}
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Expense ${expense.description}, amount ${formatCurrency(expense.amount)}`}
    >
      {/* Date column */}
      <View style={styles.dateCol}>
        <Text style={styles.dateMonth}>{monthStr}</Text>
        <Text style={styles.dateDay}>{dayStr}</Text>
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
          <Text style={styles.description} numberOfLines={1}>
            {expense.description}
          </Text>
          {expense.syncStatus === 'pending' && (
            <View style={styles.syncBadge} testID="sync-pending-badge">
              <Clock size={12} color="#9E9E9E" />
            </View>
          )}
          {expense.syncStatus === 'failed' && (
            <View style={styles.syncBadge} testID="sync-failed-badge">
              <AlertCircle size={12} color="#E74C3C" />
            </View>
          )}
        </View>
        <Text style={styles.payer} numberOfLines={1}>
          {isPayerMe ? 'You' : payerName} paid {formatCurrency(expense.amount)}
        </Text>
      </View>

      {/* Amount & net share */}
      <View style={styles.amountCol}>
        {isPayerMe ? (
          lentAmount > 0 ? (
            <>
              <Text style={styles.lentLabel}>you lent</Text>
              <Text style={styles.lentAmount}>
                {formatCurrency(lentAmount)}
              </Text>
            </>
          ) : (
            <Text style={styles.notInvolved}>not involved</Text>
          )
        ) : borrowedAmount > 0 ? (
          <>
            <Text style={styles.borrowedLabel}>you borrowed</Text>
            <Text style={styles.borrowedAmount}>
              {formatCurrency(borrowedAmount)}
            </Text>
          </>
        ) : (
          <Text style={styles.notInvolved}>not involved</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  dateCol: {
    width: 34,
    alignItems: 'center',
    marginRight: 10,
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9E9E9E',
    textTransform: 'capitalize',
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
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
    color: '#1A1A1A',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  payer: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '400',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  lentLabel: {
    fontSize: 12,
    color: '#1CC88A',
    fontWeight: '500',
  },
  lentAmount: {
    fontSize: 14,
    color: '#1CC88A',
    fontWeight: '700',
    marginTop: 1,
  },
  borrowedLabel: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
  },
  borrowedAmount: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '700',
    marginTop: 1,
  },
  notInvolved: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '400',
  },
});
