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
  Users,
  Search,
  X,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getLocalGroups, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupExpensesLocal } from '../repositories/expenseRepository';
import { getGroupSettlementsLocal } from '../repositories/settlementRepository';
import { getGroups, getGroupMembers } from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { networkMonitor } from '../sync/networkMonitor';
import { syncQueue } from '../sync/syncQueue';
import { computeFriendBalances } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';
import { BalanceCard } from '../components/common/BalanceCard';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { EmptyState } from '../components/common/EmptyState';
import { FriendBalance } from '../types';
import { formatCurrency } from '../utils/currency';

const FriendsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fast, instant load from local SQLite
  const loadLocalFriends = async () => {
    if (!user) return;
    try {
      const groups = await getLocalGroups(user.uid);
      if (groups.length === 0) return;

      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const [members, expenses, settlements] = await Promise.all([
            getLocalGroupMembers(group.id),
            getGroupExpensesLocal(group.id),
            getGroupSettlementsLocal(group.id),
          ]);
          return { groupId: group.id, groupName: group.name, expenses, members, settlements };
        })
      );

      const computed = computeFriendBalances(groupsWithData, user.uid);
      setFriends(computed);
      setIsLoading(false);
    } catch (e) {
      console.warn('[FriendsScreen] local load error:', e);
    }
  };

  // 2. Background sync (without wiping the screen or showing a blocking skeleton)
  const refreshRemoteData = async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      await loadLocalFriends();

      if (networkMonitor.isCurrentlyOnline()) {
        const groups = await getGroups(user.uid);
        const groupsWithData = await Promise.all(
          groups.map(async (group) => {
            const [members, expenses, localSettlements] = await Promise.all([
              getGroupMembers(group.id),
              getGroupExpenses(group.id),
              getGroupSettlementsLocal(group.id),
            ]);
            return {
              groupId: group.id,
              groupName: group.name,
              expenses,
              members,
              settlements: localSettlements,
            };
          })
        );

        setFriends(computeFriendBalances(groupsWithData, user.uid));
      }
    } catch (error) {
      console.error('[FriendsScreen] fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Instant local load on mount & subscribe to queue updates
  useEffect(() => {
    if (!user) return;

    loadLocalFriends();

    // Listen to queue changes (when an expense is created/settled anywhere in the app)
    const unsubQueue = syncQueue.subscribe(() => {
      loadLocalFriends();
    });

    return unsubQueue;
  }, [user]);

  // When switching to the tab, perform silent background sync (never blocks the screen)
  useEffect(() => {
    if (isFocused && user) {
      refreshRemoteData(false);
    }
  }, [isFocused, user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refreshRemoteData(false);
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
    <View>
      <BalanceCard totalOwed={totalOwed} totalOwes={totalOwes} />
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Friends"
        rightAction={
          friends.length > 0 ? (
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
                <X size={20} color="#1A1A1A" strokeWidth={2} />
              ) : (
                <Search size={20} color="#1A1A1A" strokeWidth={2} />
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Optional Search Bar */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Search size={16} color="#9E9E9E" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends or groups..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#9E9E9E" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading && friends.length === 0 ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Animated.View
                style={[styles.skeletonAvatar, { opacity: opacityAnim }]}
              />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Animated.View
                  style={[styles.skeletonLine, { opacity: opacityAnim, width: '45%' }]}
                />
                <Animated.View
                  style={[styles.skeletonLineSmall, { opacity: opacityAnim, width: '30%' }]}
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
              <View style={styles.friendItemWrapper}>
                {/* Main Row */}
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => toggleExpand(item.userId)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.userName}. ${isSettled ? 'Settled up' : owesMe ? `Owes you ${formatCurrency(item.netBalance)}` : `You owe ${formatCurrency(Math.abs(item.netBalance))}`}`}
                >
                  <MemberAvatar name={item.userName} size={44} />

                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {item.userName}
                    </Text>
                    <Text style={styles.friendGroupsCount} numberOfLines={1}>
                      {item.groups.length} shared {item.groups.length === 1 ? 'group' : 'groups'}
                    </Text>
                  </View>

                  <View style={styles.balanceRight}>
                    {isSettled ? (
                      <Text style={styles.settledText}>settled up</Text>
                    ) : owesMe ? (
                      <View style={styles.balanceColumn}>
                        <Text style={styles.owesMeLabel}>owes you</Text>
                        <Text style={styles.owesMeAmount}>
                          {formatCurrency(item.netBalance)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.balanceColumn}>
                        <Text style={styles.youOweLabel}>you owe</Text>
                        <Text style={styles.youOweAmount}>
                          {formatCurrency(Math.abs(item.netBalance))}
                        </Text>
                      </View>
                    )}

                    <View style={styles.chevronWrapper}>
                      {isExpanded ? (
                        <ChevronUp size={16} color="#9E9E9E" />
                      ) : (
                        <ChevronDown size={16} color="#9E9E9E" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Breakdown */}
                {isExpanded && (
                  <View style={styles.breakdownContainer}>
                    <Text style={styles.breakdownHeader}>
                      SHARED GROUP BREAKDOWN
                    </Text>
                    {item.groups.map((g) => {
                      const gSettled = Math.abs(g.balance) < 0.01;
                      const gOwesMe = g.balance > 0;

                      return (
                        <TouchableOpacity
                          key={g.groupId}
                          style={styles.groupRow}
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
                            <Users size={14} color="#6B6B6B" style={{ marginRight: 8 }} />
                            <Text style={styles.groupNameText} numberOfLines={1}>
                              {g.groupName}
                            </Text>
                          </View>

                          <View style={styles.groupRight}>
                            <Text
                              style={[
                                styles.groupBalanceAmount,
                                {
                                  color: gSettled
                                    ? '#9E9E9E'
                                    : gOwesMe
                                    ? '#1CC88A'
                                    : '#E74C3C',
                                },
                              ]}
                            >
                              {gSettled
                                ? 'settled'
                                : `${gOwesMe ? '+' : '-'}${formatCurrency(Math.abs(g.balance))}`}
                            </Text>
                            <ArrowRight size={12} color="#9E9E9E" style={{ marginLeft: 6 }} />
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
              description="When you share expenses with friends across groups, their aggregate balances will appear here."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#059669']}
              tintColor="#059669"
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
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 32,
  },
  friendItemWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  friendGroupsCount: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceColumn: {
    alignItems: 'flex-end',
  },
  settledText: {
    fontSize: 14,
    color: '#9E9E9E',
    fontWeight: '400',
  },
  owesMeLabel: {
    fontSize: 12,
    color: '#1CC88A',
    fontWeight: '500',
  },
  owesMeAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1CC88A',
    marginTop: 1,
  },
  youOweLabel: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
  },
  youOweAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E74C3C',
    marginTop: 1,
  },
  chevronWrapper: {
    marginLeft: 10,
    width: 16,
    alignItems: 'center',
  },
  breakdownContainer: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFEFEF',
  },
  breakdownHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  groupNameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  groupRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupBalanceAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonContainer: {
    backgroundColor: '#FFFFFF',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBEBEB',
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: '#EBEBEB',
    marginBottom: 6,
  },
  skeletonLineSmall: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#EBEBEB',
  },
});

export default FriendsScreen;
