import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowUpRight, ArrowDownLeft, Plus, Hash, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography, spacing, radii, shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';

interface BalanceCardProps {
  totalOwed: number; // Others owe me
  totalOwes: number; // I owe others
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalOwed,
  totalOwes,
  onCreateGroup,
  onJoinGroup,
}) => {
  const { colors, isDark } = useAppTheme();
  const netBalance = totalOwed - totalOwes;
  const isSettled = Math.abs(netBalance) < 0.01;

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onCreateGroup) onCreateGroup();
  };

  const handleJoin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onJoinGroup) onJoinGroup();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        shadows.sm,
      ]}
    >
      {/* Header Label */}
      <View style={styles.topRow}>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
          NET BALANCE
        </Text>
        {isSettled ? (
          <View style={[styles.settledPill, { backgroundColor: colors.incomeLight }]}>
            <CheckCircle2 size={12} color={colors.income} strokeWidth={2.5} />
            <Text style={[styles.settledPillText, { color: colors.incomeDark }]}>
              All Settled
            </Text>
          </View>
        ) : null}
      </View>

      {/* Main Net Amount */}
      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.netAmount,
            {
              color: isSettled
                ? colors.textPrimary
                : netBalance > 0
                ? colors.income
                : colors.expense,
            },
          ]}
        >
          {isSettled
            ? formatCurrency(0)
            : `${netBalance > 0 ? '+' : '-'}${formatCurrency(Math.abs(netBalance))}`}
        </Text>
        <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
          {isSettled
            ? 'You do not owe or have outstanding balances.'
            : netBalance > 0
            ? 'Overall, you are owed across all groups.'
            : 'Overall, you owe across all groups.'}
        </Text>
      </View>

      {/* Metric Tiles */}
      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricTile,
            { backgroundColor: colors.incomeLight, borderColor: colors.income + '25' },
          ]}
        >
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconCircle,
                { backgroundColor: colors.income + '20' },
              ]}
            >
              <ArrowUpRight size={14} color={colors.income} strokeWidth={2.5} />
            </View>
            <Text style={[styles.metricLabel, { color: colors.incomeDark }]}>
              You are owed
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.incomeDark }]}>
            {formatCurrency(totalOwed)}
          </Text>
        </View>

        <View
          style={[
            styles.metricTile,
            { backgroundColor: colors.expenseLight, borderColor: colors.expense + '25' },
          ]}
        >
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconCircle,
                { backgroundColor: colors.expense + '20' },
              ]}
            >
              <ArrowDownLeft size={14} color={colors.expense} strokeWidth={2.5} />
            </View>
            <Text style={[styles.metricLabel, { color: colors.expenseDark }]}>
              You owe
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.expenseDark }]}>
            {formatCurrency(totalOwes)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionsRow, { borderTopColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.primaryAction, { backgroundColor: colors.primary }]}
          onPress={handleCreate}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create a new group"
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={styles.primaryActionText}>New Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryAction,
            { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
          ]}
          onPress={handleJoin}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Join group with code"
        >
          <Hash
            size={16}
            color={colors.textPrimary}
            strokeWidth={2}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>
            Join with Code
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.base,
    borderWidth: 1,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  settledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    gap: 4,
  },
  settledPillText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
  },
  amountContainer: {
    marginVertical: spacing.xs,
  },
  netAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metricTile: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  metricIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radii.md,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontWeight: '600',
    fontSize: typography.sizes.sm,
  },
});

