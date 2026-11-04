import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { Users, ChevronRight, Copy, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography, spacing, radii, shadows } from '../../theme';
import { MemberAvatar } from './MemberAvatar';
import { StatusBadge } from './StatusBadge';
import { Group } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface GroupCardProps {
  group: Group;
  netBalance?: number;
  isSettled?: boolean;
  onPress: () => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  netBalance = 0,
  isSettled = true,
  onPress,
}) => {
  const { colors } = useAppTheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const handleShareCode = async (e: any) => {
    e.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!group.joinCode) return;
    try {
      await Share.share({
        message: `Join my "${group.name}" group on Splitwiser using join code: ${group.joinCode}`,
      });
    } catch {
      // Ignored
    }
  };

  const memberCount = group.memberIds?.length || 1;

  let balanceVariant: 'settled' | 'lent' | 'borrowed' = 'settled';
  let balanceLabel = 'Settled up';

  if (!isSettled && Math.abs(netBalance) >= 0.01) {
    if (netBalance > 0) {
      balanceVariant = 'lent';
      balanceLabel = `Owed ${formatCurrency(netBalance)}`;
    } else {
      balanceVariant = 'borrowed';
      balanceLabel = `Owe ${formatCurrency(Math.abs(netBalance))}`;
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        shadows.sm,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Group ${group.name}. ${balanceLabel}. Join code ${group.joinCode}`}
    >
      <View style={styles.contentRow}>
        {/* Left: Avatar */}
        <MemberAvatar
          name={group.name}
          imageUrl={group.imageUrl}
          size={48}
        />

        {/* Center: Info */}
        <View style={styles.centerInfo}>
          <Text
            style={[styles.groupName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {group.name}
          </Text>

          {/* Member count & Join Code Row */}
          <View style={styles.metaRow}>
            <View style={styles.membersMeta}>
              <Users size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>

            {group.joinCode ? (
              <TouchableOpacity
                onPress={handleShareCode}
                style={[
                  styles.codeChip,
                  { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Group code ${group.joinCode}. Tap to share.`}
              >
                <Text style={[styles.codeText, { color: colors.primaryDark }]}>
                  {group.joinCode}
                </Text>
                <Share2 size={10} color={colors.primaryDark} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Right: Balance Pill & Chevron */}
        <View style={styles.rightSection}>
          <StatusBadge variant={balanceVariant} label={balanceLabel} size="sm" />
          <ChevronRight size={16} color={colors.textMuted} style={styles.chevron} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  groupName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  membersMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  codeText: {
    fontSize: typography.sizes.xs - 1,
    fontFamily: 'Courier',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});

