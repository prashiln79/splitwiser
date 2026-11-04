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
import { Plus, Search, Hash, X, Users, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  createGroup,
  subscribeToGroups,
  getGroupMembers,
} from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
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
    <View style={styles.listHeader}>
      <BalanceCard
        totalOwed={totalOwed}
        totalOwes={totalOwes}
      />

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Your Groups
        </Text>
        <Text style={[styles.groupCountBadge, { color: colors.textSecondary }]}>
          {displayedGroups.length} {displayedGroups.length === 1 ? 'group' : 'groups'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modern Top Header */}
      <AppHeader
        title="Splitwiser"
        subtitle="Track and split expenses, together"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setIsSearchActive((prev) => !prev);
              }}
              style={[styles.headerIconBtn, { backgroundColor: colors.surfaceVariant }]}
              accessibilityLabel="Search groups"
              accessibilityRole="button"
            >
              <Search size={18} color={colors.textPrimary} strokeWidth={2.2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              style={[styles.headerIconBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Create group"
              accessibilityRole="button"
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Optional Search Bar */}
      {isSearchActive && (
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search groups..."
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
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your groups...
          </Text>
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

      {/* Modern Create Group Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: colors.backdrop }]}
        >
          <View
            style={[
              styles.modalDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.lg,
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Create a New Group
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  A shareable join code will be generated automatically.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Group Name
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="e.g. Goa Trip, Flat 402, Weekend Dinner"
                placeholderTextColor={colors.textMuted}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateGroup}
                accessibilityLabel="New group name input"
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => setModalVisible(false)}
                disabled={isCreatingGroup}
                accessibilityRole="button"
              >
                <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                accessibilityRole="button"
              >
                {isCreatingGroup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Create Group</Text>
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    paddingVertical: 0,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  listHeader: {
    paddingTop: spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  groupCountBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    marginVertical: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalCancelText: {
    fontWeight: '600',
    fontSize: typography.sizes.sm,
  },
  modalSubmitBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
});

export default HomeScreen;
