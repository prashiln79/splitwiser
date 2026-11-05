import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '../../utils/currency';

interface BalanceCardProps {
  totalOwed: number;
  totalOwes: number;
  onPress?: () => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalOwed,
  totalOwes,
  onPress,
}) => {
  const netBalance = totalOwed - totalOwes;
  const isSettled = Math.abs(netBalance) < 0.01;
  const hasOwed = totalOwed > 0.01;
  const hasOwes = totalOwes > 0.01;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
  };

  // If completely settled, show a single-line message
  if (isSettled && !hasOwed && !hasOwes) {
    return (
      <TouchableOpacity
        style={styles.settledContainer}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel="All settled up"
      >
        <Text style={styles.settledText}>✓ All settled up</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Overall: you are owed ${formatCurrency(totalOwed)}, you owe ${formatCurrency(totalOwes)}`}
    >
      {/* Overall summary line */}
      <Text style={styles.overallText}>
        Overall,{' '}
        {netBalance > 0 ? (
          <>
            <Text style={styles.owedInline}>you are owed </Text>
            <Text style={[styles.owedInline, styles.owedAmount]}>
              {formatCurrency(netBalance)}
            </Text>
          </>
        ) : netBalance < 0 ? (
          <>
            <Text style={styles.oweInline}>you owe </Text>
            <Text style={[styles.oweInline, styles.oweAmount]}>
              {formatCurrency(Math.abs(netBalance))}
            </Text>
          </>
        ) : (
          <Text style={styles.settledInline}>you are all settled up</Text>
        )}
      </Text>

      {/* Two-line breakdown if both exist */}
      {hasOwed && hasOwes && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>you are owed </Text>
            <Text style={styles.breakdownOwed}>{formatCurrency(totalOwed)}</Text>
          </Text>
          <Text style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>you owe </Text>
            <Text style={styles.breakdownOwe}>{formatCurrency(totalOwes)}</Text>
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  settledContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  settledText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  overallText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  owedInline: {
    color: '#1CC88A',
    fontWeight: '500',
  },
  owedAmount: {
    fontWeight: '700',
  },
  oweInline: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  oweAmount: {
    fontWeight: '700',
  },
  settledInline: {
    color: '#9E9E9E',
    fontWeight: '500',
  },
  breakdownRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 16,
  },
  breakdownItem: {
    fontSize: 13,
  },
  breakdownLabel: {
    color: '#9E9E9E',
    fontWeight: '400',
  },
  breakdownOwed: {
    color: '#1CC88A',
    fontWeight: '600',
  },
  breakdownOwe: {
    color: '#E74C3C',
    fontWeight: '600',
  },
});
