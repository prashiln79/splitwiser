import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getGroupMembers } from '../services/groups';
import { createExpense } from '../services/expenses';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { AmountInput } from '../components/common/AmountInput';
import { MemberAvatar } from '../components/common/MemberAvatar';
import {
  CATEGORIES_CONFIG,
  detectCategory,
  ExpenseCategory,
  CategoryIcon,
} from '../components/common/CategoryIcon';
import { GroupMember, ExpenseSplit, SplitType } from '../types';
import { formatCurrency } from '../utils/currency';


const AddExpenseScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const detectedCategory = useMemo(() => detectCategory(description), [description]);
  const categoryConfig = CATEGORIES_CONFIG[detectedCategory] || CATEGORIES_CONFIG.General;
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitMethod, setSplitMethod] = useState<SplitType>('equal');
  const [payerId, setPayerId] = useState<string | null>(null);

  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getGroupMembers(groupId)
      .then((memberList) => {
        setMembers(memberList);

        const numMembers = memberList.length;
        const basePercentage = Math.floor(100 / numMembers);
        const remainder = 100 - basePercentage * numMembers;

        const initShares: Record<string, string> = {};
        const initPercentages: Record<string, string> = {};
        const initExactAmounts: Record<string, string> = {};
        const initSelected: Record<string, boolean> = {};

        memberList.forEach((m, index) => {
          initShares[m.userId] = '1';
          initPercentages[m.userId] = (
            basePercentage + (index < remainder ? 1 : 0)
          ).toString();
          initExactAmounts[m.userId] = '0.00';
          initSelected[m.userId] = true;
        });

        setShares(initShares);
        setPercentages(initPercentages);
        setExactAmounts(initExactAmounts);
        setSelectedMembers(initSelected);

        const myMembership = memberList.find((m) => m.userId === user?.uid);
        setPayerId(myMembership ? user!.uid : memberList[0]?.userId ?? null);
      })
      .catch((e) => {
        Alert.alert('Error', 'Failed to load group members.');
        console.error(e);
      })
      .finally(() => setIsLoading(false));
  }, [groupId, user]);


  const numericAmount = parseFloat(amount) || 0;

  // Real-time calculation helpers
  const equalSplitsCount = Object.values(selectedMembers).filter(Boolean).length;
  const equalSharePerPerson =
    equalSplitsCount > 0 ? numericAmount / equalSplitsCount : 0;

  const exactTotal = useMemo(() => {
    return Object.values(exactAmounts).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  }, [exactAmounts]);

  const percentageTotal = useMemo(() => {
    return Object.values(percentages).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  }, [percentages]);

  const sharesTotal = useMemo(() => {
    return Object.values(shares).reduce(
      (sum, val) => sum + (parseInt(val, 10) || 0),
      0
    );
  }, [shares]);

  const handleAddExpense = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a description for the expense.');
      return;
    }
    if (numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than zero.');
      return;
    }
    if (!payerId) {
      Alert.alert('Payer Required', 'Please select who paid for this expense.');
      return;
    }

    setIsSubmitting(true);
    try {
      let splits: ExpenseSplit[] = [];
      let finalSplitType: SplitType = splitMethod;

      if (splitMethod === 'equal') {
        const included = Object.keys(selectedMembers).filter((uid) => selectedMembers[uid]);
        if (included.length === 0) throw new Error('Please select at least one member to split with.');

        const splitAmount = Math.round((numericAmount / included.length) * 100) / 100;
        const totalSplit = splitAmount * included.length;
        const remainder = Math.round((numericAmount - totalSplit) * 100) / 100;

        splits = included.map((uid, i) => ({
          userId: uid,
          amount: i === 0 ? splitAmount + remainder : splitAmount,
          type: 'equal',
        }));
      } else if (splitMethod === 'unequal') {
        if (Math.abs(exactTotal - numericAmount) > 0.05) {
          throw new Error(
            `Exact amounts sum to ${formatCurrency(exactTotal)}, but total is ${formatCurrency(numericAmount)}.`
          );
        }
        splits = Object.entries(exactAmounts)
          .filter(([, v]) => parseFloat(v || '0') > 0)
          .map(([uid, v]) => ({
            userId: uid,
            amount: Math.round(parseFloat(v) * 100) / 100,
            type: 'unequal',
          }));
        finalSplitType = 'unequal';
      } else if (splitMethod === 'percentage') {
        if (Math.abs(percentageTotal - 100) > 0.1) {
          throw new Error(
            `Percentages must add up to 100%. Currently: ${percentageTotal.toFixed(1)}%`
          );
        }
        splits = Object.entries(percentages)
          .filter(([, v]) => parseFloat(v || '0') > 0)
          .map(([uid, v]) => ({
            userId: uid,
            amount: Math.round(numericAmount * (parseFloat(v) / 100) * 100) / 100,
            type: 'percentage',
          }));
      }

      await createExpense(groupId, user!.uid, {
        description: description.trim(),
        amount: numericAmount,
        paidBy: payerId,
        splitType: finalSplitType,
        splits,
        tags: [detectedCategory],
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Add Expense"
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 48) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount Hero Input */}
          <View style={styles.amountSection}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
              ENTER AMOUNT
            </Text>
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              autoFocus
            />
          </View>

          {/* Description Input with Auto-Selected Category Icon */}
          <View style={styles.sectionContainer}>
            <View style={styles.descriptionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Description
              </Text>
              {description.trim().length > 0 && (
                <View
                  style={[
                    styles.detectedBadge,
                    {
                      backgroundColor: categoryConfig.bgColor,
                      borderColor: categoryConfig.color + '40',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detectedBadgeText,
                      { color: categoryConfig.color },
                    ]}
                  >
                    {categoryConfig.label}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.descriptionInputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.categoryIconWrapper}>
                <CategoryIcon
                  category={detectedCategory}
                  size={38}
                />
              </View>
              <TextInput
                style={[
                  styles.descriptionInput,
                  {
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="What was this for? (e.g. Dinner, Uber, Coffee)"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                accessibilityLabel="Expense description"
              />
            </View>

          </View>

          {/* Payer Selection */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Paid By
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payerRow}
            >
              {members.map((m) => {
                const isSelected = payerId === m.userId;
                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={[
                      styles.payerCard,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryLight
                          : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      setPayerId(m.userId);
                    }}
                    activeOpacity={0.8}
                  >
                    <MemberAvatar name={m.userName} size={32} />
                    <Text
                      style={[
                        styles.payerName,
                        {
                          color: isSelected
                            ? colors.primaryDark
                            : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {m.userId === user?.uid ? 'You' : m.userName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Split Method Selector */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Split Method
            </Text>
            <View
              style={[
                styles.splitTabsContainer,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
            >
              {[
                { key: 'equal', label: 'Equally' },
                { key: 'unequal', label: 'Exact' },
                { key: 'percentage', label: 'Percentage' },
              ].map((tab) => {
                const isSelected = splitMethod === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.splitTabBtn,
                      isSelected && [
                        styles.splitTabActive,
                        { backgroundColor: colors.surface },
                      ],
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      setSplitMethod(tab.key as SplitType);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.splitTabText,
                        {
                          color: isSelected ? colors.textPrimary : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Split Members List */}
            <View
              style={[
                styles.splitDetailsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                shadows.sm,
              ]}
            >
              {splitMethod === 'equal' && (
                <View style={styles.equalContainer}>
                  <Text style={[styles.equalHint, { color: colors.textSecondary }]}>
                    Split between {equalSplitsCount} {equalSplitsCount === 1 ? 'person' : 'people'} ({formatCurrency(equalSharePerPerson)} each):
                  </Text>
                  {members.map((m) => {
                    const isChecked = !!selectedMembers[m.userId];
                    return (
                      <TouchableOpacity
                        key={m.userId}
                        style={[
                          styles.memberSplitRow,
                          { borderBottomColor: colors.borderLight },
                        ]}
                        onPress={() => {
                          setSelectedMembers((prev) => ({
                            ...prev,
                            [m.userId]: !prev[m.userId],
                          }));
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.memberSplitLeft}>
                          <MemberAvatar name={m.userName} size={36} />
                          <Text
                            style={[
                              styles.memberSplitName,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                          </Text>
                        </View>

                        <View style={styles.memberSplitRight}>
                          {isChecked && (
                            <Text
                              style={[
                                styles.memberSplitAmount,
                                { color: colors.primaryDark },
                              ]}
                            >
                              {formatCurrency(equalSharePerPerson)}
                            </Text>
                          )}
                          <View
                            style={[
                              styles.checkbox,
                              {
                                backgroundColor: isChecked
                                  ? colors.primary
                                  : 'transparent',
                                borderColor: isChecked ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {splitMethod === 'unequal' && (
                <View style={styles.unequalContainer}>
                  <View style={styles.validationBanner}>
                    <Text style={[styles.validationText, { color: colors.textSecondary }]}>
                      Total: {formatCurrency(exactTotal)} / {formatCurrency(numericAmount)}
                    </Text>
                    {Math.abs(exactTotal - numericAmount) < 0.05 ? (
                      <View style={[styles.validPill, { backgroundColor: colors.incomeLight }]}>
                        <Check size={12} color={colors.income} strokeWidth={2.5} />
                        <Text style={[styles.validPillText, { color: colors.incomeDark }]}>
                          Matches
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.validPill, { backgroundColor: colors.expenseLight }]}>
                        <AlertCircle size={12} color={colors.expense} strokeWidth={2.5} />
                        <Text style={[styles.validPillText, { color: colors.expenseDark }]}>
                          Diff: {formatCurrency(Math.abs(exactTotal - numericAmount))}
                        </Text>
                      </View>
                    )}
                  </View>

                  {members.map((m) => (
                    <View
                      key={m.userId}
                      style={[
                        styles.memberSplitRow,
                        { borderBottomColor: colors.borderLight },
                      ]}
                    >
                      <View style={styles.memberSplitLeft}>
                        <MemberAvatar name={m.userName} size={36} />
                        <Text style={[styles.memberSplitName, { color: colors.textPrimary }]}>
                          {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                        </Text>
                      </View>
                      <View style={styles.inputWrapper}>
                        <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
                          ₹
                        </Text>
                        <TextInput
                          style={[
                            styles.exactInput,
                            {
                              backgroundColor: colors.surfaceVariant,
                              color: colors.textPrimary,
                              borderColor: colors.border,
                            },
                          ]}
                          value={exactAmounts[m.userId] || ''}
                          onChangeText={(val) =>
                            setExactAmounts((prev) => ({ ...prev, [m.userId]: val }))
                          }
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {splitMethod === 'percentage' && (
                <View style={styles.percentageContainer}>
                  <View style={styles.validationBanner}>
                    <Text style={[styles.validationText, { color: colors.textSecondary }]}>
                      Total: {percentageTotal.toFixed(1)}% / 100%
                    </Text>
                    {Math.abs(percentageTotal - 100) < 0.1 ? (
                      <View style={[styles.validPill, { backgroundColor: colors.incomeLight }]}>
                        <Check size={12} color={colors.income} strokeWidth={2.5} />
                        <Text style={[styles.validPillText, { color: colors.incomeDark }]}>
                          100%
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.validPill, { backgroundColor: colors.expenseLight }]}>
                        <AlertCircle size={12} color={colors.expense} strokeWidth={2.5} />
                        <Text style={[styles.validPillText, { color: colors.expenseDark }]}>
                          {percentageTotal < 100 ? `Add ${(100 - percentageTotal).toFixed(1)}%` : `Over by ${(percentageTotal - 100).toFixed(1)}%`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {members.map((m) => {
                    const pct = parseFloat(percentages[m.userId] || '0');
                    const calculatedShare = (numericAmount * pct) / 100;
                    return (
                      <View
                        key={m.userId}
                        style={[
                          styles.memberSplitRow,
                          { borderBottomColor: colors.borderLight },
                        ]}
                      >
                        <View style={styles.memberSplitLeft}>
                          <MemberAvatar name={m.userName} size={36} />
                          <View>
                            <Text style={[styles.memberSplitName, { color: colors.textPrimary }]}>
                              {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                            </Text>
                            <Text style={[styles.calcShareText, { color: colors.textSecondary }]}>
                              {formatCurrency(calculatedShare)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={[
                              styles.pctInput,
                              {
                                backgroundColor: colors.surfaceVariant,
                                color: colors.textPrimary,
                                borderColor: colors.border,
                              },
                            ]}
                            value={percentages[m.userId] || ''}
                            onChangeText={(val) =>
                              setPercentages((prev) => ({ ...prev, [m.userId]: val }))
                            }
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                          />
                          <Text style={[styles.pctSuffix, { color: colors.textSecondary }]}>
                            %
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Prominent Save Button */}
          <View style={styles.saveSection}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                shadows.md,
              ]}
              onPress={handleAddExpense}
              disabled={isSubmitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save Expense"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  Save Expense {numericAmount > 0 ? `• ${formatCurrency(numericAmount)}` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 48,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  amountLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  descriptionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detectedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  detectedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  descriptionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  categoryIconWrapper: {
    marginRight: spacing.sm,
    marginLeft: 2,
  },
  descriptionInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    paddingRight: spacing.sm,
    fontSize: typography.sizes.base,
  },
  payerRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  payerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
  payerName: {
    fontSize: typography.sizes.sm,
  },
  splitTabsContainer: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    padding: 3,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  splitTabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  splitTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  splitTabText: {
    fontSize: typography.sizes.xs,
  },
  splitDetailsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.base,
  },
  equalContainer: {},
  equalHint: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  memberSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberSplitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  memberSplitName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  memberSplitRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberSplitAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unequalContainer: {},
  validationBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  validationText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  validPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.full,
  },
  validPillText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyPrefix: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  exactInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  percentageContainer: {},
  calcShareText: {
    fontSize: typography.sizes.xs - 1,
    marginTop: 1,
  },
  pctInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },
  pctSuffix: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  saveSection: {
    marginTop: spacing.md,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base,
    borderRadius: radii.xl,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
});

export default AddExpenseScreen;
