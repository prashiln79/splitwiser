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
import { useAppTheme } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { AmountInput } from '../components/common/AmountInput';
import { MemberAvatar } from '../components/common/MemberAvatar';
import {
  CATEGORIES_CONFIG,
  detectCategory,
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
      <View style={[styles.loaderContainer, { backgroundColor: '#F5F5F5' }]}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const payerMember = members.find((m) => m.userId === payerId);
  const payerDisplayName = payerMember
    ? payerMember.userId === user?.uid
      ? 'you'
      : payerMember.userName
    : 'you';

  const splitLabel =
    splitMethod === 'equal'
      ? 'equally'
      : splitMethod === 'unequal'
      ? 'by exact amounts'
      : 'by percentages';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Add expense"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={handleAddExpense}
            disabled={isSubmitting}
            style={styles.saveHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Save expense"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Check size={24} color="#059669" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        }
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
          {/* Description + Category Icon */}
          <View style={styles.descriptionRow}>
            <View style={styles.categoryIconBox}>
              <CategoryIcon
                category={detectedCategory}
                size={40}
              />
            </View>
            <TextInput
              style={styles.descriptionInput}
              placeholder="What was this for?"
              placeholderTextColor="#9E9E9E"
              value={description}
              onChangeText={setDescription}
              accessibilityLabel="Expense description"
            />
          </View>

          {/* Amount Hero */}
          <View style={styles.amountSection}>
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              autoFocus
            />
            <View style={styles.amountUnderline} />
          </View>

          {/* Paid by / Split by sentence */}
          <View style={styles.paidBySentence}>
            <Text style={styles.sentenceText}>Paid by </Text>
            <TouchableOpacity
              style={styles.sentenceChip}
              onPress={() => {
                // Cycle through payers
                const currentIdx = members.findIndex((m) => m.userId === payerId);
                const nextIdx = (currentIdx + 1) % members.length;
                setPayerId(members[nextIdx].userId);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
              }}
              activeOpacity={0.6}
            >
              <Text style={styles.sentenceChipText}>{payerDisplayName}</Text>
            </TouchableOpacity>
            <Text style={styles.sentenceText}> and split </Text>
            <TouchableOpacity
              style={styles.sentenceChip}
              onPress={() => {
                const methods: SplitType[] = ['equal', 'unequal', 'percentage'];
                const currentIdx = methods.indexOf(splitMethod);
                const nextIdx = (currentIdx + 1) % methods.length;
                setSplitMethod(methods[nextIdx]);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
              }}
              activeOpacity={0.6}
            >
              <Text style={styles.sentenceChipText}>{splitLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.sentenceText}>.</Text>
          </View>

          {/* Split Details */}
          <View style={styles.splitSection}>
            {splitMethod === 'equal' && (
              <View>
                <Text style={styles.splitHint}>
                  {formatCurrency(equalSharePerPerson)}/person
                </Text>
                {members.map((m) => {
                  const isChecked = !!selectedMembers[m.userId];
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      style={styles.memberRow}
                      onPress={() => {
                        setSelectedMembers((prev) => ({
                          ...prev,
                          [m.userId]: !prev[m.userId],
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberLeft}>
                        <MemberAvatar name={m.userName} size={36} />
                        <Text style={styles.memberName}>
                          {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                        </Text>
                      </View>

                      <View style={styles.memberRight}>
                        {isChecked && (
                          <Text style={styles.memberShareAmount}>
                            {formatCurrency(equalSharePerPerson)}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: isChecked ? '#059669' : 'transparent',
                              borderColor: isChecked ? '#059669' : '#D0D0D0',
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
              <View>
                <View style={styles.validationRow}>
                  <Text style={styles.validationText}>
                    {formatCurrency(exactTotal)} of {formatCurrency(numericAmount)}
                  </Text>
                  {Math.abs(exactTotal - numericAmount) < 0.05 ? (
                    <View style={[styles.validPill, { backgroundColor: '#F0FAF6' }]}>
                      <Check size={12} color="#059669" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#059669' }]}>
                        ✓
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.validPill, { backgroundColor: '#FEF2F2' }]}>
                      <AlertCircle size={12} color="#E74C3C" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#E74C3C' }]}>
                        {formatCurrency(Math.abs(exactTotal - numericAmount))} off
                      </Text>
                    </View>
                  )}
                </View>

                {members.map((m) => (
                  <View key={m.userId} style={styles.memberRow}>
                    <View style={styles.memberLeft}>
                      <MemberAvatar name={m.userName} size={36} />
                      <Text style={styles.memberName}>
                        {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                      </Text>
                    </View>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.exactInput}
                        value={exactAmounts[m.userId] || ''}
                        onChangeText={(val) =>
                          setExactAmounts((prev) => ({ ...prev, [m.userId]: val }))
                        }
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#CCCCCC"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {splitMethod === 'percentage' && (
              <View>
                <View style={styles.validationRow}>
                  <Text style={styles.validationText}>
                    {percentageTotal.toFixed(1)}% of 100%
                  </Text>
                  {Math.abs(percentageTotal - 100) < 0.1 ? (
                    <View style={[styles.validPill, { backgroundColor: '#F0FAF6' }]}>
                      <Check size={12} color="#059669" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#059669' }]}>
                        ✓
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.validPill, { backgroundColor: '#FEF2F2' }]}>
                      <AlertCircle size={12} color="#E74C3C" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#E74C3C' }]}>
                        {percentageTotal < 100
                          ? `${(100 - percentageTotal).toFixed(1)}% left`
                          : `${(percentageTotal - 100).toFixed(1)}% over`}
                      </Text>
                    </View>
                  )}
                </View>

                {members.map((m) => {
                  const pct = parseFloat(percentages[m.userId] || '0');
                  const calculatedShare = (numericAmount * pct) / 100;
                  return (
                    <View key={m.userId} style={styles.memberRow}>
                      <View style={styles.memberLeft}>
                        <MemberAvatar name={m.userName} size={36} />
                        <View>
                          <Text style={styles.memberName}>
                            {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                          </Text>
                          <Text style={styles.calcShareText}>
                            {formatCurrency(calculatedShare)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.pctInput}
                          value={percentages[m.userId] || ''}
                          onChangeText={(val) =>
                            setPercentages((prev) => ({ ...prev, [m.userId]: val }))
                          }
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#CCCCCC"
                        />
                        <Text style={styles.pctSuffix}>%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButton}
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
                Save Expense{numericAmount > 0 ? ` · ${formatCurrency(numericAmount)}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  // Description row
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  categoryIconBox: {
    marginRight: 12,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  // Amount
  amountSection: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  amountUnderline: {
    width: 160,
    height: 2,
    backgroundColor: '#059669',
    borderRadius: 1,
    marginTop: -4,
  },
  // Paid by sentence
  paidBySentence: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  sentenceText: {
    fontSize: 15,
    color: '#6B6B6B',
  },
  sentenceChip: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sentenceChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Split section
  splitSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  splitHint: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
    fontWeight: '500',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberShareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  validationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  validPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  validPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  exactInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    width: 80,
    textAlign: 'right',
  },
  calcShareText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 1,
  },
  pctInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    width: 56,
    textAlign: 'right',
  },
  pctSuffix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  // Save button
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#059669',
    marginHorizontal: 16,
    marginTop: 24,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddExpenseScreen;
