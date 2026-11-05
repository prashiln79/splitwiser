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
import { Plus, Search, X, Users, Hash } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  createGroup,
  joinGroup,
  subscribeToGroups,
  getGroupMembers,
} from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { BalanceCard } from '../components/common/BalanceCard';
import { GroupCard } from '../components/common/GroupCard';
import { EmptyState } from '../components/common/EmptyState';
import { Group } from '../types';

const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupSettlements, setGroupSettlements] = useState<
    Record<string, { netBalance: number; isSettled: boolean }>
  >({});

  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const results: Record<string, { netBalance: number; isSettled: boolean }> = {};

      await Promise.all(
        groupList.map(async (group) => {
          try {
            const [members, expenses] = await Promise.all([
              getGroupMembers(group.id),
              getGroupExpenses(group.id),
            ]);
            const settlements = getOptimizedSettlements(expenses, members);
            const myOwes = settlements
              .filter((s) => s.fromUserId === user.uid)
              .reduce((acc, s) => acc + s.amount, 0);
            const myOwed = settlements
              .filter((s) => s.toUserId === user.uid)
              .reduce((acc, s) => acc + s.amount, 0);
            const netBalance = myOwed - myOwes;
            results[group.id] = { netBalance, isSettled: Math.abs(netBalance) < 0.01 };
          } catch {
            results[group.id] = { netBalance: 0, isSettled: true };
          }
        })
      );

      setGroupSettlements(results);
    },
    [user]
  );

  // ── Real-time subscription to groups ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const unsubscribe = subscribeToGroups(user.uid, (updatedGroups) => {
      setGroups(updatedGroups);
      setIsLoading(false);
      refreshSettlements(updatedGroups);
    });

    return unsubscribe;
  }, [user, refreshSettlements]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refreshSettlements(groups);
    setIsRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) {
      Alert.alert('Group Name Required', 'Please enter a name for the new group.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      await createGroup(newGroupName.trim(), user.uid, user.name);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setModalVisible(false);
      setNewGroupName('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group.');
    } finally {
      setIsCreatingGroup(false);
    }
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

  const renderHeader = () => (
    <View>
      {/* Balance summary */}
      <BalanceCard totalOwed={totalOwed} totalOwes={totalOwes} />
    </View>
  );

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
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          renderItem={({ item }) => {
            const status = groupSettlements[item.id];
            return (
              <GroupCard
                group={item}
                netBalance={status?.netBalance ?? 0}
                isSettled={status?.isSettled ?? true}
                onPress={() =>
                  navigation.navigate('GroupDetails', {
                    groupId: item.id,
                    groupName: item.name,
                  })
                }
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title="No groups yet"
              description="Create a group or join one using a code to start splitting expenses with friends."
              actionLabel="Create a Group"
              onAction={() => setModalVisible(true)}
              secondaryActionLabel="Join a Group"
              onSecondaryAction={() => setIsJoinModalVisible(true)}
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

      {/* FAB - Create Group */}
      {!isLoading && groups.length > 0 && (
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: Math.max(insets.bottom + 16, 24) },
          ]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create group"
        >
          <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Create Group Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Create a New Group</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color="#6B6B6B" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              A shareable join code will be generated automatically.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Goa Trip, Flat 402, Weekend Dinner"
              placeholderTextColor="#9E9E9E"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateGroup}
              accessibilityLabel="New group name input"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isCreatingGroup}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: newGroupName.trim() ? '#059669' : '#E8E8E8',
                  },
                ]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                accessibilityRole="button"
              >
                {isCreatingGroup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.modalSubmitText,
                    { color: newGroupName.trim() ? '#FFFFFF' : '#9E9E9E' },
                  ]}>
                    Create Group
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
