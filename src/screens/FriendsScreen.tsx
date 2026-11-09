import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import {
  UserPlus,
  ArrowRight,
  Search,
  X,
  Users,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Smile,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getLocalGroups, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupExpensesLocal } from '../repositories/expenseRepository';
import { getGroupSettlementsLocal } from '../repositories/settlementRepository';
import { getLocalFriendships, getDirectExpensesLocal, getDirectSettlementsLocal } from '../repositories/friendRepository';
import { getGroups, getGroupMembers } from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { networkMonitor } from '../sync/networkMonitor';
import { syncQueue } from '../sync/syncQueue';
import { computeFriendBalances } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, ThemeColors } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { AddFriendModal } from '../components/common/AddFriendModal';
import { FriendBalance } from '../types';
import { formatCurrency } from '../utils/currency';

type FilterType = 'all' | 'owes_you' | 'you_owe' | 'settled';

export const FriendsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);

  // 1. Fast, instant load from local SQLite
  const loadLocalFriends = useCallback(async () => {
    if (!user) return;
    try {
      const [groups, friendships] = await Promise.all([
        getLocalGroups(user.uid),
        getLocalFriendships(user.uid),
      ]);

      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const [members, expenses, settlements] = await Promise.all([
            getLocalGroupMembers(group.id),
            getGroupExpensesLocal(group.id),
            getGroupSettlementsLocal(group.id),
          ]);
          const normalizedMembers = user?.uid && user?.name
            ? members.map((m) => (m.userId === user.uid ? { ...m, userName: user.name } : m))
            : members;
          return { groupId: group.id, groupName: group.name, expenses, members: normalizedMembers, settlements };
        })
      );

      const explicitFriends = friendships.map((f) => ({
        friendId: f.friendId,
        friendName: f.friendName,
        friendEmail: f.friendEmail,
        friendPhotoUrl: f.friendPhotoUrl,
        friendshipId: f.id,
      }));

      const computed = computeFriendBalances(
        groupsWithData,
        user.uid,
        explicitFriends,
        [],
        []
      );

      setFriends(computed);
      setIsLoading(false);
    } catch (e) {
      console.warn('[FriendsScreen] local load error:', e);
      setIsLoading(false);
    }
  }, [user]);

  // 2. Background sync
  const refreshRemoteData = async () => {
    if (!user) return;
    try {
      await loadLocalFriends();

      if (networkMonitor.isCurrentlyOnline()) {
        const groups = await getGroups(user.uid);
        const friendships = await getLocalFriendships(user.uid);

        const groupsWithData = await Promise.all(
          groups.map(async (group) => {
            const [members, expenses, localSettlements] = await Promise.all([
              getGroupMembers(group.id),
              getGroupExpenses(group.id),
              getGroupSettlementsLocal(group.id),
            ]);
            const normalizedMembers = user?.uid && user?.name
              ? members.map((m) => (m.userId === user.uid ? { ...m, userName: user.name } : m))
              : members;
            return {
              groupId: group.id,
              groupName: group.name,
              expenses,
              members: normalizedMembers,
              settlements: localSettlements,
            };
          })
        );

        const explicitFriends = friendships.map((f) => ({
          friendId: f.friendId,
          friendName: f.friendName,
          friendEmail: f.friendEmail,
          friendPhotoUrl: f.friendPhotoUrl,
          friendshipId: f.id,
        }));

        setFriends(
          computeFriendBalances(groupsWithData, user.uid, explicitFriends, [], [])
        );
      }
    } catch (error) {
      console.error('[FriendsScreen] fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadLocalFriends();

    const unsubQueue = syncQueue.subscribe(() => {
      loadLocalFriends();
    });

    return unsubQueue;
  }, [user, loadLocalFriends]);

  useEffect(() => {
    if (isFocused && user) {
      refreshRemoteData();
    }
  }, [isFocused, user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refreshRemoteData();
    setIsRefreshing(false);
  };

  // Two separate non-combined balance figures: "You are owed" and "You owe"
  const { totalYouAreOwed, totalYouOwe } = useMemo(() => {
    let owed = 0;
    let owes = 0;
    friends.forEach((f) => {
      if (f.netBalance > 0.01) owed += f.netBalance;
      else if (f.netBalance < -0.01) owes += Math.abs(f.netBalance);
    });
    return { totalYouAreOwed: owed, totalYouOwe: owes };
  }, [friends]);

  // Filtered & Sorted Friends list
  const displayedFriends = useMemo(() => {
    let result = [...friends];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.userName.toLowerCase().includes(q) ||
          (f.userEmail && f.userEmail.toLowerCase().includes(q)) ||
          f.groups.some((g) => g.groupName.toLowerCase().includes(q))
      );
    }

    // Filter chips
    if (activeFilter === 'owes_you') {
      result = result.filter((f) => f.netBalance > 0.01);
    } else if (activeFilter === 'you_owe') {
      result = result.filter((f) => f.netBalance < -0.01);
    } else if (activeFilter === 'settled') {
      result = result.filter((f) => Math.abs(f.netBalance) <= 0.01);
    }

    // Default Sorting:
    // 1. Friends who owe you (amount desc)
    // 2. Friends you owe (amount desc)
    // 3. Settled friends
    result.sort((a, b) => {
      const aOwesMe = a.netBalance > 0.01;
      const bOwesMe = b.netBalance > 0.01;
      const aIOwe = a.netBalance < -0.01;
      const bIOwe = b.netBalance < -0.01;

      if (aOwesMe && !bOwesMe) return -1;
      if (!aOwesMe && bOwesMe) return 1;
      if (aOwesMe && bOwesMe) return b.netBalance - a.netBalance;

      if (aIOwe && !bIOwe) return -1;
      if (!aIOwe && bIOwe) return 1;
      if (aIOwe && bIOwe) return Math.abs(b.netBalance) - Math.abs(a.netBalance);

      return a.userName.localeCompare(b.userName);
    });

    return result;
  }, [friends, searchQuery, activeFilter]);

  // Shimmer animation for loading
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.9, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  // Balance Summary Card showing two distinct figures (or settled minimal banner when no balances)
  const renderBalanceSummary = () => (
    <View style={styles.summaryContainer}>
      {totalYouAreOwed <= 0.01 && totalYouOwe <= 0.01 ? (
        <View style={[styles.settledBanner, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : '#D1FAE5' }]}>
          <View style={[styles.settledIconWrap, isDark && { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <CheckCircle2 size={24} color={colors.primary} strokeWidth={2.4} />
          </View>
          <View style={styles.settledTextContainer}>
            <Text style={[styles.settledBannerTitle, { color: colors.textPrimary }]}>You are all settled up</Text>
            <Text style={[styles.settledBannerSubtitle, { color: colors.textMuted }]}>
              You don't owe anything, and no one owes you
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.summaryGrid}>
          {totalYouAreOwed > 0.01 && (
            <View
              style={[
                styles.summaryCardOwed,
                { backgroundColor: colors.surface, borderLeftColor: colors.income },
                totalYouOwe <= 0.01 && { flex: 1 },
              ]}
            >
              <View style={styles.summaryHeaderRow}>
                <TrendingUp size={15} color={colors.income} style={{ marginRight: 6 }} />
                <Text style={[styles.summaryLabelOwed, { color: colors.income }]}>You are owed</Text>
              </View>
              <Text style={[styles.summaryAmountOwed, { color: colors.income }]}>
                {formatCurrency(totalYouAreOwed)}
              </Text>
            </View>
          )}

          {totalYouOwe > 0.01 && (
            <View
              style={[
                styles.summaryCardOwe,
                { backgroundColor: colors.surface, borderLeftColor: colors.expense },
                totalYouAreOwed <= 0.01 && { flex: 1 },
              ]}
            >
              <View style={styles.summaryHeaderRow}>
                <CreditCard size={15} color={colors.expense} style={{ marginRight: 6 }} />
                <Text style={[styles.summaryLabelOwe, { color: colors.expense }]}>You owe</Text>
              </View>
              <Text style={[styles.summaryAmountOwe, { color: colors.expense }]}>
                {formatCurrency(totalYouOwe)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Filter Chips Bar */}
      <View style={styles.filterChipsRow}>
        {(['all', 'owes_you', 'you_owe', 'settled'] as const).map((filter) => {
          const isSelected = activeFilter === filter;
          const label =
            filter === 'all'
              ? 'All'
              : filter === 'owes_you'
              ? 'Owes you'
              : filter === 'you_owe'
              ? 'You owe'
              : 'Settled';

          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                { backgroundColor: isDark ? colors.surfaceSecondary : '#E5E7EB' },
                isSelected && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setActiveFilter(filter);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isDark ? colors.textMuted : '#4B5563' },
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Friendly Empty State when there are no owned or owe, or matching filter
  const renderEmptyState = () => {
    // Case 1: Initial empty state - No friends added yet
    if (friends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIllustration}>
            <Image
              source={require('../../assets/friends-illustration.png')}
              style={styles.friendsIllustrationImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Start sharing expenses with friends</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Add friends to track balances across shared groups or directly split dinner, trips, and bills.
          </Text>
          <TouchableOpacity
            style={[styles.addFriendPillBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              setAddFriendModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <UserPlus size={18} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 8 }} />
            <Text style={styles.addFriendPillBtnText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Case 2: Search with no results
    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIllustration}>
            <View style={[styles.emptyOuterRingNeutral, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.emptyInnerCircleNeutral, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={40} color={colors.textMuted} strokeWidth={1.8} />
              </View>
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No matching friends</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            We couldn't find any friends matching "{searchQuery}".
          </Text>
          <TouchableOpacity
            style={[styles.clearFilterBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={() => setSearchQuery('')}
          >
            <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Case 3: Filter "Owes you" with nobody owing (no owed)
    if (activeFilter === 'owes_you') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIllustration}>
            <View style={[styles.emptyOuterRing, isDark && { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.emptyInnerCircle, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Smile size={46} color={colors.primary} strokeWidth={1.8} />
              </View>
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No one owes you</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            You're all squared away! None of your friends currently owe you money.
          </Text>
          <TouchableOpacity
            style={[styles.clearFilterBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>Show all friends</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Case 4: Filter "You owe" with no debts (no owe)
    if (activeFilter === 'you_owe') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIllustration}>
            <View style={[styles.emptyOuterRing, isDark && { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.emptyInnerCircle, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <CheckCircle2 size={46} color={colors.primary} strokeWidth={1.8} />
              </View>
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>You don't owe anyone</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            All caught up! You have no outstanding balances to pay right now.
          </Text>
          <TouchableOpacity
            style={[styles.clearFilterBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>Show all friends</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Case 5: Filter "Settled" with no settled friends
    if (activeFilter === 'settled') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIllustration}>
            <View style={[styles.emptyOuterRingNeutral, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.emptyInnerCircleNeutral, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Users size={40} color={colors.textMuted} strokeWidth={1.8} />
              </View>
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No settled friends</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Friends will show here once all shared expenses between you are fully settled up.
          </Text>
          <TouchableOpacity
            style={[styles.clearFilterBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>Show all friends</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Friends"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setIsSearchActive(!isSearchActive);
                if (isSearchActive) setSearchQuery('');
              }}
              style={styles.headerIconBtn}
              accessibilityLabel="Search friends"
              accessibilityRole="button"
            >
              {isSearchActive ? (
                <X size={20} color={colors.textPrimary} strokeWidth={2} />
              ) : (
                <Search size={20} color={colors.textPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setAddFriendModalVisible(true);
              }}
              style={styles.headerIconBtn}
              accessibilityLabel="Add friend"
              accessibilityRole="button"
            >
              <UserPlus size={20} color={colors.primary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Input Bar */}
      {isSearchActive && (
        <View style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name, email or group..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading && friends.length === 0 ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Animated.View style={[styles.skeletonAvatar, { opacity: opacityAnim, backgroundColor: colors.surfaceSecondary }]} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Animated.View style={[styles.skeletonLine, { opacity: opacityAnim, width: '45%', backgroundColor: colors.surfaceSecondary }]} />
                <Animated.View style={[styles.skeletonLineSmall, { opacity: opacityAnim, width: '30%', backgroundColor: colors.surfaceSecondary }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={displayedFriends}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={friends.length > 0 ? renderBalanceSummary : null}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 80 },
          ]}
          renderItem={({ item }) => {
            const isSettled = Math.abs(item.netBalance) < 0.01;
            const owesMe = item.netBalance > 0.01;

            return (
              <TouchableOpacity
                style={[styles.friendRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  navigation.navigate('FriendDetails', {
                    friendId: item.userId,
                    friendName: item.userName,
                    friendshipId: item.friendshipId,
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.userName}. ${isSettled ? 'Settled up' : owesMe ? `Owes you ${formatCurrency(item.netBalance)}` : `You owe ${formatCurrency(Math.abs(item.netBalance))}`}`}
              >
                <MemberAvatar name={item.userName} size={44} />

                <View style={styles.friendInfo}>
                  <Text style={[styles.friendName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.userName}
                  </Text>
                  <Text style={[styles.friendGroupsCount, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.groups.length > 0
                      ? `${item.groups.length} shared ${item.groups.length === 1 ? 'group' : 'groups'}`
                      : 'Direct friend'}
                  </Text>
                </View>

                <View style={styles.balanceRight}>
                  {isSettled ? (
                    <Text style={[styles.settledText, { color: colors.textMuted }]}>settled up</Text>
                  ) : owesMe ? (
                    <View style={styles.balanceColumn}>
                      <Text style={[styles.owesMeLabel, { color: colors.income }]}>owes you</Text>
                      <Text style={[styles.owesMeAmount, { color: colors.income }]}>
                        {formatCurrency(item.netBalance)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.balanceColumn}>
                      <Text style={[styles.youOweLabel, { color: colors.expense }]}>you owe</Text>
                      <Text style={[styles.youOweAmount, { color: colors.expense }]}>
                        {formatCurrency(Math.abs(item.netBalance))}
                      </Text>
                    </View>
                  )}

                  <ArrowRight size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={renderEmptyState()}
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

      {/* Add Friend Modal */}
      {user && (
        <AddFriendModal
          visible={addFriendModalVisible}
          currentUserId={user.uid}
          currentUserName={user.name || 'You'}
          onDismiss={() => setAddFriendModalVisible(false)}
          onFriendAdded={() => {
            loadLocalFriends();
          }}
        />
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      height: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    // Summary Grid
    summaryContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    settledBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#D1FAE5',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    settledIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
    },
    settledTextContainer: {
      flex: 1,
    },
    settledBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
    },
    settledBannerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    summaryGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    summaryCardOwed: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.income,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    summaryCardOwe: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.expense,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    summaryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    summaryLabelOwed: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.income,
    },
    summaryAmountOwed: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.income,
    },
    summaryLabelOwe: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.expense,
    },
    summaryAmountOwe: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.expense,
    },
    // Filter chips
    filterChipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E5E7EB',
    },
    filterChipSelected: {
      backgroundColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterChipTextSelected: {
      color: '#FFFFFF',
    },
    // List Content
    listContent: {
      paddingBottom: 32,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    friendInfo: {
      flex: 1,
      marginLeft: 12,
    },
    friendName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    friendGroupsCount: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    balanceRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    balanceColumn: {
      alignItems: 'flex-end',
    },
    owesMeLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.income,
      textTransform: 'uppercase',
    },
    owesMeAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.income,
    },
    youOweLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.expense,
      textTransform: 'uppercase',
    },
    youOweAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.expense,
    },
    settledText: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    // Skeletons
    skeletonContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    skeletonAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E0E0E0',
    },
    skeletonLine: {
      height: 14,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E0E0E0',
      borderRadius: 4,
      marginBottom: 8,
    },
    skeletonLineSmall: {
      height: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E0E0E0',
      borderRadius: 4,
    },
    // Empty State
    emptyContainer: {
      paddingHorizontal: 32,
      paddingTop: 48,
      alignItems: 'center',
    },
    emptyIllustration: {
      marginBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendsIllustrationImage: {
      width: 220,
      height: 200,
    },
    emptyOuterRing: {
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyInnerCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.4)' : '#A7F3D0',
    },
    emptyOuterRingNeutral: {
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyInnerCircleNeutral: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: isDark ? colors.surfaceSecondary : '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    addFriendPillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    addFriendPillBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    clearFilterBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
    },
    clearFilterBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });

export default FriendsScreen;
