import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '../../utils/currency';

interface BalanceCardProps {
  totalOwed: number;
  totalOwes: number;
  onPress?: () => void;
  onFilterPress?: () => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalOwed,
  totalOwes,
  onPress,
  onFilterPress,
}) => {
  const isSettled = totalOwed < 0.01 && totalOwes < 0.01;
  const hasOwed = totalOwed >= 0.01;
  const hasOwes = totalOwes >= 0.01;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
  };

  const handleFilter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onFilterPress) onFilterPress();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.textContainer}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        {isSettled ? (
          <Text style={styles.settledText}>
            Overall, you are all settled up
          </Text>
        ) : hasOwes && hasOwed ? (
          <View>
            <Text style={styles.balanceLine}>
              Overall, you owe{' '}
              <Text style={styles.oweAmount}>{formatCurrency(totalOwes)}</Text>
            </Text>
            <Text style={[styles.balanceLine, { marginTop: 2 }]}>
              and you are owed{' '}
              <Text style={styles.owedAmount}>{formatCurrency(totalOwed)}</Text>
            </Text>
          </View>
        ) : hasOwes ? (
          <Text style={styles.balanceLine}>
            Overall, you owe{' '}
            <Text style={styles.oweAmount}>{formatCurrency(totalOwes)}</Text>
          </Text>
        ) : (
          <Text style={styles.balanceLine}>
            Overall, you are owed{' '}
            <Text style={styles.owedAmount}>{formatCurrency(totalOwed)}</Text>
          </Text>
        )}
      </TouchableOpacity>

      {onFilterPress && (
        <TouchableOpacity
          onPress={handleFilter}
          style={styles.filterBtn}
          accessibilityLabel="Filter balances"
          accessibilityRole="button"
        >
          <SlidersHorizontal size={20} color="#6B6B6B" strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  balanceLine: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '400',
    lineHeight: 22,
  },
  settledText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  owedAmount: {
    color: '#1CC88A',
    fontWeight: '700',
  },
  oweAmount: {
    color: '#E74C3C',
    fontWeight: '700',
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
