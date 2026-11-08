import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Search, X, Users, Hash, Receipt, UserPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  joinGroup,
  getGroupMembers,
} from '../services/groups';
import { getLocalGroups, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupExpensesLocal } from '../repositories/expenseRepository';
import { getGroupSettlementsLocal } from '../repositories/settlementRepository';
import { syncService } from '../sync/syncService';
import { syncQueue } from '../sync/syncQueue';
import { networkMonitor } from '../sync/networkMonitor';
import { getGroupExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';
import { BalanceCard } from '../components/common/BalanceCard';
import { GroupCard, GroupSubBalance } from '../components/common/GroupCard';
import { Group } from '../types';

interface GroupSettlementData {
  netBalance: number;
  isSettled: boolean;
  subBalances: GroupSubBalance[];
}

const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupSettlements, setGroupSettlements] = useState<Record<string, GroupSettlementData>>({});

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectGroupModalVisible, setSelectGroupModalVisible] = useState(false);

  const displayedGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [groups, searchQuery]);

  // ── Settlement status per group ───────────────────────────────────────────
  const refreshSettlements = useCallback(
    async (groupList: Group[]) => {
      if (!user) return;
      const results: Record<string, GroupSettlementData> = {};

      await Promise.all(
        groupList.map(async (group) => {
          try {
            // First check local SQLite
            let members = await getLocalGroupMembers(group.id);
            let expenses = await getGroupExpensesLocal(group.id);
            let recordedSets = await getGroupSettlementsLocal(group.id);

            // If empty and online, fetch from remote
            if (members.length === 0 && networkMonitor.isCurrentlyOnline()) {
              const [remM, remE] = await Promise.all([
                getGroupMembers(group.id),
                getGroupExpenses(group.id),
              ]);
              members = remM;
              expenses = remE;
            }

            const settlements = getOptimizedSettlements(expenses, members, recordedSets);
            const myOwesSettlements = settlements.filter((s) => s.fromUserId === user.uid && s.amount > 0.01);
            const myOwedSettlements = settlements.filter((s) => s.toUserId === user.uid && s.amount > 0.01);

            const myOwes = myOwesSettlements.reduce((acc, s) => acc + s.amount, 0);
            const myOwed = myOwedSettlements.reduce((acc, s) => acc + s.amount, 0);
            const netBalance = myOwed - myOwes;

            const subBalances: GroupSubBalance[] = [];
            myOwedSettlements.forEach((s) => {
              subBalances.push({
                memberName: s.fromUserName,
                amount: s.amount,
                type: 'owes_you',
              });
            });
            myOwesSettlements.forEach((s) => {
              subBalances.push({
                memberName: s.toUserName,
                amount: s.amount,
                type: 'you_owe',
              });
            });

            results[group.id] = {
              netBalance,
              isSettled: Math.abs(netBalance) < 0.01,
              subBalances,
            };
          } catch {
            results[group.id] = { netBalance: 0, isSettled: true, subBalances: [] };
          }
        })
      );

      setGroupSettlements(results);
    },
    [user]
  );

  // ── Instant Local Load + Real-time sync to groups ────────────────────────
  const loadGroups = useCallback(async () => {
    if (!user) return;
    try {
      const local = await getLocalGroups(user.uid);
      setGroups(local || []);
      setIsLoading(false);
      refreshSettlements(local || []);
    } catch (e) {
      console.warn('[HomeScreen] load error:', e);
      setIsLoading(false);
    }
  }, [user, refreshSettlements]);

  // Focus effect: reload groups whenever returning to HomeScreen (e.g. after deleting a group)
  useEffect(() => {
    if (isFocused && user) {
      loadGroups();
    }
  }, [isFocused, user, loadGroups]);

  useEffect(() => {
    if (!user) return;

    // 1. Initial read
    loadGroups();

    // 2. Real-time remote subscription via SyncService
    const unsubscribeGroups = syncService.subscribeToUserGroups(user.uid, () => {
      loadGroups();
    });

    // 3. Queue subscription (triggers when pending items sync or are queued)
    const unsubscribeQueue = syncQueue.subscribe(() => {
      loadGroups();
    });

    return () => {
      unsubscribeGroups();
      unsubscribeQueue();
    };
  }, [user, loadGroups]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (user) {
      await syncQueue.processQueue();
      await syncService.syncUserGroups(user.uid);
    }
    await refreshSettlements(groups);
    setIsRefreshing(false);
  };

  const handleJoinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Code Required', 'Please enter a 6-character group join code.');
      return;
    }
    if (!user) return;

    setIsJoiningGroup(true);
    try {
      const group = await joinGroup(code, user.uid, user.name);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setIsJoinModalVisible(false);
      setJoinCode('');
      Alert.alert('Welcome!', `You have successfully joined "${group.name}".`);
      navigation.navigate('GroupDetails', {
        groupId: group.id,
        groupName: group.name,
      });
    } catch (error: any) {
      Alert.alert(
        'Unable to Join',
        error.message || 'No group found with that code. Please verify and try again.'
      );
    } finally {
      setIsJoiningGroup(false);
    }
  };

  // Aggregated totals across all groups
  const { totalOwed, totalOwes } = useMemo(() => {
    let owed = 0;
    let owes = 0;
    Object.values(groupSettlements).forEach((s) => {
      if (s.netBalance > 0) owed += s.netBalance;
      else if (s.netBalance < 0) owes += Math.abs(s.netBalance);
    });
    return { totalOwed: owed, totalOwes: owes };
  }, [groupSettlements]);

  const handleAddExpenseClick = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (groups.length === 0) {
      navigation.navigate('CreateGroup');
    } else if (groups.length === 1) {
      navigation.navigate('AddExpense', { groupId: groups[0].id });
    } else {
      setSelectGroupModalVisible(true);
    }
  };

  const renderHeader = () => {
    if (groups.length === 0) return null;
    return (
      <View>
        <BalanceCard totalOwed={totalOwed} totalOwes={totalOwes} />
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <TouchableOpacity
        style={styles.createGroupFooterBtn}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.7}
      >
        <UserPlus size={18} color="#059669" strokeWidth={2.2} style={{ marginRight: 8 }} />
        <Text style={styles.createGroupFooterText}>Start a new group</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => {
    const firstName = user?.name ? user.name.trim().split(' ')[0] : '';
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyWelcomeTitle}>
          Welcome to Splitwiser{firstName ? ` ${firstName}` : ''}!
        </Text>

        <View style={styles.emptyIllustrationCircle}>
          <Users size={64} color="#059669" strokeWidth={1.7} />
        </View>

        <Text style={styles.emptyDescription}>
          Splitwiser groups you create or are added to will show here.
        </Text>

        <TouchableOpacity
          style={styles.startGroupPillBtn}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            navigation.navigate('CreateGroup');
          }}
          activeOpacity={0.75}
        >
          <UserPlus size={18} color="#059669" strokeWidth={2.4} style={{ marginRight: 8 }} />
          <Text style={styles.startGroupPillText}>Start a new group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.joinGroupTextBtn}
          onPress={() => setIsJoinModalVisible(true)}
          activeOpacity={0.7}
        >
          <Hash size={14} color="#6B7280" style={{ marginRight: 4 }} />
          <Text style={styles.joinGroupBtnText}>Have a code? Join group</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader
        title="Groups"
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
              accessibilityLabel="Search groups"
              accessibilityRole="button"
            >
              {isSearchActive ? (
                <X size={20} color="#1A1A1A" strokeWidth={2} />
              ) : (
                <Search size={20} color="#1A1A1A" strokeWidth={2} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsJoinModalVisible(true)}
              style={styles.headerIconBtn}
              accessibilityLabel="Join group with code"
              accessibilityRole="button"
            >
              <Hash size={20} color="#1A1A1A" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Bar */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Search size={16} color="#9E9E9E" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
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

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <FlatList
          data={displayedGroups}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={displayedGroups.length > 0 ? renderFooter : null}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 80 },
          ]}
          renderItem={({ item }) => {
            const status = groupSettlements[item.id];
            return (
              <GroupCard
                group={item}
                netBalance={status?.netBalance ?? 0}
                isSettled={status?.isSettled ?? true}
                subBalances={status?.subBalances ?? []}
                onPress={() =>
                  navigation.navigate('GroupDetails', {
                    groupId: item.id,
                    groupName: item.name,
                  })
                }
              />
            );
          }}
          ListEmptyComponent={renderEmptyState}
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

      {/* Floating Add Expense Pill (Splitwise Style) */}
      {!isLoading && groups.length > 0 && (
        <TouchableOpacity
          style={styles.addExpensePill}
          onPress={handleAddExpenseClick}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Add an expense"
        >
          <Receipt size={17} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
          <Text style={styles.addExpensePillText}>Add expense</Text>
        </TouchableOpacity>
      )}

      {/* Quick Group Select Modal for FAB */}
      <Modal
        visible={selectGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectGroupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectGroupModalVisible(false)}
        >
          <View style={styles.selectGroupDialog}>
            <Text style={styles.selectGroupTitle}>Choose a group</Text>
            {groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.selectGroupItem}
                onPress={() => {
                  setSelectGroupModalVisible(false);
                  navigation.navigate('AddExpense', { groupId: g.id });
                }}
              >
                <Users size={18} color="#059669" style={{ marginRight: 12 }} />
                <Text style={styles.selectGroupName}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={isJoinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsJoinModalVisible(false);
          setJoinCode('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Join a Group</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsJoinModalVisible(false);
                  setJoinCode('');
                }}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color="#6B6B6B" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter the 6-character code shared by the group creator.
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  letterSpacing: 4,
                  fontSize: 20,
                  fontWeight: '700',
                  textAlign: 'center',
                  borderBottomColor: joinCode.trim().length >= 6 ? '#059669' : '#E8E8E8',
                },
              ]}
              placeholder="e.g. 7X8K2M"
              placeholderTextColor="#9E9E9E"
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleJoinGroup}
              accessibilityLabel="Group join code input"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setIsJoinModalVisible(false);
                  setJoinCode('');
                }}
                disabled={isJoiningGroup}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor:
                      joinCode.trim().length >= 4 ? '#059669' : '#E8E8E8',
                  },
                ]}
                onPress={handleJoinGroup}
                disabled={isJoiningGroup || joinCode.trim().length < 4}
                accessibilityRole="button"
              >
                {isJoiningGroup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.modalSubmitText,
                    { color: joinCode.trim().length >= 4 ? '#FFFFFF' : '#9E9E9E' },
                  ]}>
                    Join Group
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 32,
  },
  footerContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  createGroupFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: 'transparent',
  },
  createGroupFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  // Floating Add Expense Pill
  addExpensePill: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addExpensePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Group select modal
  selectGroupDialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  selectGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  selectGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  selectGroupName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 24,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 16,
    lineHeight: 20,
  },
  // Splitwise Empty State
  emptyContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  emptyWelcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    alignSelf: 'flex-start',
    marginBottom: 40,
  },
  emptyIllustrationCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 6,
    borderColor: '#ECFDF5',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  startGroupPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  startGroupPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  joinGroupTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  joinGroupBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#E8E8E8',
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  modalCancelText: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1A1A1A',
  },
  modalSubmitBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  modalSubmitText: {
    fontWeight: '700',
    fontSize: 15,
  },
});

export default HomeScreen;
