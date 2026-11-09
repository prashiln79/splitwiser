import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';

export interface MonthTrendItem {
  monthLabel: string;
  year: number;
  monthIdx: number;
  total: number;
  count: number;
}

interface MonthlyTrendsChartProps {
  data: MonthTrendItem[];
  height?: number;
}

export const MonthlyTrendsChart: React.FC<MonthlyTrendsChartProps> = ({
  data,
  height = 160,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const chartHeight = height - 40; // reserved for month labels

  const selectedItem = data.find((d) => `${d.monthLabel}-${d.year}` === selectedMonth);

  const handleBarPress = (item: MonthTrendItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const key = `${item.monthLabel}-${item.year}`;
    setSelectedMonth(selectedMonth === key ? null : key);
  };

  return (
    <View style={styles.container}>
      {/* Detail Callout Pill if a month is tapped */}
      {selectedItem ? (
        <View style={styles.calloutBanner}>
          <Text style={styles.calloutMonthText}>
            {selectedItem.monthLabel} {selectedItem.year}:
          </Text>
          <Text style={styles.calloutAmountText}>
            {formatCurrency(selectedItem.total)}
          </Text>
          <Text style={styles.calloutCountText}>
            ({selectedItem.count} {selectedItem.count === 1 ? 'bill' : 'bills'})
          </Text>
        </View>
      ) : (
        <View style={styles.calloutBannerHint}>
          <Text style={styles.calloutHintText}>Tap any month bar to inspect spending</Text>
        </View>
      )}

      {/* SVG Bar Chart */}
      <View style={[styles.chartWrapper, { height }]}>
        {data.map((item, idx) => {
          const isSelected = `${item.monthLabel}-${item.year}` === selectedMonth;
          const isHighest = item.total === maxTotal && maxTotal > 0;
          const barHeightRatio = item.total > 0 ? item.total / maxTotal : 0;
          const barPixelHeight = Math.max(item.total > 0 ? 8 : 2, barHeightRatio * chartHeight);

          return (
            <TouchableOpacity
              key={`${item.monthLabel}-${idx}`}
              style={styles.barColumn}
              onPress={() => handleBarPress(item)}
              activeOpacity={0.7}
            >
              {/* Value pill on top of highest or selected bar */}
              {(isSelected || (isHighest && !selectedMonth)) && item.total > 0 && (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              )}

              {/* Bar track and fill */}
              <View style={[styles.barTrack, { height: chartHeight }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: barPixelHeight,
                      backgroundColor: isSelected
                        ? '#047857'
                        : isHighest
                        ? '#059669'
                        : item.total > 0
                        ? '#6EE7B7'
                        : '#E5E7EB',
                    },
                  ]}
                />
              </View>

              {/* Month Label */}
              <Text
                style={[
                  styles.monthLabel,
                  isSelected && styles.monthLabelSelected,
                  isHighest && styles.monthLabelHighest,
                ]}
              >
                {item.monthLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    calloutBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
      alignSelf: 'center',
    },
    calloutMonthText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    calloutAmountText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    calloutCountText: {
      fontSize: 11,
      color: colors.primary,
    },
    calloutBannerHint: {
      alignItems: 'center',
      marginBottom: 10,
    },
    calloutHintText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    chartWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    topBadge: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#111827',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginBottom: 4,
    },
    topBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    barTrack: {
      width: 22,
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
    },
    barFill: {
      width: '100%',
      borderRadius: 6,
    },
    monthLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
      marginTop: 8,
    },
    monthLabelSelected: {
      color: colors.primary,
      fontWeight: '800',
    },
    monthLabelHighest: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
  });

