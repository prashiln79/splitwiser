import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import {
  Settings,
  Plus,
  Share2,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Users,
  CreditCard,
  HandCoins,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroupById, getGroupMembers } from '../services/groups';
import { subscribeToExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { ExpenseListItem } from '../components/common/ExpenseListItem';
import { SettleUpModal } from '../components/common/SettleUpModal';
import { EmptyState } from '../components/common/EmptyState';
import { Expense, Group, GroupMember, OptimizedSettlement } from '../types';
import { formatCurrency } from '../utils/currency';

const GroupDetailsScreen = ({ route, navigation }: any) => {
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<OptimizedSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [settleModalVisible, setSettleModalVisible] = useState(false);

  // Load group details & members
  const fetchGroupData = async () => {
    try {
      const [g, m] = await Promise.all([
        getGroupById(groupId),
        getGroupMembers(groupId),
      ]);
      setGroup(g);
      setMembers(m);
    } catch (e) {
      console.error('[GroupDetails] error loading group:', e);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [groupId]);

  // Real-time expense subscription
  useEffect(() => {
    const unsubscribe = subscribeToExpenses(groupId, (updatedExpenses) => {
      setExpenses(updatedExpenses);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [groupId]);

  // Recompute settlements whenever expenses or members change
  useEffect(() => {
    if (members.length > 0) {
      setSettlements(getOptimizedSettlements(expenses, members));
    }
  }, [expenses, members]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await fetchGroupData();
    setIsRefreshing(false);
  };

  const handleShareCode = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (!group?.joinCode) return;
    try {
      await Share.share({
        message: `Join our "${group.name}" group on Splitwiser! Use code: ${group.joinCode}`,
      });
    } catch {
      // Ignored
    }
  };

  // Member map for quick name resolution
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.userId, m.userName));
    return map;
  }, [members]);

  const getMemberName = (uid: string) => memberMap.get(uid) || 'Member';

  // Current user's net balance in this group
  const { netBalance, myOwes, myOwed } = useMemo(() => {
    if (!user) return { netBalance: 0, myOwes: 0, myOwed: 0 };
    const owes = settlements
      .filter((s) => s.fromUserId === user.uid)
      .reduce((sum, s) => sum + s.amount, 0);
    const owed = settlements
      .filter((s) => s.toUserId === user.uid)
      .reduce((sum, s) => sum + s.amount, 0);
    return { netBalance: owed - owes, myOwes: owes, myOwed: owed };
  }, [settlements, user]);

  const isSettled = Math.abs(netBalance) < 0.01;

  // Render header summary card
  const renderGroupHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          shadows.sm,
        ]}
      >
        {/* Top: Avatar, Name & Code Chip */}
        <View style={styles.groupMetaRow}>
          <MemberAvatar
            name={group?.name || initialGroupName}
            imageUrl={group?.imageUrl}
            size={52}
          />
          <View style={styles.groupTextInfo}>
            <Text
              style={[styles.groupTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {group?.name || initialGroupName}
            </Text>
            <View style={styles.membersCountRow}>
              <Users size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.membersCountText, { color: colors.textSecondary }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
        </View>

        {/* Join Code Banner (Fixes "Group code is not visible on groups") */}
        {group?.joinCode && (
          <TouchableOpacity
            style={[
              styles.codeBanner,
              { backgroundColor: colors.primaryLight, borderColor: colors.primary + '35' },
            ]}
            onPress={handleShareCode}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Group Join Code is ${group.joinCode}. Tap to share or copy.`}
          >
            <View style={styles.codeBannerLeft}>
              <Text style={[styles.codeBannerLabel, { color: colors.primaryDark }]}>
                GROUP CODE:
              </Text>
              <Text style={[styles.codeBannerCode, { color: colors.primaryDark }]}>
                {group.joinCode}
              </Text>
            </View>
            <View
              style={[
                styles.codeSharePill,
                { backgroundColor: colors.surface, borderColor: colors.primary + '40' },
              ]}
            >
              <Share2 size={12} color={colors.primary} strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={[styles.codeShareText, { color: colors.primary }]}>
                Invite Friends
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Balance Status */}
        <View style={[styles.balanceSection, { borderTopColor: colors.borderLight }]}>
          <View>
            <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
              YOUR BALANCE
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                {
                  color: isSettled
                    ? colors.textPrimary
                    : netBalance > 0
                    ? colors.income
                    : colors.expense,
                },
              ]}
            >
              {isSettled
                ? 'All Settled'
                : `${netBalance > 0 ? '+' : '-'}${formatCurrency(Math.abs(netBalance))}`}
            </Text>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.headerButtonRow}>
            {settlements.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.settleBtn,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => setSettleModalVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Settle up balances"
              >
                <HandCoins size={14} color={colors.textPrimary} strokeWidth={2} style={{ marginRight: 4 }} />
                <Text style={[styles.settleBtnText, { color: colors.textPrimary }]}>
                  Settle Up
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.addExpenseBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('AddExpense', { groupId })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add an expense"
            >
              <Plus size={15} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={styles.addExpenseBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Segmented Filter Tabs: Expenses vs Balances */}
      <View
        style={[
          styles.tabContainer,
          { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'expenses' && [
              styles.tabActive,
              { backgroundColor: colors.surface },
            ],
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setActiveTab('expenses');
          }}
          activeOpacity={0.8}
        >
          <Receipt
            size={15}
            color={activeTab === 'expenses' ? colors.primary : colors.textSecondary}
            strokeWidth={2}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'expenses' ? colors.textPrimary : colors.textSecondary,
                fontWeight: activeTab === 'expenses' ? '700' : '500',
              },
            ]}
          >
            Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'balances' && [
              styles.tabActive,
              { backgroundColor: colors.surface },
            ],
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setActiveTab('balances');
          }}
          activeOpacity={0.8}
        >
          <CreditCard
            size={15}
            color={activeTab === 'balances' ? colors.primary : colors.textSecondary}
            strokeWidth={2}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'balances' ? colors.textPrimary : colors.textSecondary,
                fontWeight: activeTab === 'balances' ? '700' : '500',
              },
            ]}
          >
            Balances ({settlements.length})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Header */}
      <AppHeader
        title={group?.name || initialGroupName}
        subtitle={`${members.length} members`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.topRightActions}>
            {group?.joinCode ? (
              <TouchableOpacity
                onPress={handleShareCode}
                style={[styles.headerCodeChip, { backgroundColor: colors.primaryLight }]}
                accessibilityLabel={`Group code ${group.joinCode}. Share code.`}
                accessibilityRole="button"
              >
                <Text style={[styles.headerCodeText, { color: colors.primaryDark }]}>
                  {group.joinCode}
                </Text>
                <Share2 size={12} color={colors.primaryDark} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => navigation.navigate('GroupSettings', { groupId })}
              style={[styles.headerIconBtn, { backgroundColor: colors.surfaceVariant }]}
              accessibilityLabel="Group settings"
              accessibilityRole="button"
            >
              <Settings size={18} color={colors.textPrimary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading expenses...
          </Text>
        </View>
      ) : activeTab === 'expenses' ? (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderGroupHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          renderItem={({ item }) => (
            <ExpenseListItem
              expense={item}
              currentUserId={user?.uid || ''}
              payerName={getMemberName(item.paidBy || item.createdBy)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Keep track of meals, bills, or trips by adding the first expense to this group."
              actionLabel="Add Expense"
              onAction={() => navigation.navigate('AddExpense', { groupId })}
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
      ) : (
        <FlatList
          data={settlements}
          keyExtractor={(item, index) => `${item.fromUserId}-${item.toUserId}-${index}`}
          ListHeaderComponent={renderGroupHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          renderItem={({ item }) => {
            const isMeDebtor = item.fromUserId === user?.uid;
            const isMeCreditor = item.toUserId === user?.uid;

            return (
              <View
                style={[
                  styles.settlementItemCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  shadows.sm,
                ]}
              >
                <View style={styles.settlementParties}>
                  <Text
                    style={[
                      styles.debtorName,
                      { color: isMeDebtor ? colors.expense : colors.textPrimary },
                    ]}
                  >
                    {isMeDebtor ? 'You' : item.fromUserName}
                  </Text>
                  <View style={styles.arrowContainer}>
                    <Text style={[styles.owesLabel, { color: colors.textMuted }]}>
                      owes
                    </Text>
                    <ArrowRight size={14} color={colors.textMuted} strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      styles.creditorName,
                      { color: isMeCreditor ? colors.income : colors.textPrimary },
                    ]}
                  >
                    {isMeCreditor ? 'You' : item.toUserName}
                  </Text>
                </View>

                <View style={styles.settlementRight}>
                  <Text style={[styles.settleAmount, { color: colors.textPrimary }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                  {(isMeDebtor || isMeCreditor) && (
                    <TouchableOpacity
                      style={[styles.quickSettleBtn, { backgroundColor: colors.incomeLight }]}
                      onPress={() => setSettleModalVisible(true)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.quickSettleText, { color: colors.incomeDark }]}>
                        Settle
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={CheckCircle2}
              title="All balances are settled"
              description="Everyone in this group is completely settled up. No payments are currently owed!"
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

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: Math.max(insets.bottom + 16, 24),
          },
          shadows.md,
        ]}
        onPress={() => navigation.navigate('AddExpense', { groupId })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add an expense"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Settlement Workflow Modal */}
      <SettleUpModal
        visible={settleModalVisible}
        onDismiss={() => setSettleModalVisible(false)}
        groupId={groupId}
        settlements={settlements}
        currentUserId={user?.uid || ''}
        onSuccess={() => {
          fetchGroupData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.full,
  },
  headerCodeText: {
    fontSize: typography.sizes.xs,
    fontFamily: 'Courier',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 96,
  },
  headerContainer: {
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupTextInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  groupTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  membersCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  membersCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  codeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  codeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBannerLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeBannerCode: {
    fontSize: typography.sizes.sm,
    fontFamily: 'Courier',
    fontWeight: '900',
    letterSpacing: 1,
  },
  codeSharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  codeShareText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
  },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  balanceLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  headerButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  settleBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    padding: 3,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 1,
    borderRadius: radii.md,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: typography.sizes.xs,
  },
  settlementItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  settlementParties: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtorName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    gap: 2,
  },
  owesLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '500',
  },
  creditorName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  settlementRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  settleAmount: {
    fontSize: typography.sizes.base,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  quickSettleBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.full,
  },
  quickSettleText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: spacing.base,
    bottom: spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GroupDetailsScreen;
