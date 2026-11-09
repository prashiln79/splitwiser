import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Image,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
  KeyboardAvoidingView,
  Animated,
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
  Camera,
  Pencil,
  ArrowLeft,
  Sparkles,
  Calendar,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  PieChart,
  Scale,
  Users,
  ArrowRight,
  Wallet,
  Check,
  SendHorizontal,
  ImagePlus,
  Gem,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroupById, getGroupMembers } from '../services/groups';
import { getLocalGroupById, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupExpensesLocal, deleteExpenseLocal } from '../repositories/expenseRepository';
import { getGroupSettlementsLocal } from '../repositories/settlementRepository';
import { syncService } from '../sync/syncService';
import { syncQueue } from '../sync/syncQueue';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { ExpenseListItem } from '../components/common/ExpenseListItem';
import { CategoryIcon, detectCategory, CATEGORIES_CONFIG } from '../components/common/CategoryIcon';
import { SpendingDonutChart } from '../components/common/SpendingDonutChart';
import { MonthlyTrendsChart, MonthTrendItem } from '../components/common/MonthlyTrendsChart';
import {
  GroupCoverHeader,
  GroupTopBar,
  GroupPillTabs,
  COVER_SCROLL_DISTANCE,
  TABS,
  TabKey,
} from '../components/common/GroupCoverHeader';
import { GroupCoverPhotoModal } from '../components/common/GroupCoverPhotoModal';
import { SettleUpModal } from '../components/common/SettleUpModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Expense, Group, GroupMember, OptimizedSettlement, Settlement } from '../types';
import { formatCurrency } from '../utils/currency';
import { useIsFocused } from '@react-navigation/native';

export const GroupDetailsScreen = ({ route, navigation }: any) => {
  const { groupId, groupName: initialGroupName } = route?.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();

  const scrollY = useRef(new Animated.Value(0)).current;
  const useNativeDriver = false;
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [showSettledExpenses, setShowSettledExpenses] = useState<boolean>(false);
  const [chartTimeframe, setChartTimeframe] = useState<'1M' | '3M' | 'ALL'>('ALL');
  const [isStickyActive, setIsStickyActive] = useState<boolean>(false);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const shouldBeSticky = value >= COVER_SCROLL_DISTANCE;
      setIsStickyActive((prev) => (prev !== shouldBeSticky ? shouldBeSticky : prev));
    });
    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY]);

  const stickyTabsOpacity = scrollY.interpolate({
    inputRange: [COVER_SCROLL_DISTANCE - 15, COVER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recordedSettlements, setRecordedSettlements] = useState<Settlement[]>([]);
  const [settlements, setSettlements] = useState<OptimizedSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settlePrefill, setSettlePrefill] = useState<{ toUserId?: string; amount?: number }>({});
  const [onlyMemberPromptVisible, setOnlyMemberPromptVisible] = useState(false);
  const [coverModalVisible, setCoverModalVisible] = useState(false);

  // Expense details modal state
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [confirmDeleteExpenseVisible, setConfirmDeleteExpenseVisible] = useState(false);
  const [viewReceiptModalVisible, setViewReceiptModalVisible] = useState(false);

  const selectedExpenseReceiptUri = useMemo(() => {
    if (!selectedExpense?.tags) return null;
    const tag = selectedExpense.tags.find((t) => t.startsWith('receipt:'));
    return tag ? tag.replace(/^receipt:/, '') : null;
  }, [selectedExpense]);

  // Comments per expense
  const [commentText, setCommentText] = useState('');
  const [expenseComments, setExpenseComments] = useState<
    Record<string, Array<{ id: string; author: string; text: string; time: string }>>
  >({});

  const handleAddComment = () => {
    if (!commentText.trim() || !selectedExpense) return;
    const newComment = {
      id: Date.now().toString(),
      author: user?.name || 'You',
      text: commentText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setExpenseComments((prev) => ({
      ...prev,
      [selectedExpense.id]: [...(prev[selectedExpense.id] || []), newComment],
    }));
    setCommentText('');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Spending trends for the selected expense category (last 3 months)
  const categoryTrends = useMemo(() => {
    if (!selectedExpense) return { categoryName: 'General', data: [] };
    const cat = detectCategory(selectedExpense.description, selectedExpense.tags);

    const expDate = new Date(selectedExpense.createdAt);
    const months: { monthLabel: string; year: number; monthIdx: number; total: number }[] = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(expDate.getFullYear(), expDate.getMonth() - i, 1);
      months.push({
        monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
        total: 0,
      });
    }

    expenses.forEach((e) => {
      const eCat = detectCategory(e.description, e.tags);
      if (eCat === cat) {
        const d = new Date(e.createdAt);
        const item = months.find(
          (m) => m.monthIdx === d.getMonth() && m.year === d.getFullYear()
        );
        if (item) {
          item.total += e.amount || 0;
        }
      }
    });

    const maxSpend = Math.max(...months.map((m) => m.total), 1);

    return {
      categoryName: cat,
      data: months.map((m) => ({
        ...m,
        percentage: Math.max(0, Math.min(100, (m.total / maxSpend) * 100)),
      })),
    };
  }, [selectedExpense, expenses]);

  // Load from local SQLite immediately
  const loadLocalData = async () => {
    try {
      const [localG, localM, localExp, localSet] = await Promise.all([
        getLocalGroupById(groupId),
        getLocalGroupMembers(groupId),
        getGroupExpensesLocal(groupId),
        getGroupSettlementsLocal(groupId),
      ]);
      if (localG) setGroup(localG);
      if (localM && localM.length > 0) {
        const normalized = user?.uid && user?.name
          ? localM.map((m) => (m.userId === user.uid ? { ...m, userName: user.name } : m))
          : localM;
        setMembers(normalized);
      }
      if (localExp) setExpenses(localExp);
      if (localSet) setRecordedSettlements(localSet);
      setIsLoading(false);
    } catch (e) {
      console.warn('[GroupDetails] local load failed:', e);
    }
  };

  // Load group details & members from remote in background
  const fetchGroupData = async () => {
    try {
      const [g, m] = await Promise.all([
        getGroupById(groupId),
        getGroupMembers(groupId),
      ]);
      if (g) setGroup(g);
      if (m && m.length > 0) {
        const normalized = user?.uid && user?.name
          ? m.map((item) => (item.userId === user.uid ? { ...item, userName: user.name } : item))
          : m;
        setMembers(normalized);
      }
    } catch (e) {
      console.error('[GroupDetails] error loading group:', e);
    }
  };

  useEffect(() => {
    loadLocalData();
    fetchGroupData();

    const unsubSync = syncService.subscribeToActiveGroup(groupId, () => {
      loadLocalData();
    });

    const unsubQueue = syncQueue.subscribe(() => {
      loadLocalData();
    });

    return () => {
      unsubSync();
      unsubQueue();
    };
  }, [groupId]);

  useEffect(() => {
    if (isFocused) {
      loadLocalData();
    }
  }, [isFocused]);

  useEffect(() => {
    if (members.length > 0) {
      setSettlements(getOptimizedSettlements(expenses, members, recordedSettlements));
    }
  }, [expenses, members, recordedSettlements]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await fetchGroupData();
    await loadLocalData();
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

  const handleAddExpenseClick = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (members.length <= 1) {
      setOnlyMemberPromptVisible(true);
    } else {
      navigation.navigate('AddExpense', { groupId });
    }
  };

  const handleEditSelectedExpense = () => {
    if (!selectedExpense) return;
    const exp = selectedExpense;
    setSelectedExpense(null);
    navigation.navigate('AddExpense', {
      groupId,
      expenseToEdit: exp,
    });
  };

  const handleDeleteSelectedExpense = async () => {
    if (!selectedExpense) return;
    setIsDeletingExpense(true);
    try {
      await deleteExpenseLocal(groupId, selectedExpense.id);
      await loadLocalData();
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
    if (user?.uid && user?.name) {
      map.set(user.uid, user.name);
    }
    return map;
  }, [members, user]);

  const getMemberName = (uid: string) => {
    if (uid === user?.uid && user?.name) return user.name;
    return memberMap.get(uid) || 'Member';
  };

  // Balance calculations
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

  // Total expense amounts
  const totalExpensesAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const myPaidAmount = useMemo(() => {
    if (!user) return 0;
    return expenses
      .filter((e) => (e.paidBy || e.createdBy) === user.uid)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses, user]);

  const myShareAmount = useMemo(() => {
    if (!user) return 0;
    return expenses.reduce((sum, e) => {
      const mySplit = e.splits?.find((s) => s.userId === user.uid);
      return sum + (mySplit ? mySplit.amount : 0);
    }, 0);
  }, [expenses, user]);

  // Chart Timeframe Filtered Expenses
  const chartFilteredExpenses = useMemo(() => {
    if (chartTimeframe === 'ALL') return expenses;
    const now = new Date();
    const cutoff = new Date();
    if (chartTimeframe === '1M') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (chartTimeframe === '3M') {
      cutoff.setMonth(now.getMonth() - 3);
    }
    const cutoffTime = cutoff.getTime();
    return expenses.filter((e) => new Date(e.createdAt).getTime() >= cutoffTime);
  }, [expenses, chartTimeframe]);

  const filteredTotalExpensesAmount = useMemo(() => {
    return chartFilteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [chartFilteredExpenses]);

  const filteredMyShareAmount = useMemo(() => {
    if (!user) return 0;
    return chartFilteredExpenses.reduce((sum, e) => {
      const mySplit = e.splits?.find((s) => s.userId === user.uid);
      return sum + (mySplit ? mySplit.amount : 0);
    }, 0);
  }, [chartFilteredExpenses, user]);

  // Category breakdown for Charts with dynamic colors
  const filteredCategoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    chartFilteredExpenses.forEach((e) => {
      const cat = detectCategory(e.description, e.tags);
      const existing = map.get(cat) || { total: 0, count: 0 };
      existing.total += e.amount || 0;
      existing.count += 1;
      map.set(cat, existing);
    });

    const list = Array.from(map.entries()).map(([category, data]) => {
      const color = CATEGORIES_CONFIG[category]?.color || '#059669';
      return {
        category,
        amount: data.total,
        total: data.total,
        count: data.count,
        percentage:
          filteredTotalExpensesAmount > 0 ? (data.total / filteredTotalExpensesAmount) * 100 : 0,
        color,
      };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [chartFilteredExpenses, filteredTotalExpensesAmount]);

  // Legacy Category breakdown (for backwards compatibility if referenced)
  const categoryBreakdown = filteredCategoryBreakdown;

  // 6-month historical spending trends
  const monthlyTrendsData = useMemo<MonthTrendItem[]>(() => {
    const now = new Date();
    const months: MonthTrendItem[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
        total: 0,
        count: 0,
      });
    }

    expenses.forEach((e) => {
      const d = new Date(e.createdAt);
      const match = months.find(
        (m) => m.monthIdx === d.getMonth() && m.year === d.getFullYear()
      );
      if (match) {
        match.total += e.amount || 0;
        match.count += 1;
      }
    });

    return months;
  }, [expenses]);

  // Per-member breakdown & net balance calculation
  const memberBalances = useMemo(() => {
    const paidMap = new Map<string, number>();
    const shareMap = new Map<string, number>();

    members.forEach((m) => {
      paidMap.set(m.userId, 0);
      shareMap.set(m.userId, 0);
    });

    expenses.forEach((e) => {
      const payer = e.paidBy || e.createdBy;
      paidMap.set(payer, (paidMap.get(payer) || 0) + e.amount);
      e.splits?.forEach((s) => {
        shareMap.set(s.userId, (shareMap.get(s.userId) || 0) + s.amount);
      });
    });

    const settlementNetMap = new Map<string, number>();
    members.forEach((m) => settlementNetMap.set(m.userId, 0));
    recordedSettlements.forEach((s) => {
      settlementNetMap.set(s.fromUserId, (settlementNetMap.get(s.fromUserId) || 0) + s.amount);
      settlementNetMap.set(s.toUserId, (settlementNetMap.get(s.toUserId) || 0) - s.amount);
    });

    return members.map((m) => {
      const totalPaid = paidMap.get(m.userId) || 0;
      const totalShare = shareMap.get(m.userId) || 0;
      const settlementAdj = settlementNetMap.get(m.userId) || 0;
      const net = totalPaid - totalShare + settlementAdj;
      const percentage = totalExpensesAmount > 0 ? (totalPaid / totalExpensesAmount) * 100 : 0;
      const isMe = m.userId === user?.uid;
      const name = isMe && user?.name ? user.name : m.userName;

      return {
        userId: m.userId,
        userName: name,
        imageUrl: m.imageUrl,
        totalPaid,
        totalShare,
        net,
        percentage,
        isMe,
      };
    });
  }, [members, expenses, recordedSettlements, totalExpensesAmount, user]);

  // Filtered member spending for Charts tab (distinguishing cash disbursed vs fair share)
  const filteredMemberSpending = useMemo(() => {
    const paidMap = new Map<string, number>();
    const shareMap = new Map<string, number>();

    members.forEach((m) => {
      paidMap.set(m.userId, 0);
      shareMap.set(m.userId, 0);
    });

    chartFilteredExpenses.forEach((e) => {
      const payer = e.paidBy || e.createdBy;
      paidMap.set(payer, (paidMap.get(payer) || 0) + e.amount);
      e.splits?.forEach((s) => {
        shareMap.set(s.userId, (shareMap.get(s.userId) || 0) + s.amount);
      });
    });

    return members.map((m) => {
      const totalPaid = paidMap.get(m.userId) || 0;
      const totalShare = shareMap.get(m.userId) || 0;
      const net = totalPaid - totalShare;
      const percentage =
        filteredTotalExpensesAmount > 0 ? (totalPaid / filteredTotalExpensesAmount) * 100 : 0;
      const isMe = m.userId === user?.uid;
      const name = isMe && user?.name ? user.name : m.userName;

      return {
        userId: m.userId,
        userName: name,
        imageUrl: m.imageUrl,
        totalPaid,
        totalShare,
        net,
        percentage,
        isMe,
      };
    });
  }, [members, chartFilteredExpenses, filteredTotalExpensesAmount, user]);

  const hasCover = Boolean(group?.coverPhoto?.imageUrl?.trim() || group?.bannerUrl?.trim());

  // Shared scrollable cover header with inline navigation pill tabs
  const renderSharedHeader = () => (
    <GroupCoverHeader
      group={group}
      initialGroupName={initialGroupName}
      memberCount={members.length}
      expenseCount={expenses.length}
      netBalance={netBalance}
      settlements={settlements}
      currentUserId={user?.uid || ''}
      onShareCode={handleShareCode}
    >
      <GroupPillTabs
        activeTabIndex={activeTabIndex}
        onTabPress={handleTabPress}
        hasCover={hasCover}
      />
    </GroupCoverHeader>
  );

  // Page navigation handling
  const handleTabPress = (index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setActiveTabIndex(index);
    scrollY.setValue(0);
  };

  const openQuickSettle = (toUserId?: string, amount?: number) => {
    setSettlePrefill({ toUserId, amount });
    setSettleModalVisible(true);
  };

  // Section 0: Expenses (Default)
  const renderExpensesSection = () => {
    return (
      <FlatList
        style={{ flex: 1 }}
        data={expenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSharedHeader}
        contentContainerStyle={[
          styles.pageScrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 90, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const dateObj = new Date(item.createdAt);
          const currentMonthYear = dateObj.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          });
          const prevMonthYear =
            index > 0
              ? new Date(expenses[index - 1].createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })
              : null;
          const showMonthHeader = currentMonthYear !== prevMonthYear;

          return (
            <View>
              {showMonthHeader && (
                <View style={styles.monthHeaderContainer}>
                  <Text style={styles.monthHeaderText}>{currentMonthYear}</Text>
                </View>
              )}
              <ExpenseListItem
                expense={item}
                currentUserId={user?.uid || ''}
                payerName={getMemberName(item.paidBy || item.createdBy)}
                onPress={() => setSelectedExpense(item)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Keep track of meals, bills, or trips by adding the first expense to this group."
            actionLabel="Add Expense"
            onAction={handleAddExpenseClick}
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
    );
  };

  // Section 1: Settle Up
  const renderSettleUpSection = () => {
    const myPendingDebts = settlements.filter((s) => s.fromUserId === user?.uid);
    const myPendingCredits = settlements.filter((s) => s.toUserId === user?.uid);
    const hasMySettlements = myPendingDebts.length > 0 || myPendingCredits.length > 0;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.pageScrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 90, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#059669']}
            tintColor="#059669"
          />
        }
      >
        {renderSharedHeader()}
        <View style={styles.tabBodyContent}>
          {isSettled ? (
          <View style={styles.settledCelebrationCard}>
            <Text style={styles.settledTitle}>You are all settled up</Text>

            <TouchableOpacity
              style={styles.toggleSettledBtn}
              onPress={() => setShowSettledExpenses((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleSettledBtnText}>
                {showSettledExpenses ? 'Hide settled expenses' : 'Tap to show settled expenses'}
              </Text>
              {showSettledExpenses ? (
                <ChevronUp size={16} color="#4B5563" />
              ) : (
                <ChevronDown size={16} color="#4B5563" />
              )}
            </TouchableOpacity>

            {/* Stylized Modern Checkmark Badge */}
            <View style={styles.modernCheckContainer}>
              <View style={styles.modernCheckBadge}>
                <Check size={44} color="#059669" strokeWidth={3.5} />
              </View>
            </View>

            <Text style={styles.settledNotice}>
              No one in this group owes you anything, and you owe no one. Great job!
            </Text>
          </View>
        ) : (
          <View style={styles.pendingSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Pending Settlements</Text>
              <Text style={styles.sectionSubCount}>{settlements.length} transfers needed</Text>
            </View>

            {settlements.map((s, index) => {
              const isMePayer = s.fromUserId === user?.uid;
              const isMeReceiver = s.toUserId === user?.uid;

              return (
                <View key={`settlement-${s.fromUserId}-${s.toUserId}-${index}`} style={styles.settlementCard}>
                  <View style={styles.settlementCardHeader}>
                    <View style={styles.settlementParties}>
                      <MemberAvatar name={s.fromUserName} size={36} />
                      <View style={styles.transferArrowWrapper}>
                        <ArrowRight size={16} color="#059669" strokeWidth={2.5} />
                      </View>
                      <MemberAvatar name={s.toUserName} size={36} />
                    </View>

                    <View style={styles.settlementAmountBox}>
                      <Text style={styles.settlementAmountText}>{formatCurrency(s.amount)}</Text>
                      <Text style={styles.settlementSubRole}>
                        {isMePayer ? 'You owe' : isMeReceiver ? 'Owes you' : 'Between members'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.settlementCardDetails}>
                    <Text style={styles.settlementDetailSentence}>
                      <Text style={{ fontWeight: '700', color: isMePayer ? '#DC2626' : '#111827' }}>
                        {isMePayer ? 'You' : s.fromUserName}
                      </Text>
                      {' pays '}
                      <Text style={{ fontWeight: '700', color: isMeReceiver ? '#059669' : '#111827' }}>
                        {isMeReceiver ? 'you' : s.toUserName}
                      </Text>
                    </Text>

                    {(isMePayer || isMeReceiver) && (
                      <TouchableOpacity
                        style={styles.cardSettleBtn}
                        onPress={() => openQuickSettle(isMePayer ? s.toUserId : undefined, s.amount)}
                        activeOpacity={0.8}
                      >
                        <Handshake size={15} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.cardSettleBtnText}>Record Payment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.toggleSettledBtnRow}
              onPress={() => setShowSettledExpenses((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleSettledBtnText}>
                {showSettledExpenses ? 'Hide past settled history' : 'Tap to show past settled history'}
              </Text>
              {showSettledExpenses ? (
                <ChevronUp size={16} color="#4B5563" />
              ) : (
                <ChevronDown size={16} color="#4B5563" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Collapsible Settled History List */}
        {showSettledExpenses && (
          <View style={styles.settledHistorySection}>
            <Text style={styles.settledHistoryHeader}>Settlement History</Text>
            {recordedSettlements.length === 0 ? (
              <View style={styles.emptySettledBox}>
                <CheckCircle2 size={24} color="#9CA3AF" />
                <Text style={styles.emptySettledText}>No past settlements recorded yet.</Text>
              </View>
            ) : (
              recordedSettlements.map((rec) => (
                <View key={rec.id} style={styles.settledHistoryItem}>
                  <View style={styles.settledHistoryIconCircle}>
                    <CheckCircle2 size={20} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settledHistoryTitle}>
                      {getMemberName(rec.fromUserId)} paid {getMemberName(rec.toUserId)}
                    </Text>
                    <Text style={styles.settledHistoryDate}>
                      {new Date(rec.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.settledHistoryAmount}>{formatCurrency(rec.amount)}</Text>
                </View>
              ))
            )}
          </View>
        )}
        </View>
      </ScrollView>
    );
  };

  // Section 2: Charts
  const renderChartsSection = () => {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.pageScrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 90, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#059669']}
            tintColor="#059669"
          />
        }
      >
        {renderSharedHeader()}
        <View style={styles.tabBodyContent}>
          {/* Timeframe Filter Selector */}
        <View style={styles.chartFilterPillsRow}>
          {(['1M', '3M', 'ALL'] as const).map((tf) => {
            const isSelected = chartTimeframe === tf;
            const label = tf === '1M' ? 'This month' : tf === '3M' ? 'Past 3 months' : 'All-time';
            return (
              <TouchableOpacity
                key={tf}
                style={[styles.chartFilterPill, isSelected && styles.chartFilterPillActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setChartTimeframe(tf);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chartFilterPillText,
                    isSelected && styles.chartFilterPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Spending Hero Card */}
        <View style={styles.chartsHeroCard}>
          <View style={styles.chartsHeroHeader}>
            <View>
              <Text style={styles.chartsHeroLabel}>Total Group Spending</Text>
              <Text style={styles.chartsHeroAmount}>
                {formatCurrency(filteredTotalExpensesAmount)}
              </Text>
            </View>
            <View style={styles.sparkleIconBadge}>
              <Gem size={22} color="#7C3AED" />
            </View>
          </View>

          <View style={styles.chartsHeroDivider} />

          <View style={styles.chartsHeroStatsRow}>
            <View style={styles.chartsHeroStat}>
              <Text style={styles.chartsHeroStatLabel}>Total Expenses</Text>
              <Text style={styles.chartsHeroStatVal}>{chartFilteredExpenses.length}</Text>
            </View>
            <View style={styles.chartsHeroStat}>
              <Text style={styles.chartsHeroStatLabel}>Average / Person</Text>
              <Text style={styles.chartsHeroStatVal}>
                {formatCurrency(
                  members.length > 0 ? filteredTotalExpensesAmount / members.length : 0
                )}
              </Text>
            </View>
            <View style={styles.chartsHeroStat}>
              <Text style={styles.chartsHeroStatLabel}>Your Fair Share</Text>
              <Text style={styles.chartsHeroStatVal}>{formatCurrency(filteredMyShareAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Category-Wise Spending Donut Chart Card */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <PieChart size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>Category Breakdown</Text>
          </View>

          {filteredCategoryBreakdown.length === 0 ? (
            <Text style={styles.emptyChartNotice}>No expense categories recorded for this period.</Text>
          ) : (
            <>
              {/* Native SVG Donut Chart with touch slice selection & center callout */}
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <SpendingDonutChart
                  data={filteredCategoryBreakdown}
                  totalAmount={filteredTotalExpensesAmount}
                  size={210}
                />
              </View>

              {/* Category Breakdown Rows */}
              {filteredCategoryBreakdown.map((item) => (
                <View key={item.category} style={styles.breakdownRow}>
                  <CategoryIcon category={item.category} size={36} />
                  <View style={styles.breakdownMiddle}>
                    <View style={styles.breakdownLabelRow}>
                      <Text style={styles.breakdownCategoryName}>{item.category}</Text>
                      <Text style={styles.breakdownAmountText}>{formatCurrency(item.total)}</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(3, item.percentage))}%`,
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.breakdownSubRow}>
                      <Text style={styles.breakdownCountText}>
                        {item.count} {item.count === 1 ? 'expense' : 'expenses'}
                      </Text>
                      <Text style={styles.breakdownPercentText}>{item.percentage.toFixed(0)}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* 6-Month Spending Trends Bar Chart */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <TrendingUp size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>6-Month Spending Trends</Text>
          </View>
          <View style={{ marginVertical: 8 }}>
            <MonthlyTrendsChart data={monthlyTrendsData} height={170} />
          </View>
        </View>

        {/* Member-Wise Spending & Contribution (Amount Paid vs Fair Share) */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <Users size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>Member Spending & Contribution</Text>
          </View>

          {filteredMemberSpending.map((m) => {
            const isOverpaid = m.net > 0.01;
            const isUnderpaid = m.net < -0.01;

            return (
              <View key={m.userId} style={styles.memberSpendingRow}>
                <MemberAvatar name={m.userName} imageUrl={m.imageUrl} size={38} />
                <View style={styles.memberSpendingRight}>
                  <View style={styles.breakdownLabelRow}>
                    <Text style={styles.memberSpendingName}>
                      {m.userName} {m.isMe ? '(You)' : ''}
                    </Text>
                    <Text style={styles.memberPaidAmount}>{formatCurrency(m.totalPaid)}</Text>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.max(3, m.percentage))}%`,
                          backgroundColor: m.isMe ? '#059669' : '#3B82F6',
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.memberSpendingSubRow}>
                    <Text style={styles.memberShareText}>
                      Fair share: {formatCurrency(m.totalShare)}
                    </Text>
                    {isOverpaid ? (
                      <View style={styles.memberNetBadgeGreen}>
                        <Text style={styles.memberNetBadgeGreenText}>
                          +{formatCurrency(m.net)} overpaid
                        </Text>
                      </View>
                    ) : isUnderpaid ? (
                      <View style={styles.memberNetBadgeRed}>
                        <Text style={styles.memberNetBadgeRedText}>
                          -{formatCurrency(Math.abs(m.net))} underpaid
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.memberPercentText}>{m.percentage.toFixed(0)}% paid</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        </View>
      </ScrollView>
    );
  };

  // Section 3: Balances
  const renderBalancesSection = () => {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.pageScrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 90, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#059669']}
            tintColor="#059669"
          />
        }
      >
        {renderSharedHeader()}
        <View style={styles.tabBodyContent}>
          {/* Individual Member Balances */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <Scale size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>Member Balances</Text>
          </View>

          {memberBalances.map((m) => {
            const isOwed = m.net > 0.01;
            const owes = m.net < -0.01;
            const settled = !isOwed && !owes;

            return (
              <View key={m.userId} style={styles.memberBalanceRow}>
                <MemberAvatar name={m.userName} imageUrl={m.imageUrl} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberBalanceName}>
                    {m.userName} {m.isMe ? '(You)' : ''}
                  </Text>
                  <Text
                    style={[
                      styles.memberBalanceStatus,
                      isOwed ? { color: '#059669' } : owes ? { color: '#DC2626' } : { color: '#6B7280' },
                    ]}
                  >
                    {isOwed
                      ? `gets back ${formatCurrency(m.net)}`
                      : owes
                      ? `owes ${formatCurrency(Math.abs(m.net))}`
                      : 'settled up'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Suggested Optimized Payments */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <Handshake size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>Suggested Payments</Text>
          </View>

          {settlements.length === 0 ? (
            <View style={styles.emptySettledBox}>
              <CheckCircle2 size={24} color="#059669" />
              <Text style={[styles.emptySettledText, { color: '#059669', fontWeight: '600' }]}>
                No debts! Everyone is settled up.
              </Text>
            </View>
          ) : (
            settlements.map((s, idx) => {
              const isMeDebtor = s.fromUserId === user?.uid;
              const isMeCreditor = s.toUserId === user?.uid;

              return (
                <View key={`balance-settlement-${idx}`} style={styles.suggestedPaymentCard}>
                  <View style={styles.suggestedPaymentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestedPaymentText}>
                        <Text style={isMeDebtor ? { color: '#DC2626', fontWeight: '700' } : { color: '#111827', fontWeight: '600' }}>
                          {isMeDebtor ? 'You' : s.fromUserName}
                        </Text>
                        <Text style={{ color: '#6B7280' }}> owes </Text>
                        <Text style={isMeCreditor ? { color: '#059669', fontWeight: '700' } : { color: '#111827', fontWeight: '600' }}>
                          {isMeCreditor ? 'you' : s.toUserName}
                        </Text>
                      </Text>
                      <Text style={styles.suggestedPaymentAmount}>{formatCurrency(s.amount)}</Text>
                    </View>

                    {(isMeDebtor || isMeCreditor) && (
                      <TouchableOpacity
                        style={styles.cardSettleBtnSmall}
                        onPress={() => openQuickSettle(isMeDebtor ? s.toUserId : undefined, s.amount)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cardSettleBtnSmallText}>Settle up</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
        </View>
      </ScrollView>
    );
  };

  // Section 4: Total & Overview
  const renderTotalSection = () => {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.pageScrollContent,
          {
            paddingBottom: Math.max(insets.bottom + 90, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#059669']}
            tintColor="#059669"
          />
        }
      >
        {renderSharedHeader()}
        <View style={styles.tabBodyContent}>
          <View style={styles.totalHeaderContainer}>
          {/* 4-Card Summary Grid */}
          <View style={styles.grid2x2}>
            <View style={styles.gridCard}>
              <Text style={styles.gridCardLabel}>Total Expenses</Text>
              <Text style={styles.gridCardValue}>{formatCurrency(totalExpensesAmount)}</Text>
            </View>
            <View style={styles.gridCard}>
              <Text style={styles.gridCardLabel}>Number of Bills</Text>
              <Text style={styles.gridCardValue}>{expenses.length}</Text>
            </View>
            <View style={styles.gridCard}>
              <Text style={styles.gridCardLabel}>You Paid</Text>
              <Text style={[styles.gridCardValue, { color: '#059669' }]}>
                {formatCurrency(myPaidAmount)}
              </Text>
            </View>
            <View style={styles.gridCard}>
              <Text style={styles.gridCardLabel}>Your Fair Share</Text>
              <Text style={[styles.gridCardValue, { color: '#DC2626' }]}>
                {formatCurrency(myShareAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Member Spending Summary */}
        <View style={styles.chartBlockCard}>
          <View style={styles.chartBlockHeader}>
            <Users size={18} color="#059669" />
            <Text style={styles.chartBlockTitle}>Member Spending Summary</Text>
          </View>

          {memberBalances.map((m) => (
            <View key={`total-member-${m.userId}`} style={styles.breakdownRow}>
              <MemberAvatar name={m.userName} imageUrl={m.imageUrl} size={36} />
              <View style={styles.breakdownMiddle}>
                <View style={styles.breakdownLabelRow}>
                  <Text style={styles.breakdownCategoryName}>
                    {m.userName} {m.isMe ? '(You)' : ''}
                  </Text>
                  <Text style={styles.breakdownAmountText}>{formatCurrency(m.totalPaid)}</Text>
                </View>
                <View style={styles.breakdownSubRow}>
                  <Text style={styles.breakdownCountText}>
                    Fair share: {formatCurrency(m.totalShare)}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownPercentText,
                      m.net > 0.01
                        ? { color: '#059669' }
                        : m.net < -0.01
                        ? { color: '#DC2626' }
                        : { color: '#6B7280' },
                    ]}
                  >
                    {m.net > 0.01
                      ? `+${formatCurrency(m.net)}`
                      : m.net < -0.01
                      ? `-${formatCurrency(Math.abs(m.net))}`
                      : 'settled'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Active Tab Scroll Content */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTabIndex === 0 && renderExpensesSection()}
          {activeTabIndex === 1 && renderSettleUpSection()}
          {activeTabIndex === 2 && renderBalancesSection()}
          {activeTabIndex === 3 && renderTotalSection()}
          {activeTabIndex === 4 && renderChartsSection()}
        </View>
      )}

      {/* Pinned Top Navigation Bar (Back, Mini Title, Settings) */}
      <GroupTopBar
        group={group}
        initialGroupName={initialGroupName}
        hasCover={hasCover}
        onBack={() => navigation.goBack()}
        onSettings={() => navigation.navigate('GroupSettings', { groupId })}
        scrollY={scrollY}
      />

      {/* Sticky Pill Navigation Tabs (Docked directly below Top Bar when scrolled) */}
      <Animated.View
        style={[
          styles.stickyTabsWrapper,
          {
            top: insets.top + 44,
            opacity: stickyTabsOpacity,
          },
        ]}
        pointerEvents={isStickyActive ? 'auto' : 'none'}
      >
        <GroupPillTabs
          activeTabIndex={activeTabIndex}
          onTabPress={handleTabPress}
          hasCover={hasCover}
          isSticky
        />
      </Animated.View>

      {/* Floating Action Button (Bottom Right) */}
      {!isLoading && (
        <TouchableOpacity
          style={styles.floatingAddExpenseBtn}
          onPress={handleAddExpenseClick}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <Receipt size={17} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
          <Text style={styles.floatingAddExpenseBtnText}>Add expense</Text>
        </TouchableOpacity>
      )}

      {/* Settlement Modal */}
      <SettleUpModal
        visible={settleModalVisible}
        onDismiss={() => {
          setSettleModalVisible(false);
          setSettlePrefill({});
        }}
        groupId={groupId}
        settlements={settlements}
        currentUserId={user?.uid || ''}
        onSuccess={() => {
          fetchGroupData();
          loadLocalData();
        }}
      />

      {/* Group Cover Photo Selection & Management Modal */}
      <GroupCoverPhotoModal
        visible={coverModalVisible}
        group={group}
        currentUserId={user?.uid || ''}
        onClose={() => setCoverModalVisible(false)}
        onSuccess={(updatedCover) => {
          setGroup((prev) =>
            prev
              ? {
                  ...prev,
                  coverPhoto: updatedCover || undefined,
                  bannerUrl: updatedCover?.imageUrl || undefined,
                }
              : null
          );
          fetchGroupData();
          loadLocalData();
        }}
      />

      {/* Full-Screen Expense Detail Screen (Matching Reference Design) */}
      {selectedExpense && (
        <Modal
          visible={!!selectedExpense}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setSelectedExpense(null)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#FFFFFF' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Top Mint Header Bar (Splitwise Screenshot Design) */}
            <View style={[styles.expDetailTopBar, { paddingTop: insets.top + 8 }]}>
              <View style={styles.expDetailNavRow}>
                <TouchableOpacity
                  onPress={() => setSelectedExpense(null)}
                  style={styles.expDetailIconBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Back"
                >
                  <ArrowLeft size={22} color="#1F2937" strokeWidth={2.4} />
                </TouchableOpacity>

                <View style={styles.expDetailRightActions}>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedExpenseReceiptUri) {
                        setViewReceiptModalVisible(true);
                      } else {
                        Alert.alert(
                          'No Receipt Attached',
                          'You can edit this expense to attach a receipt photo.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Edit Expense', onPress: handleEditSelectedExpense },
                          ]
                        );
                      }
                    }}
                    style={styles.expDetailIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Receipt photo"
                  >
                    <ImagePlus size={22} color="#1F2937" strokeWidth={2.2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setConfirmDeleteExpenseVisible(true)}
                    style={styles.expDetailIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Delete expense"
                  >
                    <Trash2 size={22} color="#1F2937" strokeWidth={2.2} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleEditSelectedExpense}
                    style={styles.expDetailIconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Edit expense"
                  >
                    <Pencil size={22} color="#1F2937" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category Icon Placed Inside Mint Header Bar */}
              <View style={styles.expDetailHeaderIconRow}>
                <CategoryIcon
                  description={selectedExpense.description}
                  tags={selectedExpense.tags}
                  size={46}
                />
              </View>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.expDetailScrollContent,
                { paddingBottom: Math.max(insets.bottom + 80, 100) },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* Title, Amount & Date */}
              <View style={styles.expDetailHeroSection}>
                <Text style={styles.expDetailTitleText}>{selectedExpense.description}</Text>
                <Text style={styles.expDetailAmountText}>
                  {formatCurrency(selectedExpense.amount)}
                </Text>
                <Text style={styles.expDetailAddedDate}>
                  Added by{' '}
                  {(selectedExpense.paidBy || selectedExpense.createdBy) === user?.uid
                    ? 'you'
                    : getMemberName(selectedExpense.paidBy || selectedExpense.createdBy)}{' '}
                  on{' '}
                  {new Date(selectedExpense.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {/* Payer and Tree Splits Breakdown */}
              <View style={styles.expDetailTreeSection}>
                {/* Payer Row */}
                <View style={styles.treePayerRow}>
                  <MemberAvatar
                    name={getMemberName(selectedExpense.paidBy || selectedExpense.createdBy)}
                    size={42}
                  />
                  <Text style={styles.treePayerText}>
                    {(selectedExpense.paidBy || selectedExpense.createdBy) === user?.uid
                      ? 'You'
                      : getMemberName(selectedExpense.paidBy || selectedExpense.createdBy)}{' '}
                    paid {formatCurrency(selectedExpense.amount)}
                  </Text>
                </View>

                {/* Tree Branches for Splits */}
                <View style={styles.treeBranchesContainer}>
                  {selectedExpense.splits.map((s, idx) => {
                    const isMe = s.userId === user?.uid;
                    const memberName = getMemberName(s.userId);
                    const isLast = idx === selectedExpense.splits.length - 1;

                    return (
                      <View key={s.userId} style={styles.treeBranchRow}>
                        <View style={styles.treeBranchLines}>
                          <View
                            style={[
                              styles.treeVerticalLine,
                              isLast && { height: 16 },
                            ]}
                          />
                          <View style={styles.treeHorizontalLine} />
                        </View>
                        <Text style={styles.treeSplitText}>
                          {isMe ? 'You owe' : `${memberName} owes`}{' '}
                          <Text style={{ fontWeight: '600' }}>{formatCurrency(s.amount)}</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Spending Trends Section */}
              <View style={styles.spendingTrendsSection}>
                <Text style={styles.spendingTrendsTitle}>
                  Spending trends for {group?.name || 'Group'} :: {categoryTrends.categoryName}
                </Text>

                <View style={styles.trendsChartCard}>
                  {categoryTrends.data.map((m, idx) => (
                    <View key={`trend-${m.monthLabel}-${idx}`} style={styles.trendMonthRow}>
                      <Text style={styles.trendMonthLabel}>{m.monthLabel}</Text>
                      <View style={styles.trendAxisLine} />
                      <View style={styles.trendBarContainer}>
                        <View
                          style={[
                            styles.trendBarFill,
                            { width: `${Math.min(100, Math.max(m.total > 0 ? 8 : 0, m.percentage))}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendMonthAmount}>{formatCurrency(m.total)}</Text>
                    </View>
                  ))}
                </View>

                {/* Violet "View more charts" Button */}
                <TouchableOpacity
                  style={styles.viewMoreChartsBtn}
                  onPress={() => {
                    setSelectedExpense(null);
                    handleTabPress(2); // Switches smoothly to Charts tab
                  }}
                  activeOpacity={0.85}
                >
                  <Gem size={15} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
                  <Text style={styles.viewMoreChartsBtnText}>View more charts</Text>
                </TouchableOpacity>
              </View>

              {/* Comments Display (if any) */}
              {expenseComments[selectedExpense.id]?.length > 0 && (
                <View style={styles.commentsListSection}>
                  <Text style={styles.commentsSectionHeader}>Comments</Text>
                  {expenseComments[selectedExpense.id].map((c) => (
                    <View key={c.id} style={styles.commentItem}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentAuthor}>{c.author}</Text>
                        <Text style={styles.commentTime}>{c.time}</Text>
                      </View>
                      <Text style={styles.commentText}>{c.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Bottom Add Comment Bar */}
            <View
              style={[
                styles.bottomCommentBar,
                { paddingBottom: Math.max(insets.bottom + 8, 12) },
              ]}
            >
              <View style={styles.commentInputWrapper}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment"
                  placeholderTextColor="#9CA3AF"
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={handleAddComment}
                />
                <TouchableOpacity
                  onPress={handleAddComment}
                  style={styles.commentSendBtn}
                  activeOpacity={0.7}
                  disabled={!commentText.trim()}
                >
                  <SendHorizontal
                    size={20}
                    color={commentText.trim() ? '#059669' : '#9CA3AF'}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Full-Screen Local Receipt Viewer Modal */}
      {selectedExpenseReceiptUri && (
        <Modal
          visible={viewReceiptModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewReceiptModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalDialog, { maxHeight: '85%' }]}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Camera size={20} color="#059669" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                    Receipt Photo
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setViewReceiptModalVisible(false)}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close receipt photo"
                >
                  <X size={20} color="#6B6B6B" />
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: selectedExpenseReceiptUri }}
                style={styles.receiptFullImage}
                resizeMode="contain"
              />
              <Text style={styles.receiptLocalNotice}>
                Stored locally on this device only (not uploaded to cloud)
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Splitwise Prompt: Only Member in Group */}
      <Modal
        visible={onlyMemberPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOnlyMemberPromptVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOnlyMemberPromptVisible(false)}
        >
          <View style={styles.onlyMemberDialog}>
            <Text style={styles.onlyMemberTitle}>
              You are the only person in this group.
            </Text>
            <Text style={styles.onlyMemberSub}>
              Do you need to add anyone to your group before you start adding expenses?
            </Text>
            <TouchableOpacity
              style={styles.onlyMemberPrimaryBtn}
              onPress={() => {
                setOnlyMemberPromptVisible(false);
                navigation.navigate('AddExpense', { groupId });
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.onlyMemberPrimaryBtnText}>Start adding expenses</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.onlyMemberSecondaryBtn}
              onPress={() => {
                setOnlyMemberPromptVisible(false);
                handleShareCode();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.onlyMemberSecondaryBtnText}>Add group members</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
    backgroundColor: '#F9FAFB',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Emerald Banner Header
  emeraldBanner: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bannerGroupTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  bannerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bannerActionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Status Alert Strip
  statusAlertStrip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusAlertText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Sticky Pill Navigation Tabs
  stickyTabsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
  },
  stickyHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  pillTabsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pillTabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navPillActive: {
    backgroundColor: '#059669',
  },
  navPillSettleActive: {
    backgroundColor: '#EA580C',
  },
  navPillInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  navPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  navPillTextActive: {
    color: '#FFFFFF',
  },
  navPillTextInactive: {
    color: '#374151',
  },

  // Pager Scroll
  pagerContainer: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  tabBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // Section 1: Settle Up
  settledCelebrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  settledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  toggleSettledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  toggleSettledBtnText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  modernCheckContainer: {
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCheckBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#A7F3D0',
  },
  settledNotice: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    maxWidth: 280,
  },

  pendingSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  settlementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settlementCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settlementParties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferArrowWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementAmountBox: {
    alignItems: 'flex-end',
  },
  settlementAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  settlementSubRole: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  settlementCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  settlementDetailSentence: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },
  cardSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  cardSettleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleSettledBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },

  settledHistorySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settledHistoryHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  settledHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  settledHistoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledHistoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  settledHistoryDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  settledHistoryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  emptySettledBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptySettledText: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Section 2: Charts
  chartsHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartsHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartsHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartsHeroAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  sparkleIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartsHeroDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  chartsHeroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartsHeroStat: {
    flex: 1,
  },
  chartsHeroStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 3,
  },
  chartsHeroStatVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  chartBlockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  chartBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptyChartNotice: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  breakdownMiddle: {
    flex: 1,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  breakdownCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  breakdownSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  breakdownCountText: {
    fontSize: 11,
    color: '#6B7280',
  },
  breakdownPercentText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },

  memberSpendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  memberSpendingRight: {
    flex: 1,
  },
  memberSpendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  memberPaidAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  memberSpendingSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  memberShareText: {
    fontSize: 11,
    color: '#6B7280',
  },
  memberPercentText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },

  // Section 3: Balances
  memberBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberBalanceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  memberBalanceStatus: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  suggestedPaymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestedPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestedPaymentText: {
    fontSize: 13,
    marginBottom: 2,
  },
  suggestedPaymentAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  cardSettleBtnSmall: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  cardSettleBtnSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Section 4: Total & Ledger
  totalHeaderContainer: {
    marginBottom: 12,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gridCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  gridCardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  ledgerHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  ledgerSubText: {
    fontSize: 12,
    color: '#6B7280',
  },
  monthHeaderContainer: {
    backgroundColor: '#EDF0F4',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  monthHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  // Floating Action Button (Bottom Right)
  floatingAddExpenseBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 20,
  },
  floatingAddExpenseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Modals & Details
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  expenseDetailAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#059669',
    marginBottom: 4,
  },
  expenseDetailDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  breakdownBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  payerDetailRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 10,
  },
  payerDetailText: {
    fontSize: 14,
    color: '#374151',
  },
  splitsScrollView: {
    maxHeight: 160,
  },
  splitDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  splitMemberName: {
    fontSize: 13,
    color: '#4B5563',
  },
  splitAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  receiptPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  receiptPreviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  receiptFullImage: {
    width: '100%',
    height: 360,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  receiptLocalNotice: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Only Member Prompt
  onlyMemberDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  onlyMemberTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  onlyMemberSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  onlyMemberPrimaryBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  onlyMemberPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlyMemberSecondaryBtn: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  onlyMemberSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  // Chart Timeframe Filter & Badges
  chartFilterPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  chartFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartFilterPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chartFilterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  chartFilterPillTextActive: {
    color: '#FFFFFF',
  },
  memberNetBadgeGreen: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  memberNetBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  memberNetBadgeRed: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  memberNetBadgeRedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Full-Screen Expense Detail Screen Styles (Reference Matching)
  expDetailTopBar: {
    backgroundColor: '#DCEDE2',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  expDetailNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expDetailIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expDetailRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expDetailHeaderIconRow: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  expDetailScrollContent: {
    paddingBottom: 24,
  },
  expDetailHeroSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  expDetailCategoryIconWrapper: {
    marginBottom: 8,
  },
  expDetailTitleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  expDetailAmountText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
    marginBottom: 6,
  },
  expDetailAddedDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  expDetailTreeSection: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  treePayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  treePayerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  treeBranchesContainer: {
    marginTop: 4,
  },
  treeBranchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },
  treeBranchLines: {
    width: 42,
    height: 34,
    position: 'relative',
    justifyContent: 'center',
  },
  treeVerticalLine: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#D1D5DB',
  },
  treeHorizontalLine: {
    position: 'absolute',
    left: 20,
    top: 16,
    width: 18,
    height: 1.5,
    backgroundColor: '#D1D5DB',
  },
  treeSplitText: {
    fontSize: 14,
    color: '#374151',
  },
  spendingTrendsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  spendingTrendsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  trendsChartCard: {
    marginBottom: 8,
  },
  trendMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trendMonthLabel: {
    width: 38,
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  trendAxisLine: {
    width: 1.5,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  trendBarContainer: {
    flex: 1,
    height: 22,
    justifyContent: 'center',
    marginRight: 12,
  },
  trendBarFill: {
    height: 20,
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
  },
  trendMonthAmount: {
    minWidth: 70,
    textAlign: 'right',
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  viewMoreChartsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6D28D9',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  viewMoreChartsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  commentsListSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  commentsSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  commentItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  commentTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  commentText: {
    fontSize: 13,
    color: '#374151',
  },
  bottomCommentBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 4,
  },
  commentSendBtn: {
    padding: 6,
  },
});

export default GroupDetailsScreen;
