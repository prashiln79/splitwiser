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
  Modal,
  ScrollView,
} from 'react-native';
import {
  Plus,
  UserPlus,
  Settings,
  Handshake,
  CheckCircle2,
  Receipt,
  X,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroupById, getGroupMembers } from '../services/groups';
import { subscribeToExpenses, deleteExpense } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { ExpenseListItem } from '../components/common/ExpenseListItem';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { SettleUpModal } from '../components/common/SettleUpModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Expense, Group, GroupMember, OptimizedSettlement } from '../types';
import { formatCurrency } from '../utils/currency';

const GroupDetailsScreen = ({ route, navigation }: any) => {
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<OptimizedSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [settleModalVisible, setSettleModalVisible] = useState(false);

  // Expense details modal state
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [confirmDeleteExpenseVisible, setConfirmDeleteExpenseVisible] = useState(false);

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

  const handleDeleteSelectedExpense = async () => {
    if (!selectedExpense) return;
    setIsDeletingExpense(true);
    try {
      await deleteExpense(groupId, selectedExpense.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setConfirmDeleteExpenseVisible(false);
      setSelectedExpense(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete expense.');
    } finally {
      setIsDeletingExpense(false);
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
  const { netBalance } = useMemo(() => {
    if (!user) return { netBalance: 0 };
    const owes = settlements
      .filter((s) => s.fromUserId === user.uid)
      .reduce((sum, s) => sum + s.amount, 0);
    const owed = settlements
      .filter((s) => s.toUserId === user.uid)
      .reduce((sum, s) => sum + s.amount, 0);
    return { netBalance: owed - owes };
  }, [settlements, user]);

  const isSettled = Math.abs(netBalance) < 0.01;

  // Build balance summary text
  const balanceSummary = useMemo(() => {
    if (isSettled) return { text: 'no balances', color: '#9E9E9E' };
    if (netBalance > 0) {
      const mySettlements = settlements.filter((s) => s.toUserId === user?.uid);
      if (mySettlements.length === 1) {
        return {
          text: `${mySettlements[0].fromUserName} owes you ${formatCurrency(mySettlements[0].amount)}`,
          color: '#1CC88A',
        };
      }
      return {
        text: `you are owed ${formatCurrency(netBalance)}`,
        color: '#1CC88A',
      };
    }
    const myDebts = settlements.filter((s) => s.fromUserId === user?.uid);
    if (myDebts.length === 1) {
      return {
        text: `you owe ${myDebts[0].toUserName} ${formatCurrency(myDebts[0].amount)}`,
        color: '#E74C3C',
      };
    }
    return {
      text: `you owe ${formatCurrency(Math.abs(netBalance))}`,
      color: '#E74C3C',
    };
  }, [isSettled, netBalance, settlements, user]);

  // Render header
  const renderGroupHeader = () => (
    <View>
      {/* Balance summary + actions */}
      <View style={styles.summarySection}>
        <Text style={[styles.balanceSummaryText, { color: balanceSummary.color }]}>
          {balanceSummary.text}
        </Text>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.settleUpBtn}
            onPress={() => setSettleModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Settle Up"
            accessibilityRole="button"
          >
            <Handshake size={16} color="#1A1A1A" strokeWidth={2} style={{ marginRight: 6 }} />
            <Text style={styles.settleUpBtnText}>Settle up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => navigation.navigate('AddExpense', { groupId })}
            activeOpacity={0.85}
            accessibilityLabel="Add Expense"
            accessibilityRole="button"
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 4 }} />
            <Text style={styles.addExpenseBtnText}>Add expense</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Underline Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setActiveTab('expenses');
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'expenses' ? styles.tabTextActive : styles.tabTextInactive,
          ]}>
            Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setActiveTab('balances');
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'balances' ? styles.tabTextActive : styles.tabTextInactive,
          ]}>
            Balances
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top App Header */}
      <AppHeader
        title={group?.name || initialGroupName}
        subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
        showBack
        onBack={() => navigation.goBack()}
        avatar={
          <MemberAvatar
            name={group?.name || initialGroupName || 'G'}
            imageUrl={group?.imageUrl}
            size={32}
          />
        }
        rightAction={
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={handleShareCode}
              style={styles.headerBtn}
              accessibilityLabel="Invite members"
              accessibilityRole="button"
            >
              <UserPlus size={20} color="#1A1A1A" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('GroupSettings', { groupId })}
              style={styles.headerBtn}
              accessibilityLabel="Group settings"
              accessibilityRole="button"
            >
              <Settings size={20} color="#1A1A1A" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
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
              onPress={() => setSelectedExpense(item)}
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
              colors={['#059669']}
              tintColor="#059669"
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
              <View style={styles.settlementRow}>
                <View style={styles.settlementInfo}>
                  <Text style={styles.settlementText}>
                    <Text style={isMeDebtor ? { color: '#E74C3C', fontWeight: '600' } : { color: '#1A1A1A', fontWeight: '600' }}>
                      {isMeDebtor ? 'You' : item.fromUserName}
                    </Text>
                    <Text style={{ color: '#9E9E9E' }}> owes </Text>
                    <Text style={isMeCreditor ? { color: '#1CC88A', fontWeight: '600' } : { color: '#1A1A1A', fontWeight: '600' }}>
                      {isMeCreditor ? 'you' : item.toUserName}
                    </Text>
                  </Text>
                  <Text style={styles.settlementAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>

                {(isMeDebtor || isMeCreditor) && (
                  <TouchableOpacity
                    style={styles.quickSettleBtn}
                    onPress={() => setSettleModalVisible(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickSettleText}>Settle up</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={CheckCircle2}
              title="All settled up"
              description="Everyone in this group is completely settled. No payments are owed!"
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

      {/* FAB */}
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 16, 24) },
        ]}
        onPress={() => navigation.navigate('AddExpense', { groupId })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add an expense"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Settlement Modal */}
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

      {/* Expense Details Modal */}
      {selectedExpense && (
        <Modal
          visible={!!selectedExpense}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedExpense(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalDialog}>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <CategoryIcon
                  description={selectedExpense.description}
                  tags={selectedExpense.tags}
                  size={42}
                />
                <View style={styles.modalHeaderActions}>
                  <TouchableOpacity
                    onPress={() => setConfirmDeleteExpenseVisible(true)}
                    style={styles.trashBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Delete expense"
                  >
                    <Trash2 size={20} color="#E74C3C" strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedExpense(null)}
                    style={styles.closeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={20} color="#6B6B6B" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Expense Title & Amount */}
              <Text style={styles.expenseDetailTitle}>
                {selectedExpense.description}
              </Text>
              <Text style={styles.expenseDetailAmount}>
                {formatCurrency(selectedExpense.amount)}
              </Text>
              <Text style={styles.expenseDetailDate}>
                Added on {new Date(selectedExpense.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>

              {/* Breakdown List */}
              <View style={styles.breakdownBox}>
                <View style={styles.payerDetailRow}>
                  <Text style={styles.payerDetailText}>
                    <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>
                      {getMemberName(selectedExpense.paidBy || selectedExpense.createdBy)}
                    </Text>
                    {' paid '}
                    <Text style={{ fontWeight: '700', color: '#1A1A1A' }}>
                      {formatCurrency(selectedExpense.amount)}
                    </Text>
                  </Text>
                </View>

                <ScrollView style={styles.splitsScrollView} showsVerticalScrollIndicator={false}>
                  {selectedExpense.splits.map((s) => {
                    const memberName = getMemberName(s.userId);
                    const isMe = s.userId === user?.uid;
                    return (
                      <View key={s.userId} style={styles.splitDetailRow}>
                        <Text style={styles.splitMemberName}>
                          {isMe ? 'You owe' : `${memberName} owes`}
                        </Text>
                        <Text style={styles.splitAmountText}>
                          {formatCurrency(s.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Expense Confirmation */}
      <ConfirmationDialog
        visible={confirmDeleteExpenseVisible}
        onDismiss={() => setConfirmDeleteExpenseVisible(false)}
        onConfirm={handleDeleteSelectedExpense}
        title="Delete Expense?"
        message="Are you sure you want to delete this expense? Balances will be recalculated."
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeletingExpense}
        icon="trash"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 96,
  },
  summarySection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  balanceSummaryText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 14,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  settleUpBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleUpBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  addExpenseBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#059669',
  },
  tabText: {
    fontSize: 15,
  },
  tabTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  tabTextInactive: {
    color: '#6B6B6B',
    fontWeight: '500',
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  settlementInfo: {
    flex: 1,
  },
  settlementText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  settlementAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },
  quickSettleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#F0FAF6',
    marginLeft: 12,
  },
  quickSettleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
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
  // Expense detail modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  expenseDetailAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  expenseDetailDate: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 16,
  },
  breakdownBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
    paddingTop: 12,
  },
  payerDetailRow: {
    marginBottom: 10,
  },
  payerDetailText: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  splitsScrollView: {
    maxHeight: 180,
  },
  splitDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  splitMemberName: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  splitAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

export default GroupDetailsScreen;
