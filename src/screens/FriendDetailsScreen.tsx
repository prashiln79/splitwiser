import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MoreVertical,
  Plus,
  CheckCircle2,
  Users,
  Receipt,
  ArrowRight,
  CreditCard,
  X,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, ThemeColors } from '../theme';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { getLocalGroups, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupExpensesLocal } from '../repositories/expenseRepository';
import { getGroupSettlementsLocal, recordSettlementLocal } from '../repositories/settlementRepository';
import {
  getDirectExpensesLocal,
  getDirectSettlementsLocal,
  deleteLocalFriendship,
  getDirectGroupId,
} from '../repositories/friendRepository';
import { computeDetailedFriendBalance } from '../utils/balanceCalculator';
import { syncQueue } from '../sync/syncQueue';
import { syncService } from '../sync/syncService';
import { formatCurrency } from '../utils/currency';
import { Expense, Settlement } from '../types';

export const FriendDetailsScreen = ({ route, navigation }: any) => {
  const { friendId, friendName: initialFriendName, friendshipId } = route.params;
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();

  const friendName = initialFriendName || 'Friend';

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Computed friend balance & details
  const [balanceData, setBalanceData] = useState<{
    netBalance: number;
    directBalance: number;
    groups: Array<{ groupId: string; groupName: string; balance: number }>;
    transactions: Array<{
      id: string;
      type: 'expense' | 'settlement';
      description: string;
      amount: number;
      paidBy: string;
      payerName: string;
      date: Date;
      groupId: string | null;
      groupName?: string;
      balanceImpact: number;
    }>;
  }>({
    netBalance: 0,
    directBalance: 0,
    groups: [],
    transactions: [],
  });

  // Filter tabs: 'all' | 'expenses' | 'settlements'
  const [filterTab, setFilterTab] = useState<'all' | 'expenses' | 'settlements'>('all');

  // Settle Up Modal State
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank' | 'other'>('upi');
  const [settleNote, setSettleNote] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // More Options Menu State
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // 1. Load data from SQLite and compute bilateral friend balance
  const loadFriendData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Get all local groups user is in
      const localGroups = await getLocalGroups(user.uid);

      // 2. Fetch group data for each shared group
      const groupsWithData = await Promise.all(
        localGroups.map(async (group) => {
          const [members, expenses, settlements] = await Promise.all([
            getLocalGroupMembers(group.id),
            getGroupExpensesLocal(group.id),
            getGroupSettlementsLocal(group.id),
          ]);
          return {
            groupId: group.id,
            groupName: group.name,
            members,
            expenses,
            settlements,
          };
        })
      );

      // 3. Fetch direct expenses and settlements
      const [directExpenses, directSettlements] = await Promise.all([
        getDirectExpensesLocal(user.uid, friendId),
        getDirectSettlementsLocal(user.uid, friendId),
      ]);

      // 4. Compute detailed bilateral friend balance
      const computed = computeDetailedFriendBalance(
        user.uid,
        friendId,
        friendName,
        groupsWithData,
        directExpenses,
        directSettlements
      );

      setBalanceData(computed);
    } catch (err) {
      console.warn('[FriendDetailsScreen] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, friendId, friendName]);

  useEffect(() => {
    loadFriendData();

    // Subscribe to sync queue to auto-refresh whenever sync writes finish
    const unsubQueue = syncQueue.subscribe(() => {
      loadFriendData();
    });

    return () => {
      unsubQueue();
    };
  }, [loadFriendData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (user) {
      await syncService.syncUserGroups(user.uid);
    }
    await loadFriendData();
    setIsRefreshing(false);
  };

  // Filtered transactions
  const displayedTransactions = useMemo(() => {
    if (filterTab === 'all') return balanceData.transactions;
    if (filterTab === 'expenses') return balanceData.transactions.filter((t) => t.type === 'expense');
    return balanceData.transactions.filter((t) => t.type === 'settlement');
  }, [balanceData.transactions, filterTab]);

  const isSettled = Math.abs(balanceData.netBalance) < 0.01;
  const friendOwesMe = balanceData.netBalance > 0.01;
  const iOweFriend = balanceData.netBalance < -0.01;

  // Settle up modal open
  const openSettleModal = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const defaultAmount = Math.abs(balanceData.netBalance);
    setSettleAmount(defaultAmount > 0 ? defaultAmount.toString() : '');
    setSettleNote('');
    setSettleModalVisible(true);
  };

  // Confirm settlement
  const handleConfirmSettlement = async () => {
    const numAmount = parseFloat(settleAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!user) return;

    setIsSubmittingSettle(true);
    try {
      const fromUserId = iOweFriend ? user.uid : friendId;
      const toUserId = iOweFriend ? friendId : user.uid;
      const fromUserName = iOweFriend ? (user.name || 'You') : friendName;
      const toUserName = iOweFriend ? friendName : (user.name || 'You');

      const directGid = getDirectGroupId(user.uid, friendId);

      const noteText = `${paymentMethod.toUpperCase()}${settleNote.trim() ? ` · ${settleNote.trim()}` : ''}`;

      await recordSettlementLocal(
        directGid,
        fromUserId,
        toUserId,
        fromUserName,
        toUserName,
        numAmount,
        noteText
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setSettleModalVisible(false);
      await loadFriendData();

      Alert.alert(
        'Payment Recorded',
        `Recorded ${formatCurrency(numAmount)} paid from ${fromUserName} to ${toUserName}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record settlement.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleRemoveFriend = () => {
    setMoreMenuVisible(false);
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName}? Historical transactions and group records will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (friendshipId) {
              await deleteLocalFriendship(friendshipId);
            }
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarTitleCol}>
          <Text style={[styles.topBarName, { color: colors.textPrimary }]} numberOfLines={1}>{friendName}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setMoreMenuVisible(true)}
          style={styles.moreBtn}
          accessibilityLabel="More options"
        >
          <MoreVertical size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Friend Profile & Balance Header Card */}
          <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MemberAvatar name={friendName} size={64} />
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{friendName}</Text>

            {/* Contextual Balance Text & Amount */}
            {isSettled ? (
              <View style={[styles.settledBadge, isDark && { backgroundColor: colors.surfaceSecondary }]}>
                <CheckCircle2 size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.settledBadgeText, { color: colors.primary }]}>You are all settled up</Text>
              </View>
            ) : friendOwesMe ? (
              <View style={styles.balanceCol}>
                <Text style={[styles.owesMeSubtitle, { color: colors.income }]}>{friendName} owes you</Text>
                <Text style={[styles.owesMeMainAmount, { color: colors.income }]}>
                  {formatCurrency(balanceData.netBalance)}
                </Text>
              </View>
            ) : (
              <View style={styles.balanceCol}>
                <Text style={[styles.youOweSubtitle, { color: colors.expense }]}>You owe {friendName}</Text>
                <Text style={[styles.youOweMainAmount, { color: colors.expense }]}>
                  {formatCurrency(Math.abs(balanceData.netBalance))}
                </Text>
              </View>
            )}

            {/* Two Primary Quick Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.addExpenseBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  navigation.navigate('AddExpense', {
                    friendId,
                    friendName,
                  });
                }}
                activeOpacity={0.8}
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.addExpenseBtnText}>Add expense</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settleUpBtn,
                  { backgroundColor: colors.surface, borderColor: isSettled ? colors.border : colors.primary },
                  isSettled && styles.settleUpBtnDisabled,
                ]}
                onPress={openSettleModal}
                activeOpacity={0.8}
              >
                <CreditCard size={18} color={isSettled ? colors.textMuted : colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.settleUpBtnText, { color: isSettled ? colors.textMuted : colors.primary }]}>
                  Settle up
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shared Groups Section */}
          {balanceData.groups.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Users size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Shared Groups</Text>
              </View>

              <View style={[styles.groupsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {balanceData.groups.map((grp, index) => {
                  const gSettled = Math.abs(grp.balance) < 0.01;
                  const gOwesMe = grp.balance > 0.01;

                  return (
                    <TouchableOpacity
                      key={grp.groupId}
                      style={[
                        styles.groupRowItem,
                        index < balanceData.groups.length - 1 && [styles.groupRowBorder, { borderBottomColor: colors.border }],
                      ]}
                      onPress={() => {
                        navigation.navigate('GroupDetails', {
                          groupId: grp.groupId,
                          groupName: grp.groupName,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.groupIconBox, isDark && { backgroundColor: colors.surfaceSecondary }]}>
                        <Users size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.groupNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {grp.groupName}
                        </Text>
                        <Text style={[styles.groupSubText, { color: colors.textMuted }]}>
                          {gSettled
                            ? 'settled up'
                            : gOwesMe
                            ? `${friendName} owes you`
                            : 'you owe'}
                        </Text>
                      </View>

                      <View style={styles.groupAmountCol}>
                        <Text
                          style={[
                            styles.groupAmountText,
                            gSettled
                              ? { color: colors.textMuted }
                              : gOwesMe
                              ? { color: colors.income }
                              : { color: colors.expense },
                          ]}
                        >
                          {gSettled ? '₹0.00' : formatCurrency(Math.abs(grp.balance))}
                        </Text>
                        <ArrowRight size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Transactions History Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.historyHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Receipt size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity History</Text>
              </View>

              {/* Filter Tabs */}
              <View style={styles.filterPills}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' },
                    filterTab === 'all' && { backgroundColor: isDark ? colors.surfaceSecondary : '#D1FAE5', borderWidth: isDark ? 1 : 0, borderColor: colors.primary },
                  ]}
                  onPress={() => setFilterTab('all')}
                >
                  <Text style={[styles.filterPillText, { color: colors.textMuted }, filterTab === 'all' && { color: colors.primary }]}>
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' },
                    filterTab === 'expenses' && { backgroundColor: isDark ? colors.surfaceSecondary : '#D1FAE5', borderWidth: isDark ? 1 : 0, borderColor: colors.primary },
                  ]}
                  onPress={() => setFilterTab('expenses')}
                >
                  <Text style={[styles.filterPillText, { color: colors.textMuted }, filterTab === 'expenses' && { color: colors.primary }]}>
                    Expenses
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' },
                    filterTab === 'settlements' && { backgroundColor: isDark ? colors.surfaceSecondary : '#D1FAE5', borderWidth: isDark ? 1 : 0, borderColor: colors.primary },
                  ]}
                  onPress={() => setFilterTab('settlements')}
                >
                  <Text style={[styles.filterPillText, { color: colors.textMuted }, filterTab === 'settlements' && { color: colors.primary }]}>
                    Payments
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {displayedTransactions.length === 0 ? (
              <View style={[styles.emptyTransactionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyTransactionsTitle, { color: colors.textPrimary }]}>No transactions recorded</Text>
                <Text style={[styles.emptyTransactionsSub, { color: colors.textMuted }]}>
                  Expenses and settlements shared with {friendName} will appear here.
                </Text>
              </View>
            ) : (
              <View style={[styles.transactionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {displayedTransactions.map((tx, idx) => {
                  const isExpense = tx.type === 'expense';
                  const isPositive = tx.balanceImpact > 0.001;
                  const isNegative = tx.balanceImpact < -0.001;
                  const dateStr = tx.date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <View
                      key={tx.id}
                      style={[
                        styles.transactionRow,
                        idx < displayedTransactions.length - 1 && [styles.transactionRowBorder, { borderBottomColor: colors.border }],
                      ]}
                    >
                      <View style={[styles.transactionDateBox, { backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB' }]}>
                        <Text style={[styles.transactionDateMonth, { color: colors.textMuted }]}>
                          {tx.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </Text>
                        <Text style={[styles.transactionDateDay, { color: colors.textPrimary }]}>
                          {tx.date.getDate()}
                        </Text>
                      </View>

                      <View style={styles.transactionInfo}>
                        <Text style={[styles.transactionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {tx.description}
                        </Text>
                        <Text style={[styles.transactionSub, { color: colors.textMuted }]}>
                          {tx.payerName} paid {formatCurrency(tx.amount)}
                          {tx.groupName ? ` · ${tx.groupName}` : ' · Direct'}
                        </Text>
                      </View>

                      <View style={styles.transactionImpactCol}>
                        <Text
                          style={[
                            styles.transactionImpactAmount,
                            isPositive
                              ? { color: colors.income }
                              : isNegative
                              ? { color: colors.expense }
                              : { color: colors.textMuted },
                          ]}
                        >
                          {isPositive ? '+' : isNegative ? '-' : ''}
                          {formatCurrency(Math.abs(tx.balanceImpact))}
                        </Text>
                        <Text style={[styles.transactionImpactLabel, { color: colors.textMuted }]}>
                          {isPositive ? 'you are owed' : isNegative ? 'you owe' : 'settled'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Settle Up Dialog Modal */}
      <Modal
        visible={settleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalDialog, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Settle with {friendName}</Text>
              <TouchableOpacity
                onPress={() => setSettleModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {iOweFriend
                ? `You owe ${friendName} ${formatCurrency(Math.abs(balanceData.netBalance))}`
                : friendOwesMe
                ? `${friendName} owes you ${formatCurrency(balanceData.netBalance)}`
                : `Currently settled up`}
            </Text>

            {/* Amount input */}
            <Text style={[styles.modalInputLabel, { color: colors.textPrimary }]}>Payment Amount (₹)</Text>
            <TextInput
              style={[styles.modalAmountInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={settleAmount}
              onChangeText={setSettleAmount}
              autoFocus
            />

            {/* Payment Method Selector */}
            <Text style={[styles.modalInputLabel, { color: colors.textPrimary, marginTop: 14 }]}>Payment Method</Text>
            <View style={styles.methodSelectorRow}>
              {(['upi', 'cash', 'bank', 'other'] as const).map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodPill,
                      { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' },
                      isSelected && [styles.methodPillActive, { borderColor: colors.primary, backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5' }],
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.methodPillText,
                        { color: colors.textMuted },
                        isSelected && [styles.methodPillTextActive, { color: colors.primary }],
                      ]}
                    >
                      {method.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional note */}
            <Text style={[styles.modalInputLabel, { color: colors.textPrimary, marginTop: 14 }]}>Note (Optional)</Text>
            <TextInput
              style={[styles.modalNoteInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. Paid via GPay / PhonePe"
              placeholderTextColor={colors.textMuted}
              value={settleNote}
              onChangeText={setSettleNote}
            />

            {/* Action buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setSettleModalVisible(false)}
                disabled={isSubmittingSettle}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: parseFloat(settleAmount) > 0 ? colors.primary : (isDark ? colors.surfaceSecondary : '#E5E7EB') },
                ]}
                onPress={handleConfirmSettlement}
                disabled={parseFloat(settleAmount) <= 0 || isSubmittingSettle}
              >
                {isSubmittingSettle ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.modalConfirmBtnText,
                      { color: parseFloat(settleAmount) > 0 ? '#FFFFFF' : colors.textMuted },
                    ]}
                  >
                    Record Payment
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* More Options Dropdown Modal */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View style={[styles.menuBox, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRemoveFriend}
            >
              <Trash2 size={18} color="#DC2626" style={{ marginRight: 10 }} />
              <Text style={styles.menuItemTextDestructive}>Remove Friend</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitleCol: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 8,
    },
    topBarName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    moreBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loaderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
    },
    // Profile Card
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 22,
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 10,
      marginBottom: 8,
    },
    settledBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 18,
    },
    settledBadgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    balanceCol: {
      alignItems: 'center',
      marginBottom: 18,
    },
    owesMeSubtitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.income,
    },
    owesMeMainAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.income,
      marginTop: 2,
    },
    youOweSubtitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.expense,
    },
    youOweMainAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.expense,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
      marginTop: 4,
    },
    addExpenseBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    addExpenseBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    settleUpBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    settleUpBtnDisabled: {
      borderColor: colors.border,
    },
    settleUpBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    // Section Shared Groups
    sectionContainer: {
      marginBottom: 20,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    groupsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    groupRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    groupRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    groupIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupNameText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    groupSubText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    groupAmountCol: {
      alignItems: 'flex-end',
    },
    groupAmountText: {
      fontSize: 14,
      fontWeight: '700',
    },
    // History Header
    historyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    filterPills: {
      flexDirection: 'row',
      gap: 4,
    },
    filterPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    filterPillActive: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5',
    },
    filterPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    filterPillTextActive: {
      color: colors.primary,
    },
    // Transactions List
    transactionsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    transactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    transactionRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    transactionDateBox: {
      width: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 8,
      paddingVertical: 4,
      marginRight: 10,
    },
    transactionDateMonth: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
    },
    transactionDateDay: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    transactionSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    transactionImpactCol: {
      alignItems: 'flex-end',
    },
    transactionImpactAmount: {
      fontSize: 14,
      fontWeight: '700',
    },
    transactionImpactLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    emptyTransactionsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTransactionsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    emptyTransactionsSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    colorOwed: {
      color: colors.income,
    },
    colorOwes: {
      color: colors.expense,
    },
    colorSettled: {
      color: colors.textMuted,
    },
    // Settle Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalDialog: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      elevation: 6,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 16,
    },
    modalInputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    modalAmountInput: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    methodSelectorRow: {
      flexDirection: 'row',
      gap: 8,
    },
    methodPill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    methodPillActive: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    methodPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    methodPillTextActive: {
      color: colors.primary,
    },
    modalNoteInput: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
    },
    modalActionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    modalCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalConfirmBtn: {
      flex: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
    },
    modalConfirmBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    // Menu Dropdown
    menuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 60,
      paddingRight: 20,
    },
    menuBox: {
      width: 180,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    menuItemTextDestructive: {
      fontSize: 14,
      fontWeight: '600',
      color: '#DC2626',
    },
  });

export default FriendDetailsScreen;

