import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { ArrowLeft, Settings, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, OptimizedSettlement } from '../../types';
import { MemberAvatar } from './MemberAvatar';
import { getDefaultCoverPhoto } from '../../constants/presetCovers';
import { formatCurrency } from '../../utils/currency';

export const COVER_SCROLL_DISTANCE = 86; // Distance the cover content collapses when scrolled

interface GroupCoverHeaderProps {
  group: Group | null;
  initialGroupName?: string;
  memberCount: number;
  netBalance: number;
  settlements?: OptimizedSettlement[];
  currentUserId?: string;
  onBack: () => void;
  onSettings: () => void;
  onEditCover?: () => void;
  scrollY?: Animated.Value;
}

export const GroupCoverHeader: React.FC<GroupCoverHeaderProps> = ({
  group,
  initialGroupName,
  memberCount,
  netBalance,
  settlements = [],
  currentUserId = '',
  onBack,
  onSettings,
  onEditCover,
  scrollY,
}) => {
  const insets = useSafeAreaInsets();

  // Resolved cover image URL: custom coverPhoto -> bannerUrl -> deterministic fallback
  const coverImageUrl = useMemo(() => {
    if (group?.coverPhoto?.imageUrl?.trim()) return group.coverPhoto.imageUrl.trim();
    if (group?.bannerUrl?.trim()) return group.bannerUrl.trim();
    const defaultCover = getDefaultCoverPhoto(
      group?.id || 'default',
      group?.icon,
      group?.name || initialGroupName
    );
    return defaultCover?.imageUrl || 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80';
  }, [group, initialGroupName]);

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
        isBold: false,
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

  // Smooth scroll-driven animation values
  const coverContentTranslateY = scrollY
    ? scrollY.interpolate({
        inputRange: [0, COVER_SCROLL_DISTANCE],
        outputRange: [0, -COVER_SCROLL_DISTANCE],
        extrapolate: 'clamp',
      })
    : 0;

  const coverContentOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, COVER_SCROLL_DISTANCE * 0.65],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : 1;

  const miniTitleOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [COVER_SCROLL_DISTANCE * 0.45, COVER_SCROLL_DISTANCE],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : 0;

  const totalHeaderHeight = insets.top + 44 + COVER_SCROLL_DISTANCE;

  return (
    <View style={[styles.headerContainer, { height: totalHeaderHeight }]}>
      {/* Landscape Cover Photo Background */}
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverImage, { backgroundColor: '#1E293B' }]} />
      )}

      {/* Dark Translucent Scrim Overlays for Contrast & Text Legibility */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0, 0, 0, 0.44)' },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 46,
          backgroundColor: 'rgba(0, 0, 0, 0.28)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          backgroundColor: 'rgba(0, 0, 0, 0.40)',
        }}
      />

      {/* Sticky Top Navigation Bar (Always Pinned at insets.top) */}
      <View style={[styles.navBarRow, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={onBack}
          activeOpacity={0.8}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Compact Title (fades in as cover scrolls up) */}
        <Animated.View
          style={[styles.miniTitleContainer, { opacity: miniTitleOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.miniTitleText} numberOfLines={1}>
            {groupDisplayName}
          </Text>
        </Animated.View>

        <View style={styles.topRightActions}>
          {onEditCover && (
            <TouchableOpacity
              style={styles.navCircleBtn}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                onEditCover();
              }}
              activeOpacity={0.8}
              accessibilityLabel="Change cover photo"
              accessibilityRole="button"
            >
              <Camera size={16} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.navCircleBtn}
            onPress={onSettings}
            activeOpacity={0.8}
            accessibilityLabel="Group settings"
            accessibilityRole="button"
          >
            <Settings size={18} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Content: Avatar, Title, Metadata & Balance */}
      <Animated.View
        style={[
          styles.collapsibleContent,
          {
            opacity: coverContentOpacity,
            transform: [{ translateY: coverContentTranslateY }],
          },
        ]}
      >
        <View style={styles.avatarCenterWrapper}>
          <View style={styles.avatarCircleBorder}>
            <MemberAvatar
              name={groupDisplayName}
              imageUrl={group?.imageUrl}
              size={42}
            />
          </View>
        </View>

        <Text style={styles.groupNameText} numberOfLines={1}>
          {groupDisplayName}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.groupMetadataText}>
            {memberCount} {memberCount === 1 ? 'person' : 'people'}
            {createdDateStr ? ` • ${createdDateStr}` : ''}
          </Text>
          {balanceSummary.text ? (
            <Text style={styles.balanceSummaryText}> • {balanceSummary.text}</Text>
          ) : (
            <Text style={styles.balanceSummaryText}>
              {' • '}
              {balanceSummary.prefix}
              <Text style={styles.balanceSummaryAmount}>{balanceSummary.amount}</Text>
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  coverImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  navBarRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  miniTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  miniTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsibleContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 2,
    zIndex: 5,
  },
  avatarCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleBorder: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  groupNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  groupMetadataText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.90)',
    fontWeight: '400',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowRadius: 2,
  },
  balanceSummaryText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowRadius: 2,
  },
  balanceSummaryAmount: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
