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
  Image,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Receipt,
  Users,
  Handshake,
  UserPlus,
  EllipsisVertical,
  Pencil,
  Image as ImageIcon,
  ChartColumnIncreasing,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroupById, getGroupMembers, updateGroup } from '../services/groups';
import { subscribeToExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { ExpenseListItem } from '../components/common/ExpenseListItem';
import { SettleUpModal } from '../components/common/SettleUpModal';
import { EmptyState } from '../components/common/EmptyState';
import { Expense, Group, GroupMember, OptimizedSettlement } from '../types';
import { formatCurrency } from '../utils/currency';

/**
 * Beautiful default rolling hills & sun illustration banner matching the design.
 */
const GroupDefaultBanner = () => (
  <Svg width="100%" height="100%" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice">
    <Defs>
      <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#D1FAE5" />
        <Stop offset="100%" stopColor="#A7F3D0" />
      </LinearGradient>
      <LinearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FEF9C3" />
        <Stop offset="100%" stopColor="#FEF08A" />
      </LinearGradient>
    </Defs>

    {/* Sky */}
    <Rect x="0" y="0" width="400" height="130" fill="url(#skyGrad)" />

    {/* Sun */}
    <Circle cx="308" cy="65" r="28" fill="url(#sunGrad)" opacity="0.95" />

    {/* Distant Hills */}
    <Path
      d="M0,88 Q100,50 200,72 T400,66 L400,130 L0,130 Z"
      fill="#6EE7B7"
      opacity="0.75"
    />

    {/* Mid Hills */}
    <Path
      d="M0,80 Q130,105 250,76 T400,90 L400,130 L0,130 Z"
      fill="#34D399"
      opacity="0.85"
    />

    {/* Foreground Hills */}
    <Path
      d="M0,96 Q140,64 280,100 T400,86 L400,130 L0,130 Z"
      fill="#10B981"
      opacity="0.9"
    />
  </Svg>
);

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

  const handlePickBanner = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access to change the group cover photo.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      try {
        await updateGroup(groupId, { bannerUrl: uri });
        setGroup((prev) => (prev ? { ...prev, bannerUrl: uri } : prev));
      } catch (e) {
        console.warn('Failed to update group banner:', e);
      }
    }
  };

  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access to change the group avatar.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      try {
        await updateGroup(groupId, { imageUrl: uri });
        setGroup((prev) => (prev ? { ...prev, imageUrl: uri } : prev));
      } catch (e) {
        console.warn('Failed to update group avatar:', e);
      }
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

  // Render header summary card
  const renderGroupHeader = () => (
    <View style={styles.headerContainer}>
      {/* Group Card with Banner & Overlapping Avatar */}
      <View style={[styles.heroCard, shadows.sm]}>
        {/* Banner Area */}
        <View style={styles.bannerArea}>
          {group?.bannerUrl ? (
            <Image
              source={{ uri: group.bannerUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <GroupDefaultBanner />
          )}

          {/* Change Banner Photo Button */}
          <TouchableOpacity
            style={styles.bannerImageBtn}
            onPress={handlePickBanner}
            activeOpacity={0.8}
            accessibilityLabel="Change group cover photo"
            accessibilityRole="button"
          >
            <ImageIcon size={18} color="#334155" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Bottom Details Row with Overlapping Avatar */}
        <View style={styles.groupInfoRow}>
          {/* Overlapping Avatar */}
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.85}
              style={styles.avatarPressable}
              accessibilityLabel="Change group avatar"
              accessibilityRole="button"
            >
              <View style={styles.avatarCircle}>
                {group?.imageUrl ? (
                  <Image
                    source={{ uri: group.imageUrl }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {(group?.name || initialGroupName || 'T')[0].toUpperCase()}
                  </Text>
                )}
              </View>

              {/* Edit Pencil Badge */}
              <View style={styles.pencilBadge}>
                <Pencil size={11} color="#334155" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Group Name & Members */}
          <View style={styles.groupMetaCol}>
            <Text style={styles.groupTitle} numberOfLines={1}>
              {group?.name || initialGroupName}
            </Text>
            <View style={styles.membersCountRow}>
              <Users size={14} color="#64748B" strokeWidth={2} />
              <Text style={styles.membersCountText}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Balance & Actions Row */}
      <View style={styles.balanceActionsRow}>
        {/* Your balance badge */}
        <View
          style={[
            styles.balancePill,
            {
              backgroundColor: isSettled
                ? '#F1F5F9'
                : netBalance > 0
                ? '#ECFDF5'
                : '#FFF1F2',
            },
          ]}
        >
          <Text style={styles.balancePillLabel}>Your balance</Text>
          <Text
            style={[
              styles.balancePillAmount,
              {
                color: isSettled
                  ? '#0F172A'
                  : netBalance > 0
                  ? '#059669'
                  : '#E11D48',
              },
            ]}
          >
            {isSettled
              ? '₹0.00'
              : `${netBalance > 0 ? '+' : '-'}${formatCurrency(Math.abs(netBalance))}`}
          </Text>
        </View>

        {/* Settle Up Button */}
        <TouchableOpacity
          style={styles.settleUpBtn}
          onPress={() => setSettleModalVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel="Settle Up"
          accessibilityRole="button"
        >
          <Handshake size={18} color="#0F172A" strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={styles.settleUpBtnText}>Settle Up</Text>
        </TouchableOpacity>

        {/* Add Expense Button */}
        <TouchableOpacity
          style={styles.addExpenseBtn}
          onPress={() => navigation.navigate('AddExpense', { groupId })}
          activeOpacity={0.85}
          accessibilityLabel="Add Expense"
          accessibilityRole="button"
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.8} style={{ marginRight: 4 }} />
          <Text style={styles.addExpenseBtnText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Tabs: Expenses vs Balances */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'expenses' && styles.tabButtonActive,
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
            size={16}
            color={activeTab === 'expenses' ? '#059669' : '#64748B'}
            strokeWidth={activeTab === 'expenses' ? 2.4 : 2}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'expenses' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'balances' && styles.tabButtonActive,
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setActiveTab('balances');
          }}
          activeOpacity={0.8}
        >
          <ChartColumnIncreasing
            size={16}
            color={activeTab === 'balances' ? '#059669' : '#64748B'}
            strokeWidth={activeTab === 'balances' ? 2.4 : 2}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'balances' ? styles.tabTextActive : styles.tabTextInactive,
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
        subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={handleShareCode}
              style={styles.headerCircleBtn}
              accessibilityLabel="Invite members"
              accessibilityRole="button"
            >
              <UserPlus size={18} color="#0F172A" strokeWidth={2.2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('GroupSettings', { groupId })}
              style={styles.headerMoreBtn}
              accessibilityLabel="More options"
              accessibilityRole="button"
            >
              <EllipsisVertical size={20} color="#0F172A" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
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
              <View
                style={[
                  styles.settlementItemCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
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
              colors={['#059669']}
              tintColor="#059669"
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            bottom: Math.max(insets.bottom + 16, 24),
          },
          shadows.md,
        ]}
        onPress={() => navigation.navigate('AddExpense', { groupId })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add an expense"
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
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
    gap: 8,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  bannerArea: {
    height: 125,
    backgroundColor: '#D1FAE5',
    position: 'relative',
    overflow: 'hidden',
  },
  bannerImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  avatarWrapper: {
    marginTop: -28,
  },
  avatarPressable: {
    position: 'relative',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#059669',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  pencilBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    elevation: 2,
  },
  groupMetaCol: {
    marginLeft: 14,
    flex: 1,
    justifyContent: 'center',
    paddingTop: 4,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  membersCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  membersCountText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  balanceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  balancePill: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  balancePillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  balancePillAmount: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 1,
  },
  settleUpBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleUpBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  addExpenseBtn: {
    flex: 1.15,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
  },
  tabTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  tabTextInactive: {
    color: '#64748B',
    fontWeight: '600',
  },
  settlementItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderRadius: radii.xl,
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
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GroupDetailsScreen;
