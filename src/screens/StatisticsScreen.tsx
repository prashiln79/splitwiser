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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  PieChart as PieChartIcon,
  CreditCard,
  Wallet,
  ArrowUpRight,
  Calendar,
  Layers,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, ThemeColors } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { getAllUserExpensesLocal } from '../repositories/expenseRepository';
import { getLocalGroups } from '../repositories/groupRepository';
import { syncQueue } from '../sync/syncQueue';
import { syncService } from '../sync/syncService';
import { detectCategory, CATEGORIES_CONFIG, ExpenseCategory } from '../components/common/CategoryIcon';
import { formatCurrency } from '../utils/currency';
import { Expense } from '../types';

interface GroupedExpense extends Expense {
  groupName?: string;
  category: ExpenseCategory;
}

interface CategoryTotal {
  category: ExpenseCategory;
  totalAmount: number;
  yourShare: number;
  count: number;
  percentage: number;
}

interface GroupSpending {
  groupId: string;
  groupName: string;
  totalAmount: number;
  yourShare: number;
  percentage: number;
}

export const StatisticsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [expenses, setExpenses] = useState<GroupedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Month navigation: 0 = current month, -1 = last month, etc.
  const [monthOffset, setMonthOffset] = useState(0);

  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthLabel = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  const isCurrentMonth = monthOffset === 0;

  // Load all expenses from SQLite
  const loadExpenses = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await getAllUserExpensesLocal(user.uid);
      const withCategory: GroupedExpense[] = rows.map((e) => ({
        ...e,
        category: detectCategory(e.description, e.tags),
      }));
      setExpenses(withCategory);
    } catch (err) {
      console.warn('Failed to load statistics expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadExpenses();

    // Listen to sync queue to auto-refresh whenever sync finishes
    const unsubQueue = syncQueue.subscribe(() => {
      loadExpenses();
    });

    return () => {
      unsubQueue();
    };
  }, [loadExpenses]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (user) {
      await syncService.syncUserGroups(user.uid);
    }
    await loadExpenses();
    setIsRefreshing(false);
  };

  const handlePrevMonth = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMonthOffset((prev) => prev - 1);
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMonthOffset((prev) => prev + 1);
  };

  const handleResetCurrentMonth = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMonthOffset(0);
  };

  // Filter expenses for selected month & year
  const monthlyExpenses = useMemo(() => {
    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();

    return expenses.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  }, [expenses, selectedDate]);

  // Aggregate monthly spending metrics
  const {
    totalGroupSpending,
    totalYouPaid,
    totalYourShare,
    categoryBreakdown,
    groupBreakdown,
    topExpenses,
  } = useMemo(() => {
    if (!user) {
      return {
        totalGroupSpending: 0,
        totalYouPaid: 0,
        totalYourShare: 0,
        categoryBreakdown: [],
        groupBreakdown: [],
        topExpenses: [],
      };
    }

    let groupTotal = 0;
    let youPaid = 0;
    let yourShare = 0;

    const catMap = new Map<ExpenseCategory, { total: number; yourShare: number; count: number }>();
    const grpMap = new Map<string, { groupName: string; total: number; yourShare: number }>();

    for (const exp of monthlyExpenses) {
      groupTotal += exp.amount;

      // Check how much user paid
      if (exp.paidBy === user.uid) {
        youPaid += exp.amount;
      }

      // Check user's share from splits
      let mySplit = 0;
      if (exp.splits && exp.splits.length > 0) {
        const found = exp.splits.find((s) => s.userId === user.uid);
        if (found) {
          mySplit = found.amount;
        }
      } else {
        // Equal split fallback if splits not populated
        mySplit = exp.amount;
      }
      yourShare += mySplit;

      // Category aggregation
      const cat = exp.category;
      const prevCat = catMap.get(cat) || { total: 0, yourShare: 0, count: 0 };
      catMap.set(cat, {
        total: prevCat.total + exp.amount,
        yourShare: prevCat.yourShare + mySplit,
        count: prevCat.count + 1,
      });

      // Group aggregation
      const gId = exp.groupId;
      const gName = exp.groupName || 'Group';
      const prevGrp = grpMap.get(gId) || { groupName: gName, total: 0, yourShare: 0 };
      grpMap.set(gId, {
        groupName: gName,
        total: prevGrp.total + exp.amount,
        yourShare: prevGrp.yourShare + mySplit,
      });
    }

    // Convert category map to sorted list
    const catList: CategoryTotal[] = Array.from(catMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        totalAmount: data.total,
        yourShare: data.yourShare,
        count: data.count,
        percentage: groupTotal > 0 ? (data.total / groupTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Convert group map to sorted list
    const grpList: GroupSpending[] = Array.from(grpMap.entries())
      .map(([id, data]) => ({
        groupId: id,
        groupName: data.groupName,
        totalAmount: data.total,
        yourShare: data.yourShare,
        percentage: groupTotal > 0 ? (data.total / groupTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Top 5 largest expenses
    const top = [...monthlyExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

    return {
      totalGroupSpending: groupTotal,
      totalYouPaid: youPaid,
      totalYourShare: yourShare,
      categoryBreakdown: catList,
      groupBreakdown: grpList,
      topExpenses: top,
    };
  }, [monthlyExpenses, user]);

  return (
    <View style={styles.container}>
      <AppHeader title="Statistics" />

      {/* Month Navigator Header */}
      <View style={styles.monthNavigator}>
        <TouchableOpacity
          style={styles.monthNavBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthTitleWrapper}
          onPress={handleResetCurrentMonth}
          activeOpacity={0.8}
        >
          <Calendar size={16} color="#059669" style={{ marginRight: 6 }} />
          <Text style={styles.monthTitleText}>{monthLabel}</Text>
          {isCurrentMonth ? (
            <View style={styles.currentMonthBadge}>
              <Text style={styles.currentMonthBadgeText}>Now</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
          onPress={handleNextMonth}
          disabled={isCurrentMonth}
          activeOpacity={0.7}
          accessibilityLabel="Next month"
        >
          <ChevronRight size={20} color={isCurrentMonth ? colors.border : colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#059669" />
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
              colors={['#059669']}
              tintColor="#059669"
            />
          }
        >
          {/* Main Monthly Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeaderRow}>
              <View>
                <Text style={styles.summarySubTitle}>Total Group Spending</Text>
                <Text style={styles.summaryMainAmount}>
                  {formatCurrency(totalGroupSpending)}
                </Text>
              </View>
              <View style={styles.trendingIconBox}>
                <TrendingUp size={22} color="#059669" />
              </View>
            </View>

            <View style={styles.summaryDivider} />

            {/* Your Share vs You Paid */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricLabelRow}>
                  <Wallet size={14} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.metricLabel}>Your Share</Text>
                </View>
                <Text style={styles.metricValue}>
                  {formatCurrency(totalYourShare)}
                </Text>
                <Text style={styles.metricSub}>Your consumption</Text>
              </View>

              <View style={styles.metricSeparator} />

              <View style={styles.metricItem}>
                <View style={styles.metricLabelRow}>
                  <CreditCard size={14} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.metricLabel}>You Paid</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#1E40AF' }]}>
                  {formatCurrency(totalYouPaid)}
                </Text>
                <Text style={styles.metricSub}>Out of pocket</Text>
              </View>
            </View>
          </View>

          {monthlyExpenses.length === 0 ? (
            /* Empty State for Month */
            <View style={styles.emptyCard}>
              <View style={styles.emptyCircle}>
                <Receipt size={36} color="#059669" strokeWidth={1.7} />
              </View>
              <Text style={styles.emptyTitle}>No expenses in {monthLabel}</Text>
              <Text style={styles.emptyText}>
                Shared expenses recorded in this month will automatically appear here with full category and group breakdowns.
              </Text>
            </View>
          ) : (
            <>
              {/* Category Breakdowns Section */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <PieChartIcon size={18} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Category Breakdown</Text>
                </View>
                <Text style={styles.sectionBadge}>
                  {categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'category' : 'categories'}
                </Text>
              </View>

              <View style={styles.categoriesCard}>
                {categoryBreakdown.map((cat, index) => {
                  const config = CATEGORIES_CONFIG[cat.category] || CATEGORIES_CONFIG.General;
                  const Icon = config.icon;
                  const pct = Math.round(cat.percentage);

                  return (
                    <View key={cat.category} style={styles.categoryItemWrapper}>
                      <View style={styles.categoryTopRow}>
                        <View style={styles.categoryLeftCol}>
                          <View
                            style={[
                              styles.categoryIconCircle,
                              { backgroundColor: config.bgColor },
                            ]}
                          >
                            <Icon size={18} color={config.color} strokeWidth={2} />
                          </View>
                          <View>
                            <Text style={styles.categoryName}>{config.label}</Text>
                            <Text style={styles.categoryCount}>
                              {cat.count} {cat.count === 1 ? 'expense' : 'expenses'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.categoryRightCol}>
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(cat.totalAmount)}
                          </Text>
                          <Text style={styles.categoryPercentText}>{pct}%</Text>
                        </View>
                      </View>

                      {/* Visual Progress Bar */}
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.max(pct, 4)}%`,
                              backgroundColor: config.color,
                            },
                          ]}
                        />
                      </View>

                      {index < categoryBreakdown.length - 1 && (
                        <View style={styles.categoryDivider} />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Group Distribution Section */}
              {groupBreakdown.length > 1 && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Layers size={18} color="#059669" style={{ marginRight: 8 }} />
                      <Text style={styles.sectionTitle}>Spending by Group</Text>
                    </View>
                  </View>

                  <View style={styles.groupCard}>
                    {groupBreakdown.map((grp, index) => {
                      const pct = Math.round(grp.percentage);
                      return (
                        <View key={grp.groupId} style={styles.groupItemWrapper}>
                          <View style={styles.groupTopRow}>
                            <Text style={styles.groupItemName} numberOfLines={1}>
                              {grp.groupName}
                            </Text>
                            <Text style={styles.groupItemAmount}>
                              {formatCurrency(grp.totalAmount)}
                            </Text>
                          </View>

                          <View style={styles.progressBarBg}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${Math.max(pct, 4)}%`,
                                  backgroundColor: '#10B981',
                                },
                              ]}
                            />
                          </View>
                          {index < groupBreakdown.length - 1 && (
                            <View style={styles.categoryDivider} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Top Monthly Expenses */}
              {topExpenses.length > 0 && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <ArrowUpRight size={18} color="#059669" style={{ marginRight: 8 }} />
                      <Text style={styles.sectionTitle}>Top Expenses this Month</Text>
                    </View>
                  </View>

                  <View style={styles.topExpensesCard}>
                    {topExpenses.map((exp, index) => {
                      const config = CATEGORIES_CONFIG[exp.category] || CATEGORIES_CONFIG.General;
                      const Icon = config.icon;
                      const d = new Date(exp.createdAt);
                      const formattedDate = d.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <TouchableOpacity
                          key={exp.id}
                          style={styles.topExpenseItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (exp.groupId) {
                              navigation.navigate('GroupDetails', {
                                groupId: exp.groupId,
                                groupName: exp.groupName || 'Group',
                              });
                            }
                          }}
                        >
                          <View
                            style={[
                              styles.categoryIconCircle,
                              { backgroundColor: config.bgColor, width: 38, height: 38 },
                            ]}
                          >
                            <Icon size={17} color={config.color} strokeWidth={2} />
                          </View>

                          <View style={styles.topExpenseInfo}>
                            <Text style={styles.topExpenseDesc} numberOfLines={1}>
                              {exp.description}
                            </Text>
                            <Text style={styles.topExpenseMeta}>
                              {formattedDate} · {exp.groupName || 'Group'}
                            </Text>
                          </View>

                          <Text style={styles.topExpenseAmount}>
                            {formatCurrency(exp.amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  currentMonthBadge: {
    backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#A7F3D0',
  },
  currentMonthBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  // Summary Card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summarySubTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryMainAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  trendingIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricSeparator: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.income,
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // Category Card
  categoriesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryItemWrapper: {
    paddingVertical: 10,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  categoryRightCol: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryPercentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 14,
  },
  // Group Card
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupItemWrapper: {
    paddingVertical: 8,
  },
  groupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  groupItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Top Expenses
  topExpensesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topExpenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topExpenseInfo: {
    flex: 1,
  },
  topExpenseDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topExpenseMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  topExpenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Empty State
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

export default StatisticsScreen;

