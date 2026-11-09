import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
  Share,
} from 'react-native';
import { ArrowLeft, Settings, Camera, Gem, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, OptimizedSettlement } from '../../types';
import { formatCurrency } from '../../utils/currency';

export const COVER_SCROLL_DISTANCE = 140; // Scroll distance after which the cover body completely collapses

export type TabKey = 'expenses' | 'settle' | 'balances' | 'total' | 'charts';

export interface TabItem {
  key: TabKey;
  label: string;
  hasSparkle?: boolean;
}

export const TABS: TabItem[] = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'settle', label: 'Settle up' },
  { key: 'balances', label: 'Balances' },
  { key: 'total', label: 'Totals' },
  { key: 'charts', label: 'Charts', hasSparkle: true },
];

export interface GroupCoverHeaderProps {
  group: Group | null;
  initialGroupName?: string;
  memberCount: number;
  netBalance: number;
  settlements?: OptimizedSettlement[];
  currentUserId?: string;
  onShareCode?: () => void;
  children?: React.ReactNode;
}

export const GroupCoverHeader: React.FC<GroupCoverHeaderProps> = ({
  group,
  initialGroupName,
  memberCount,
  netBalance,
  settlements = [],
  currentUserId = '',
  onShareCode,
  children,
}) => {
  const insets = useSafeAreaInsets();

  const handleShareCode = async () => {
    if (onShareCode) {
      onShareCode();
      return;
    }
    if (!group?.joinCode) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await Share.share({
        message: `Join our "${group.name}" group on Splitwiser! Use code: ${group.joinCode}`,
      });
    } catch {
      // Ignored
    }
  };

  // Resolved cover image URL: only if explicitly set via coverPhoto or bannerUrl (no default)
  const coverImageUrl = useMemo(() => {
    if (group?.coverPhoto?.imageUrl?.trim()) return group.coverPhoto.imageUrl.trim();
    if (group?.bannerUrl?.trim()) return group.bannerUrl.trim();
    return null;
  }, [group?.coverPhoto?.imageUrl, group?.bannerUrl]);

  const hasCover = Boolean(coverImageUrl);

  // Formatted creation date (e.g., "Jul 2019" matching Splitwise screenshot)
  const createdDateStr = useMemo(() => {
    if (!group?.createdAt) return '';
    const d = new Date(group.createdAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [group?.createdAt]);

  // Balance status sentence
  const balanceSummary = useMemo(() => {
    const safeNet = typeof netBalance === 'number' && !isNaN(netBalance) ? netBalance : 0;
    const isSettled = Math.abs(safeNet) < 0.01;
    if (isSettled) {
      return {
        text: 'All settled up',
        isSettled: true,
      };
    }

    const safeSettlements = Array.isArray(settlements) ? settlements : [];
    const myOwedSettlements = safeSettlements.filter(
      (s) => s.toUserId === currentUserId && s.amount > 0.01
    );
    const myOwingSettlements = safeSettlements.filter(
      (s) => s.fromUserId === currentUserId && s.amount > 0.01
    );

    if (myOwedSettlements.length === 1 && myOwingSettlements.length === 0) {
      const s = myOwedSettlements[0];
      return {
        prefix: `${s.fromUserName} owes you `,
        amount: formatCurrency(s.amount),
        isPositive: true,
      };
    }

    if (myOwingSettlements.length === 1 && myOwedSettlements.length === 0) {
      const s = myOwingSettlements[0];
      return {
        prefix: `You owe ${s.toUserName} `,
        amount: formatCurrency(s.amount),
        isPositive: false,
      };
    }

    if (safeNet > 0.01) {
      return {
        prefix: 'You are owed ',
        amount: `${formatCurrency(safeNet)} overall`,
        isPositive: true,
      };
    }

    return {
      prefix: 'You owe ',
      amount: `${formatCurrency(Math.abs(safeNet))} overall`,
      isPositive: false,
    };
  }, [netBalance, settlements, currentUserId]);

  const groupDisplayName = group?.name || initialGroupName || 'Group';

  return (
    <View
      style={[
        styles.coverContainer,
        {
          backgroundColor: hasCover ? '#1E293B' : '#FFFFFF',
          paddingTop: insets.top + (hasCover ? 48 : 32),
          minHeight: hasCover ? 200 : undefined,
        },
      ]}
    >
      {/* Landscape Cover Photo Background with Scrim Overlays */}
      {hasCover && (
        <>
          <Image
            source={{ uri: coverImageUrl! }}
            style={styles.coverImageBackground}
            resizeMode="cover"
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0, 0, 0, 0.36)' },
            ]}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: insets.top + 52,
              backgroundColor: 'rgba(0, 0, 0, 0.22)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 72,
              backgroundColor: 'rgba(0, 0, 0, 0.42)',
            }}
          />
        </>
      )}

      {/* Cover Header Body Content */}
      <View style={styles.coverBodyContent}>
        {/* Group Name Title (Centered, Splitwise Typography) */}
        <Text
          style={[
            styles.groupTitleText,
            hasCover ? styles.groupTitleDark : styles.groupTitleLight,
          ]}
          numberOfLines={2}
        >
          {groupDisplayName}
        </Text>

        {/* Member Count & Creation Date (Centered) */}
        <View style={styles.metaRow}>
          <Text
            style={[
              styles.metaText,
              hasCover ? styles.metaTextDark : styles.metaTextLight,
            ]}
          >
            {memberCount} {memberCount === 1 ? 'person' : 'people'}
            {createdDateStr ? ` • Created ${createdDateStr}` : ''}
          </Text>
        </View>

        {/* Group Join Code Pill */}
        {group?.joinCode ? (
          <TouchableOpacity
            style={[
              styles.codeBadge,
              hasCover ? styles.codeBadgeDark : styles.codeBadgeLight,
            ]}
            onPress={handleShareCode}
            activeOpacity={0.75}
            accessibilityLabel={`Group join code: ${group.joinCode}. Tap to share.`}
            accessibilityRole="button"
          >
            <Share2
              size={11}
              color={hasCover ? '#FFFFFF' : '#059669'}
              strokeWidth={2.4}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.codeBadgePrefix,
                hasCover ? styles.codeBadgePrefixDark : styles.codeBadgePrefixLight,
              ]}
            >
              Code:{' '}
            </Text>
            <Text
              style={[
                styles.codeBadgeValue,
                hasCover ? styles.codeBadgeValueDark : styles.codeBadgeValueLight,
              ]}
            >
              {group.joinCode}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Current Balance Summary Sentence */}
        <View style={styles.balanceRow}>
          {balanceSummary.text ? (
            <Text
              style={[
                styles.balanceText,
                hasCover
                  ? styles.balanceTextDark
                  : styles.balanceSettledLight,
              ]}
            >
              {balanceSummary.text}
            </Text>
          ) : (
            <Text
              style={[
                styles.balanceText,
                hasCover ? styles.balanceTextDark : styles.balancePrefixLight,
              ]}
            >
              {balanceSummary.prefix}
              <Text
                style={[
                  styles.balanceAmountText,
                  hasCover
                    ? styles.balanceAmountDark
                    : balanceSummary.isPositive
                    ? styles.balanceAmountPositiveLight
                    : styles.balanceAmountNegativeLight,
                ]}
              >
                {balanceSummary.amount}
              </Text>
            </Text>
          )}
        </View>
      </View>

      {/* Optional Children (Inline Navigation Pill Tabs) */}
      {children}
    </View>
  );
};

export interface GroupTopBarProps {
  group: Group | null;
  initialGroupName?: string;
  hasCover: boolean;
  onBack: () => void;
  onSettings: () => void;
  onEditCover?: () => void;
  scrollY: Animated.Value;
}

export const GroupTopBar: React.FC<GroupTopBarProps> = ({
  group,
  initialGroupName,
  hasCover,
  onBack,
  onSettings,
  onEditCover,
  scrollY,
}) => {
  const insets = useSafeAreaInsets();
  const groupDisplayName = group?.name || initialGroupName || 'Group';

  // Smooth background fade-in as user scrolls down
  const bgOpacity = scrollY.interpolate({
    inputRange: [40, 110],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Border fade-in
  const borderOpacity = scrollY.interpolate({
    inputRange: [70, 110],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Mini title fade-in
  const miniTitleOpacity = scrollY.interpolate({
    inputRange: [60, 110],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Icon backdrop opacity (fades out as header background becomes solid)
  const iconBgOpacity = scrollY.interpolate({
    inputRange: [40, 90],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.topBarContainer,
        {
          height: insets.top + 44,
          paddingTop: insets.top,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Solid background layer that fades in smoothly */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#FFFFFF',
            opacity: bgOpacity,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(229, 231, 235, 0.9)',
          },
        ]}
      />

      <View style={styles.topBarContent}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          {hasCover && (
            <Animated.View
              style={[
                styles.navBtnBackdrop,
                { opacity: iconBgOpacity },
              ]}
            />
          )}
          <ArrowLeft
            size={22}
            color={hasCover ? '#FFFFFF' : '#1F2937'}
            strokeWidth={2.4}
          />
        </TouchableOpacity>

        {/* Compact Title (Smoothly appears when cover scrolls off-screen) */}
        <Animated.View
          style={[styles.miniTitleWrapper, { opacity: miniTitleOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.miniTitleText} numberOfLines={1}>
            {groupDisplayName}
          </Text>
        </Animated.View>

        {/* Right Action Buttons */}
        <View style={styles.topBarRightActions}>
          {onEditCover && (
            <TouchableOpacity
              style={hasCover ? styles.topBarBtn : styles.addCoverPillBtnLight}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                onEditCover();
              }}
              activeOpacity={0.75}
              accessibilityLabel={hasCover ? 'Change cover photo' : 'Add cover photo'}
              accessibilityRole="button"
            >
              {hasCover && (
                <Animated.View
                  style={[
                    styles.navBtnBackdrop,
                    { opacity: iconBgOpacity },
                  ]}
                />
              )}
              <Camera
                size={hasCover ? 18 : 14}
                color={hasCover ? '#FFFFFF' : '#059669'}
                strokeWidth={2.2}
              />
              {!hasCover && (
                <Text style={styles.addCoverPillTextLight}>Add cover</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={onSettings}
            activeOpacity={0.7}
            accessibilityLabel="Group settings"
            accessibilityRole="button"
          >
            {hasCover && (
              <Animated.View
                style={[
                  styles.navBtnBackdrop,
                  { opacity: iconBgOpacity },
                ]}
              />
            )}
            <Settings
              size={20}
              color={hasCover ? '#FFFFFF' : '#1F2937'}
              strokeWidth={2.2}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export interface GroupPillTabsProps {
  activeTabIndex: number;
  onTabPress: (index: number) => void;
  hasCover?: boolean;
  isSticky?: boolean;
}

export const GroupPillTabs: React.FC<GroupPillTabsProps> = ({
  activeTabIndex,
  onTabPress,
  hasCover = false,
  isSticky = false,
}) => {
  return (
    <View
      style={[
        styles.pillTabsContainer,
        isSticky && styles.pillTabsContainerSticky,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillTabsScrollContent}
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTabIndex === idx;

          let pillBgStyle: any;
          let textColor: string;

          if (isActive) {
            pillBgStyle = styles.pillActive;
            textColor = '#FFFFFF';
          } else if (hasCover && !isSticky) {
            pillBgStyle = styles.pillCoverInactive;
            textColor = '#111827';
          } else {
            pillBgStyle = styles.pillLightInactive;
            textColor = '#374151';
          }

          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.pillBase, pillBgStyle]}
              onPress={() => onTabPress(idx)}
              activeOpacity={0.75}
            >
              {tab.hasSparkle && (
                <Gem
                  size={13}
                  color={isActive ? '#FFFFFF' : '#059669'}
                  strokeWidth={2.5}
                  style={{ marginRight: 5 }}
                />
              )}
              <Text style={[styles.pillText, { color: textColor }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  coverContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  coverImageBackground: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  coverBodyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 2,
    zIndex: 5,
  },
  groupTitleText: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 6,
  },
  groupTitleDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  groupTitleLight: {
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  metaTextDark: {
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaTextLight: {
    color: '#6B7280',
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 14,
    marginBottom: 10,
    alignSelf: 'center',
  },
  codeBadgeDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  codeBadgeLight: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  codeBadgePrefix: {
    fontSize: 12,
    fontWeight: '500',
  },
  codeBadgePrefixDark: {
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  codeBadgePrefixLight: {
    color: '#065F46',
  },
  codeBadgeValue: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  codeBadgeValueDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  codeBadgeValueLight: {
    color: '#059669',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  balanceText: {
    fontSize: 15,
    textAlign: 'center',
  },
  balanceTextDark: {
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  balancePrefixLight: {
    color: '#4B5563',
    fontWeight: '500',
  },
  balanceSettledLight: {
    color: '#059669',
    fontWeight: '600',
  },
  balanceAmountText: {
    fontWeight: '700',
  },
  balanceAmountDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  balanceAmountPositiveLight: {
    color: '#059669',
  },
  balanceAmountNegativeLight: {
    color: '#DC2626',
  },

  // Top Bar Styles
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  topBarContent: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navBtnBackdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  miniTitleWrapper: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  topBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addCoverPillBtnLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginRight: 4,
  },
  addCoverPillTextLight: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Pill Tabs
  pillTabsContainer: {
    paddingVertical: 10,
    zIndex: 5,
  },
  pillTabsContainerSticky: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    paddingVertical: 8,
  },
  pillTabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  pillBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillActive: {
    backgroundColor: '#059669', // Emerald
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  pillCoverInactive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  pillLightInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
