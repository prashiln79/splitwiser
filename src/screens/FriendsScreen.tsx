import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import {
  UserCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Search,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroups, getGroupMembers } from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { computeFriendBalances } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { FriendBalance } from '../types';
import { formatCurrency } from '../utils/currency';

const FriendsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      const groups = await getGroups(user.uid);
      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const [members, expenses] = await Promise.all([
            getGroupMembers(group.id),
            getGroupExpenses(group.id),
          ]);
          return { groupId: group.id, groupName: group.name, expenses, members };
        })
      );

      setFriends(computeFriendBalances(groupsWithData, user.uid));
    } catch (error) {
      console.error('[FriendsScreen] fetch error:', error);
      Alert.alert('Error', 'Failed to load friends balance data.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused && user) fetchData();
  }, [isFocused, user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await fetchData(false);
    setIsRefreshing(false);
  };

  const toggleExpand = (userId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setExpandedFriends((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Aggregated totals across all friends
  const { totalOwed, totalOwes } = useMemo(() => {
    let owed = 0;
    let owes = 0;
    friends.forEach((f) => {
      if (f.netBalance > 0) owed += f.netBalance;
      else if (f.netBalance < 0) owes += Math.abs(f.netBalance);
    });
    return { totalOwed: owed, totalOwes: owes };
  }, [friends]);

  // Filter friends by search query
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(
      (f) =>
        f.userName.toLowerCase().includes(q) ||
        f.groups.some((g) => g.groupName.toLowerCase().includes(q))
    );
  }, [friends, searchQuery]);

  // Shimmer animation for skeleton
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.9, duration: 600, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Overview */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.sm,
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: colors.textSecondary }]}>
          FRIENDS BALANCE OVERVIEW
        </Text>

        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricBox,
              { backgroundColor: colors.incomeLight, borderColor: colors.income + '25' },
            ]}
          >
            <View style={styles.metricIconRow}>
              <ArrowUpRight size={14} color={colors.income} strokeWidth={2.5} />
              <Text style={[styles.metricLabel, { color: colors.incomeDark }]}>
                Owed to You
              </Text>
            </View>
            <Text style={[styles.metricVal, { color: colors.incomeDark }]}>
              {formatCurrency(totalOwed)}
            </Text>
          </View>

          <View
            style={[
              styles.metricBox,
              { backgroundColor: colors.expenseLight, borderColor: colors.expense + '25' },
            ]}
          >
            <View style={styles.metricIconRow}>
              <ArrowDownLeft size={14} color={colors.expense} strokeWidth={2.5} />
              <Text style={[styles.metricLabel, { color: colors.expenseDark }]}>
                You Owe
              </Text>
            </View>
            <Text style={[styles.metricVal, { color: colors.expenseDark }]}>
              {formatCurrency(totalOwes)}
            </Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      {friends.length > 0 && (
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Search size={16} color={colors.textMuted} strokeWidth={2} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search friends or groups..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Friends"
        subtitle={`${friends.length} active ${friends.length === 1 ? 'contact' : 'contacts'}`}
      />

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Animated.View
                style={[
                  styles.skeletonAvatar,
                  { backgroundColor: colors.surfaceVariant, opacity: opacityAnim },
                ]}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Animated.View
                  style={[
                    styles.skeletonLine,
                    { backgroundColor: colors.surfaceVariant, opacity: opacityAnim, width: '50%' },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonLineSmall,
                    { backgroundColor: colors.surfaceVariant, opacity: opacityAnim, width: '30%' },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          renderItem={({ item }) => {
            const isExpanded = !!expandedFriends[item.userId];
            const isSettled = Math.abs(item.netBalance) < 0.01;
            const owesMe = item.netBalance > 0;

            return (
              <View
                style={[
                  styles.friendCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  shadows.sm,
                ]}
              >
                {/* Main Clickable Header */}
                <TouchableOpacity
                  style={styles.friendCardHeader}
                  onPress={() => toggleExpand(item.userId)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.userName}. ${isSettled ? 'Settled' : owesMe ? `Owes you ${formatCurrency(item.netBalance)}` : `You owe ${formatCurrency(Math.abs(item.netBalance))}`}`}
                >
                  <MemberAvatar name={item.userName} size={44} />

                  <View style={styles.friendInfo}>
                    <Text
                      style={[styles.friendName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.userName}
                    </Text>
                    <Text style={[styles.friendGroupsCount, { color: colors.textSecondary }]}>
                      {item.groups.length} shared {item.groups.length === 1 ? 'group' : 'groups'}
                    </Text>
                  </View>

                  <View style={styles.friendBalanceCol}>
                    <StatusBadge
                      variant={isSettled ? 'settled' : owesMe ? 'lent' : 'borrowed'}
                      label={
                        isSettled
                          ? 'Settled'
                          : owesMe
                          ? `+${formatCurrency(item.netBalance)}`
                          : `-${formatCurrency(Math.abs(item.netBalance))}`
                      }
                      size="sm"
                    />
                    <View style={styles.expandChevron}>
                      {isExpanded ? (
                        <ChevronUp size={16} color={colors.textMuted} />
                      ) : (
                        <ChevronDown size={16} color={colors.textMuted} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Group Breakdown */}
                {isExpanded && (
                  <View style={[styles.expandedContainer, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.breakdownTitle, { color: colors.textSecondary }]}>
                      SHARED GROUP BALANCES
                    </Text>
                    {item.groups.map((g) => {
                      const gSettled = Math.abs(g.balance) < 0.01;
                      const gOwesMe = g.balance > 0;

                      return (
                        <TouchableOpacity
                          key={g.groupId}
                          style={[styles.groupBalanceRow, { borderBottomColor: colors.borderLight }]}
                          onPress={() => {
                            if (navigation?.navigate) {
                              navigation.navigate('Groups', {
                                screen: 'GroupDetails',
                                params: { groupId: g.groupId, groupName: g.groupName },
                              });
                            }
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                        >
                          <View style={styles.groupLeft}>
                            <Users size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text
                              style={[styles.groupRowName, { color: colors.textPrimary }]}
                              numberOfLines={1}
                            >
                              {g.groupName}
                            </Text>
                          </View>

                          <View style={styles.groupRight}>
                            <Text
                              style={[
                                styles.groupBalanceAmount,
                                {
                                  color: gSettled
                                    ? colors.textSecondary
                                    : gOwesMe
                                    ? colors.income
                                    : colors.expense,
                                },
                              ]}
                            >
                              {gSettled
                                ? 'Settled'
                                : `${gOwesMe ? '+' : '-'}${formatCurrency(Math.abs(g.balance))}`}
                            </Text>
                            <ArrowRight size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={UserCheck}
              title="No balances with friends"
              description="When you share expenses with friends in groups, their aggregated balances will show up here."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 48,
  },
  headerContainer: {
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  heroEyebrow: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: typography.sizes.md,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    padding: 0,
  },
  friendCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  friendCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  friendName: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  friendGroupsCount: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  friendBalanceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expandChevron: {
    paddingLeft: 2,
  },
  expandedContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breakdownTitle: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  groupBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupRowName: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  groupRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupBalanceAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  skeletonContainer: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonLineSmall: {
    height: 10,
    borderRadius: 4,
  },
});

export default FriendsScreen;
