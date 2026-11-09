import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Home, Plane, Utensils, Heart, Briefcase, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Group } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';

export interface GroupSubBalance {
  memberName: string;
  amount: number;
  type: 'owes_you' | 'you_owe';
}

interface GroupCardProps {
  group: Group;
  netBalance?: number;
  isSettled?: boolean;
  subBalances?: GroupSubBalance[];
  onPress: () => void;
}

const BG_COLORS = [
  '#059669', // Emerald
  '#0284C7', // Sky
  '#7C3AED', // Violet
  '#EA580C', // Orange
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#DB2777', // Pink
];

const getGroupColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
};

const getGroupSmartIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (/\b(apartment|flat|rent|home|house|room|living|pg|society)\b/.test(lower)) {
    return { icon: Home, bg: '#0D9488' }; // Teal
  }
  if (/\b(trip|travel|tour|vacation|flight|beach|road|holiday|goa|paris|trunk)\b/.test(lower)) {
    return { icon: Plane, bg: '#0284C7' }; // Sky Blue
  }
  if (/\b(dinner|food|party|drinks|bar|restaurant|cafe|coffee|lunch|brewery)\b/.test(lower)) {
    return { icon: Utensils, bg: '#D97706' }; // Amber
  }
  if (/\b(love|couple|heart|anniversary|elle|earl)\b/.test(lower)) {
    return { icon: Heart, bg: '#9F1239' }; // Deep Rose Red (Splitwise Style)
  }
  if (/\b(office|work|project|business|company)\b/.test(lower)) {
    return { icon: Briefcase, bg: '#4F46E5' }; // Indigo
  }
  return null;
};

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  netBalance = 0,
  isSettled = true,
  subBalances = [],
  onPress,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [imageError, setImageError] = useState(false);

  // Priority: Group Cover Photo (makes group visually identifiable on Home) or group avatar
  const rawImage = group.coverPhoto?.imageUrl || group.bannerUrl || group.imageUrl;

  useEffect(() => {
    setImageError(false);
  }, [rawImage]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  // Normalize and validate group image URI (supports https, data:image, file, content)
  let imageUri: string | null = null;
  if (rawImage) {
    const raw = rawImage.trim();
    if (/^(https?:|data:image|file:|content:)/i.test(raw)) {
      imageUri = raw;
    } else if (raw.startsWith('/') || raw.startsWith('file:')) {
      imageUri = raw.startsWith('file:') ? raw : `file://${raw}`;
    } else if (raw.length > 50 && !raw.includes(' ')) {
      // Raw base64 string without data:image prefix
      imageUri = `data:image/jpeg;base64,${raw}`;
    }
  }

  const hasValidImage = Boolean(imageUri && !imageError);
  const smartConfig = getGroupSmartIcon(group.name || '');
  const bgColor = smartConfig?.bg || getGroupColor(group.name || 'Group');
  const SmartIcon = smartConfig?.icon;
  const initial = (group.name || '?').trim().charAt(0).toUpperCase();

  // Determine balance text & color
  let balanceText = 'settled up';
  let balanceColor = colors.textMuted;

  if (!isSettled && Math.abs(netBalance) >= 0.01) {
    if (netBalance > 0) {
      balanceText = `you are owed ${formatCurrency(netBalance)}`;
      balanceColor = colors.income;
    } else {
      balanceText = `you owe ${formatCurrency(Math.abs(netBalance))}`;
      balanceColor = colors.expense;
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: isDark ? '#1E293B' : '#F8F8F8' },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Group ${group.name}. ${balanceText}`}
    >
      {/* Rounded Rect Avatar / Thumbnail */}
      {hasValidImage ? (
        <Image
          source={{ uri: imageUri! }}
          style={styles.thumbnail}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : SmartIcon ? (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: bgColor }]}>
          <SmartIcon size={24} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      ) : (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: bgColor }]}>
          <Text style={styles.thumbnailInitial}>{initial}</Text>
        </View>
      )}

      {/* Info Column */}
      <View style={styles.infoContainer}>
        {/* Group Name */}
        <Text style={[styles.groupName, { color: colors.textPrimary }]} numberOfLines={1}>
          {group.name}
        </Text>

        {/* Primary Balance Status */}
        <Text style={[styles.balanceText, { color: balanceColor }]} numberOfLines={1}>
          {balanceText}
        </Text>

        {/* Sub-balances (Who owes what) */}
        {!isSettled && subBalances.length > 0 && (
          <View style={styles.subBalancesList}>
            {subBalances.slice(0, 3).map((sub, idx) => {
              const isOwesYou = sub.type === 'owes_you';
              return (
                <Text key={idx} style={styles.subBalanceLine} numberOfLines={1}>
                  <Text style={[styles.subMemberName, { color: colors.textSecondary }]}>
                    {isOwesYou ? `${sub.memberName} owes you ` : `You owe ${sub.memberName} `}
                  </Text>
                  <Text style={[isOwesYou ? styles.subAmountOwed : styles.subAmountOwe, { color: isOwesYou ? colors.income : colors.expense }]}>
                    {formatCurrency(sub.amount)}
                  </Text>
                </Text>
              );
            })}
          </View>
        )}
      </View>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    thumbnail: {
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F1F5F9',
    },
    thumbnailPlaceholder: {
      width: 58,
      height: 58,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnailInitial: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
    },
    infoContainer: {
      flex: 1,
      marginLeft: 14,
      justifyContent: 'center',
    },
    groupName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    balanceText: {
      fontSize: 14,
      fontWeight: '600',
    },
    subBalancesList: {
      marginTop: 3,
      gap: 1,
    },
    subBalanceLine: {
      fontSize: 13,
    },
    subMemberName: {
      color: colors.textSecondary,
    },
    subAmountOwed: {
      color: colors.income,
      fontWeight: '600',
    },
    subAmountOwe: {
      color: colors.expense,
      fontWeight: '600',
    },
  });
