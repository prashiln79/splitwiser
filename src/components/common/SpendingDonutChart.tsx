import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { G, Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { formatCurrency } from '../../utils/currency';

export interface DonutDataItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  count?: number;
}

interface SpendingDonutChartProps {
  data: DonutDataItem[];
  totalAmount: number;
  size?: number;
  currencySymbol?: string;
  onSelectCategory?: (category: string | null) => void;
}

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({
  data,
  totalAmount,
  size = 200,
  currencySymbol = '₹',
  onSelectCategory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const radius = size * 0.38;
  const strokeWidth = size * 0.14;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Active item to display in the center
  const activeItem = data.find((d) => d.category === selectedCategory);
  const displayAmount = activeItem ? activeItem.amount : totalAmount;
  const displayTitle = activeItem ? activeItem.category : 'Total Spent';
  const displaySubtitle = activeItem
    ? `${activeItem.percentage.toFixed(0)}% of total`
    : `${data.length} ${data.length === 1 ? 'category' : 'categories'}`;

  const handleSlicePress = (category: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const next = selectedCategory === category ? null : category;
    setSelectedCategory(next);
    onSelectCategory?.(next);
  };

  if (totalAmount <= 0 || data.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
        </Svg>
        <View style={styles.centerOverlay}>
          <Text style={styles.emptyTitle}>No Expenses</Text>
          <Text style={styles.emptySubtitle}>in this period</Text>
        </View>
      </View>
    );
  }

  // Calculate cumulative offsets for each slice
  let accumulatedPercent = 0;

    const isWeb = Platform.OS === 'web';
    const gProps: any = isWeb
      ? { transform: `rotate(-90 ${center} ${center})` }
      : { rotation: -90, originX: center, originY: center };

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <G {...gProps}>
            {data.map((item) => {
              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += item.percentage;
              const isSelected = selectedCategory === item.category;

              const touchProps: any = isWeb
                ? {
                    onClick: () => handleSlicePress(item.category),
                    style: { cursor: 'pointer' },
                  }
                : {
                    onPress: () => handleSlicePress(item.category),
                  };

              return (
                <Circle
                  key={item.category}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  fill="transparent"
                  opacity={selectedCategory && !isSelected ? 0.35 : 1}
                  {...touchProps}
                />
              );
            })}
          </G>
        </Svg>

      {/* Interactive Center Information */}
      <TouchableOpacity
        style={styles.centerOverlay}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedCategory(null);
          onSelectCategory?.(null);
        }}
      >
        <Text style={styles.centerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <Text style={styles.centerAmount} numberOfLines={1}>
          {formatCurrency(displayAmount)}
        </Text>
        <Text style={styles.centerSubtitle} numberOfLines={1}>
          {displaySubtitle}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '65%',
    height: '65%',
    borderRadius: 999,
  },
  centerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  centerAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  centerSubtitle: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2,
  },
});

