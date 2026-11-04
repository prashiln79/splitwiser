import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppTheme, spacing } from '../../theme';
import { formatCurrency } from '../../utils/currency';

interface BalanceCardProps {
  totalOwed: number; // Others owe me
  totalOwes: number; // I owe others
  onPress?: () => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalOwed,
  totalOwes,
  onPress,
}) => {
  const { colors, isDark } = useAppTheme();
  const netBalance = totalOwed - totalOwes;
  const isSettled = Math.abs(netBalance) < 0.01;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress();
  };

  // Determine balance text and color
  let statusText = 'All settled up';
  let statusColor = '#0D8A58'; // Rich emerald green

  if (!isSettled) {
    if (netBalance > 0) {
      statusText = `You are owed ${formatCurrency(netBalance)}`;
      statusColor = '#0D8A58';
    } else {
      statusText = `You owe ${formatCurrency(Math.abs(netBalance))}`;
      statusColor = '#DC2626';
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#14291F' : '#E6F7F0',
          borderColor: isDark ? '#1E4030' : '#D1F0E2',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Your balance: ${statusText}`}
    >
      {/* Decorative Wave & Receipt Graphic on the right */}
      <View style={styles.illustrationContainer} pointerEvents="none">
        <Svg width={100} height={78} viewBox="0 0 100 78">
          {/* Subtle curved background blob flowing to the right edge */}
          <Path
            d="M 12 78 C 30 52, 45 40, 100 32 L 100 78 Z"
            fill={isDark ? '#1B3D2C' : '#D2F2E2'}
          />

          {/* Slightly tilted Receipt */}
          <G transform="translate(54, 11) rotate(8)">
            {/* Receipt body with dog-eared top-right and sawtooth serrated bottom */}
            <Path
              d="
                M 5 0
                L 23 0
                L 31 8
                L 31 46
                L 27 42.5
                L 23 46
                L 19 42.5
                L 15 46
                L 11 42.5
                L 7 46
                L 3 42.5
                L 0 45.5
                L 0 5
                Q 0 0 5 0
                Z
              "
              fill={isDark ? '#234E39' : '#FFFFFF'}
              stroke={isDark ? '#3D7D5E' : '#7DCE9F'}
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            {/* Folded top-right corner */}
            <Path
              d="M 23 0 L 23 8 L 31 8 Z"
              fill={isDark ? '#2B5E45' : '#E2F7ED'}
              stroke={isDark ? '#3D7D5E' : '#7DCE9F'}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Center Rupee Symbol */}
            <SvgText
              x="15.5"
              y="28"
              fill={isDark ? '#7EE0AE' : '#57BA87'}
              fontSize="18"
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              ₹
            </SvgText>
          </G>
        </Svg>
      </View>

      {/* Left Content */}
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: isDark ? '#98BFA9' : '#556E61' }]}>
          Your balance
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountText, { color: statusColor }]}>
            {statusText}
          </Text>
          <ChevronRight
            size={18}
            color={statusColor}
            strokeWidth={2.4}
            style={styles.chevron}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 82,
    justifyContent: 'center',
  },
  illustrationContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    top: 0,
    width: 100,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  textContainer: {
    zIndex: 1,
    paddingRight: 75, // Ensures text never collides with the receipt illustration
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  chevron: {
    marginLeft: 6,
  },
});
