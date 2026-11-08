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
  Modal,
  Image,
} from 'react-native';
import {
  Check,
  AlertCircle,
  Users,
  Calendar,
  Camera,
  FileText,
  X,
  ArrowLeft,
  Divide,
  Percent,
  Hash,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { getGroupMembers, getGroupById } from '../services/groups';
import { getLocalGroupById, getLocalGroupMembers } from '../repositories/groupRepository';
import { createExpenseLocal } from '../repositories/expenseRepository';
import { getDirectGroupId } from '../repositories/friendRepository';
import { useAuth } from '../context/AuthContext';
import { MemberAvatar } from '../components/common/MemberAvatar';
import {
  CATEGORIES_CONFIG,
  detectCategory,
  CategoryIcon,
  ExpenseCategory,
} from '../components/common/CategoryIcon';
import { GroupMember, ExpenseSplit, SplitType, Group } from '../types';
import { formatCurrency } from '../utils/currency';

const CURRENCIES = [
  { symbol: '₹', label: 'INR (₹)' },
  { symbol: '$', label: 'USD ($)' },
  { symbol: '€', label: 'EUR (€)' },
  { symbol: '£', label: 'GBP (£)' },
];

export const AddExpenseScreen = ({ route, navigation }: any) => {
  const { groupId: passedGroupId, friendId, friendName } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isDirectFriendExpense = Boolean(friendId && !passedGroupId);
  const groupId = passedGroupId || (friendId && user ? getDirectGroupId(user.uid, friendId) : '');

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [manualCategory, setManualCategory] = useState<ExpenseCategory | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split & Payer states
  const [splitMethod, setSplitMethod] = useState<SplitType>('equal');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

  // Additional details (date, receipt photo, notes)
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Contextual modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [payerModalVisible, setPayerModalVisible] = useState(false);
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  // Auto-detected category unless manually picked
  const detectedCategory = useMemo(() => detectCategory(description), [description]);
  const activeCategory: ExpenseCategory = manualCategory || detectedCategory || 'General';

  useEffect(() => {
    if (!user) return;

    const initMemberList = (memberList: GroupMember[]) => {
      const normalizedList = user?.uid && user?.name
        ? memberList.map((m) => (m.userId === user.uid ? { ...m, userName: user.name } : m))
        : memberList;
      setMembers(normalizedList);

      const numMembers = memberList.length;
      if (numMembers === 0) return;

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
    };

    if (isDirectFriendExpense) {
      const directMembers: GroupMember[] = [
        {
          userId: user.uid,
          userName: user.name || 'You',
          role: 'member',
          joinedAt: new Date(),
        },
        {
          userId: friendId,
          userName: friendName || 'Friend',
          role: 'member',
          joinedAt: new Date(),
        },
      ];
      initMemberList(directMembers);
      setIsLoading(false);
      return;
    }

    if (groupId) {
      getLocalGroupById(groupId).then((g) => {
        if (g) setGroup(g);
      });

      getLocalGroupMembers(groupId).then((localMembers) => {
        if (localMembers && localMembers.length > 0) {
          initMemberList(localMembers);
          setIsLoading(false);
        }
      });

      getGroupById(groupId).then((g) => {
        if (g) setGroup(g);
      }).catch(() => {});

      getGroupMembers(groupId)
        .then((memberList) => {
          initMemberList(memberList);
        })
        .catch((e) => {
          console.warn('[AddExpenseScreen] Remote members fetch skipped:', e.message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [groupId, user, isDirectFriendExpense, friendId, friendName]);

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

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handlePickReceipt = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Alert.alert(
      'Attach Receipt',
      'Receipts are saved locally on this device only and will not be uploaded to the cloud.',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is needed to take a receipt photo.');
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.8,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                setReceiptImage(res.assets[0].uri);
              }
            } catch {}
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                setReceiptImage(res.assets[0].uri);
              }
            } catch {}
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

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
            `Exact amounts sum to ${currency}${exactTotal.toFixed(2)}, but total is ${currency}${numericAmount.toFixed(2)}.`
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

      const tags: string[] = [activeCategory];
      if (notes.trim()) tags.push(`note:${notes.trim()}`);
      if (receiptImage) tags.push(`receipt:${receiptImage}`);

      await createExpenseLocal(groupId, user!.uid, {
        description: description.trim(),
        amount: numericAmount,
        paidBy: payerId,
        splitType: finalSplitType,
        splits,
        tags,
        createdAt: expenseDate,
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
      ? 'unequally'
      : 'by percentages';

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      expenseDate.getDate() === today.getDate() &&
      expenseDate.getMonth() === today.getMonth() &&
      expenseDate.getFullYear() === today.getFullYear()
    );
  }, [expenseDate]);

  const isYesterday = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      expenseDate.getDate() === yesterday.getDate() &&
      expenseDate.getMonth() === yesterday.getMonth() &&
      expenseDate.getFullYear() === yesterday.getFullYear()
    );
  }, [expenseDate]);

  const formattedDate = useMemo(() => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return expenseDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: expenseDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }, [isToday, isYesterday, expenseDate]);

  const openDateModal = () => {
    setCalendarViewDate(new Date(expenseDate));
    setDateModalVisible(true);
  };

  const goToPreviousMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calendarMonthTitle = useMemo(() => {
    return calendarViewDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarViewDate]);

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [calendarViewDate]);

  const handleSelectCalendarDay = (day: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const newDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day);
    setExpenseDate(newDate);
    setDateModalVisible(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Header: Back, Title, Save Checkmark */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color="#1A1A1A" strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Add expense</Text>

        <TouchableOpacity
          onPress={handleAddExpense}
          disabled={isSubmitting}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Save expense"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Check size={26} color="#059669" strokeWidth={2.6} />
          )}
        </TouchableOpacity>
      </View>

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
          {/* 2. Participants context: With you and: [Home budget] */}
          <View style={styles.groupContextRow}>
            <Text style={styles.withYouAndText}>With you and: </Text>
            <View style={styles.groupContextChip}>
              <Users size={14} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.groupContextChipText}>
                {isDirectFriendExpense
                  ? (friendName || 'Friend')
                  : `All of ${group?.name || 'Group'}`}
              </Text>
            </View>
          </View>

          {/* 3. Description Row with Category Icon Tile */}
          <View style={styles.formRow}>
            <TouchableOpacity
              style={styles.categoryTile}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setCategoryModalVisible(true);
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Category: ${activeCategory}. Tap to change.`}
              accessibilityRole="button"
            >
              <CategoryIcon category={activeCategory} size={36} />
            </TouchableOpacity>

            <View style={styles.descriptionInputWrapper}>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Enter a description"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                accessibilityLabel="Expense description"
              />
            </View>
          </View>

          {/* 4. Amount Hero Input with Currency Selector Box */}
          <View style={styles.formRow}>
            <TouchableOpacity
              style={styles.currencyBox}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setCurrencyModalVisible(true);
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Currency: ${currency}. Tap to change.`}
              accessibilityRole="button"
            >
              <Text style={styles.currencyBoxText}>{currency}</Text>
            </TouchableOpacity>

            <View style={styles.amountInputWrapper}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#D1D5DB"
                keyboardType="decimal-pad"
                accessibilityLabel="Expense amount"
              />
            </View>
          </View>

          {/* 5. Paid by [you] and split [equally] */}
          <View style={styles.paidByContainer}>
            <View style={styles.paidByRow}>
              <Text style={styles.paidByText}>Paid by </Text>

              <TouchableOpacity
                style={styles.pillButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setPayerModalVisible(true);
                }}
                activeOpacity={0.8}
                accessibilityLabel={`Paid by ${payerDisplayName}. Tap to select payer.`}
                accessibilityRole="button"
              >
                <Text style={styles.pillButtonText}>{payerDisplayName}</Text>
              </TouchableOpacity>

              <Text style={styles.paidByText}> and split </Text>

              <TouchableOpacity
                style={styles.pillButton}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setSplitModalVisible(true);
                }}
                activeOpacity={0.8}
                accessibilityLabel={`Split ${splitLabel}. Tap to change split method.`}
                accessibilityRole="button"
              >
                <Text style={styles.pillButtonText}>{splitLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* Quick inline equal-split summary (Splitwise verified) */}
            {splitMethod === 'equal' && numericAmount > 0 && (
              <Text style={styles.equalSummaryText}>
                ({currency}{equalSharePerPerson.toFixed(2)}/person)
              </Text>
            )}
          </View>

          {/* 6. Contextual Split Breakdown */}
          <View style={styles.splitBreakdownSection}>
            {/* Equal Split Member Checklist */}
            {splitMethod === 'equal' && (
              <View>
                {members.map((m) => {
                  const isChecked = !!selectedMembers[m.userId];
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      style={styles.memberCheckRow}
                      onPress={() => {
                        setSelectedMembers((prev) => ({
                          ...prev,
                          [m.userId]: !prev[m.userId],
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberCheckLeft}>
                        <MemberAvatar name={m.userName} size={36} />
                        <Text style={styles.memberName}>
                          {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                        </Text>
                      </View>

                      <View style={styles.memberCheckRight}>
                        {isChecked && numericAmount > 0 && (
                          <Text style={styles.memberShareAmount}>
                            {currency}{equalSharePerPerson.toFixed(2)}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: isChecked ? '#059669' : 'transparent',
                              borderColor: isChecked ? '#059669' : '#D1D5DB',
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

            {/* Unequal / Exact Split */}
            {splitMethod === 'unequal' && (
              <View>
                <View style={styles.validationRow}>
                  <Text style={styles.validationText}>
                    {currency}{exactTotal.toFixed(2)} of {currency}{numericAmount.toFixed(2)}
                  </Text>
                  {Math.abs(exactTotal - numericAmount) < 0.05 ? (
                    <View style={[styles.validPill, { backgroundColor: '#ECFDF5' }]}>
                      <Check size={12} color="#059669" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#059669' }]}>
                        Balanced
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.validPill, { backgroundColor: '#FEF2F2' }]}>
                      <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#E11D48' }]}>
                        {currency}{Math.abs(exactTotal - numericAmount).toFixed(2)} off
                      </Text>
                    </View>
                  )}
                </View>

                {members.map((m) => (
                  <View key={m.userId} style={styles.memberCheckRow}>
                    <View style={styles.memberCheckLeft}>
                      <MemberAvatar name={m.userName} size={36} />
                      <Text style={styles.memberName}>
                        {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                      </Text>
                    </View>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>{currency}</Text>
                      <TextInput
                        style={styles.exactInput}
                        value={exactAmounts[m.userId] || ''}
                        onChangeText={(val) =>
                          setExactAmounts((prev) => ({ ...prev, [m.userId]: val }))
                        }
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Percentage Split */}
            {splitMethod === 'percentage' && (
              <View>
                <View style={styles.validationRow}>
                  <Text style={styles.validationText}>
                    {percentageTotal.toFixed(1)}% of 100%
                  </Text>
                  {Math.abs(percentageTotal - 100) < 0.1 ? (
                    <View style={[styles.validPill, { backgroundColor: '#ECFDF5' }]}>
                      <Check size={12} color="#059669" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#059669' }]}>
                        100%
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.validPill, { backgroundColor: '#FEF2F2' }]}>
                      <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                      <Text style={[styles.validPillText, { color: '#E11D48' }]}>
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
                    <View key={m.userId} style={styles.memberCheckRow}>
                      <View style={styles.memberCheckLeft}>
                        <MemberAvatar name={m.userName} size={36} />
                        <View>
                          <Text style={styles.memberName}>
                            {m.userId === user?.uid ? `${m.userName} (You)` : m.userName}
                          </Text>
                          <Text style={styles.calcShareText}>
                            {currency}{calculatedShare.toFixed(2)}
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
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                        />
                        <Text style={styles.pctSuffix}>%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 7. Bottom Toolbar: Group Context, Date, Camera, Notes */}
          <View style={styles.bottomToolbar}>
            <View style={styles.toolbarLeft}>
              <Users size={16} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.toolbarGroupText} numberOfLines={1}>
                {isDirectFriendExpense ? (friendName || 'Friend') : (group?.name || 'Group')}
              </Text>
            </View>

            <View style={styles.toolbarRight}>
              {/* Date */}
              <TouchableOpacity
                style={[
                  styles.toolbarActionBtn,
                  !isToday && styles.toolbarActionBtnActive,
                ]}
                onPress={openDateModal}
                accessibilityLabel={`Date: ${formattedDate}`}
                accessibilityRole="button"
              >
                <Calendar
                  size={20}
                  color={!isToday ? '#059669' : '#6B7280'}
                  strokeWidth={2}
                />
              </TouchableOpacity>

              {/* Camera / Receipt */}
              <TouchableOpacity
                style={[
                  styles.toolbarActionBtn,
                  receiptImage && styles.toolbarActionBtnActive,
                ]}
                onPress={handlePickReceipt}
                accessibilityLabel="Attach receipt"
                accessibilityRole="button"
              >
                <Camera
                  size={20}
                  color={receiptImage ? '#059669' : '#6B7280'}
                  strokeWidth={2}
                />
              </TouchableOpacity>

              {/* Notes */}
              <TouchableOpacity
                style={[
                  styles.toolbarActionBtn,
                  notes.trim().length > 0 && styles.toolbarActionBtnActive,
                ]}
                onPress={() => {
                  setTempNotes(notes);
                  setNotesModalVisible(true);
                }}
                accessibilityLabel="Add note"
                accessibilityRole="button"
              >
                <FileText
                  size={20}
                  color={notes.trim().length > 0 ? '#059669' : '#6B7280'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Attachments & Metadata Preview (Date, Receipt Image or Notes) */}
          {(!isToday || receiptImage || notes.trim().length > 0) && (
            <View style={styles.attachmentPreviewRow}>
              {!isToday && (
                <View style={styles.attachmentBadge}>
                  <Calendar size={13} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.attachmentBadgeText}>{formattedDate}</Text>
                  <TouchableOpacity
                    onPress={() => setExpenseDate(new Date())}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Reset to Today"
                  >
                    <X size={14} color="#6B7280" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}
              {receiptImage && (
                <View style={styles.attachmentBadge}>
                  <Camera size={13} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.attachmentBadgeText}>Receipt attached (local only)</Text>
                  <TouchableOpacity
                    onPress={() => setReceiptImage(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#6B7280" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}
              {notes.trim().length > 0 && (
                <View style={styles.attachmentBadge}>
                  <FileText size={13} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                    {notes}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setNotes('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#6B7280" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* 8. Full-Width Save CTA Button */}
          <TouchableOpacity
            style={styles.saveCtaBtn}
            onPress={handleAddExpense}
            disabled={isSubmitting}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Save Expense"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveCtaBtnText}>
                Save expense{numericAmount > 0 ? ` · ${currency}${numericAmount.toFixed(2)}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Contextual Modal 1: Category Selector ───────────────────────────── */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View style={styles.categoryDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Choose a category</Text>
              <TouchableOpacity
                onPress={() => setCategoryModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.categoryGrid}>
                {Object.keys(CATEGORIES_CONFIG).map((catKey) => {
                  const cfg = CATEGORIES_CONFIG[catKey];
                  const isSelected = activeCategory === catKey;
                  return (
                    <TouchableOpacity
                      key={catKey}
                      style={[
                        styles.categoryItem,
                        isSelected && styles.categoryItemSelected,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setManualCategory(catKey as ExpenseCategory);
                        setCategoryModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.categoryItemIconWrap,
                          { backgroundColor: cfg.bgColor },
                        ]}
                      >
                        <CategoryIcon category={catKey as ExpenseCategory} size={28} />
                      </View>
                      <Text
                        style={[
                          styles.categoryItemLabel,
                          isSelected && styles.categoryItemLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Contextual Modal 2: Payer Selector ──────────────────────────────── */}
      <Modal
        visible={payerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPayerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPayerModalVisible(false)}
        >
          <View style={styles.selectionDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Who paid?</Text>
              <TouchableOpacity
                onPress={() => setPayerModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {members.map((m) => {
                const isSelected = m.userId === payerId;
                const isMe = m.userId === user?.uid;
                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={[
                      styles.selectionOptionRow,
                      isSelected && styles.selectionOptionRowSelected,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      setPayerId(m.userId);
                      setPayerModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.selectionOptionLeft}>
                      <MemberAvatar name={m.userName} size={36} />
                      <Text
                        style={[
                          styles.selectionOptionText,
                          isSelected && styles.selectionOptionTextSelected,
                        ]}
                      >
                        {isMe ? `${m.userName} (You)` : m.userName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Check size={20} color="#059669" strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Contextual Modal 3: Split Method Selector ──────────────────────── */}
      <Modal
        visible={splitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSplitModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSplitModalVisible(false)}
        >
          <View style={styles.selectionDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Choose split options</Text>
              <TouchableOpacity
                onPress={() => setSplitModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Split Equally */}
            <TouchableOpacity
              style={[
                styles.splitMethodOption,
                splitMethod === 'equal' && styles.splitMethodOptionSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setSplitMethod('equal');
                setSplitModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.splitMethodIconCircle}>
                <Divide size={20} color="#059669" strokeWidth={2.2} />
              </View>
              <View style={styles.splitMethodTextCol}>
                <Text style={styles.splitMethodTitle}>Split equally</Text>
                <Text style={styles.splitMethodSub}>
                  Split evenly between all or selected members
                </Text>
              </View>
              {splitMethod === 'equal' && (
                <Check size={20} color="#059669" strokeWidth={2.5} />
              )}
            </TouchableOpacity>

            {/* Split by Exact Amounts */}
            <TouchableOpacity
              style={[
                styles.splitMethodOption,
                splitMethod === 'unequal' && styles.splitMethodOptionSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setSplitMethod('unequal');
                setSplitModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.splitMethodIconCircle}>
                <Hash size={20} color="#059669" strokeWidth={2.2} />
              </View>
              <View style={styles.splitMethodTextCol}>
                <Text style={styles.splitMethodTitle}>Split by exact amounts</Text>
                <Text style={styles.splitMethodSub}>
                  Specify the exact dollar or rupee amount each person owes
                </Text>
              </View>
              {splitMethod === 'unequal' && (
                <Check size={20} color="#059669" strokeWidth={2.5} />
              )}
            </TouchableOpacity>

            {/* Split by Percentages */}
            <TouchableOpacity
              style={[
                styles.splitMethodOption,
                splitMethod === 'percentage' && styles.splitMethodOptionSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setSplitMethod('percentage');
                setSplitModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.splitMethodIconCircle}>
                <Percent size={20} color="#059669" strokeWidth={2.2} />
              </View>
              <View style={styles.splitMethodTextCol}>
                <Text style={styles.splitMethodTitle}>Split by percentages</Text>
                <Text style={styles.splitMethodSub}>
                  Enter the percentage of the total each person owes
                </Text>
              </View>
              {splitMethod === 'percentage' && (
                <Check size={20} color="#059669" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Contextual Modal 4: Currency Picker ────────────────────────────── */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.selectionDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select currency</Text>
              <TouchableOpacity
                onPress={() => setCurrencyModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.symbol}
                style={[
                  styles.selectionOptionRow,
                  currency === c.symbol && styles.selectionOptionRowSelected,
                ]}
                onPress={() => {
                  setCurrency(c.symbol);
                  setCurrencyModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.selectionOptionText}>{c.label}</Text>
                {currency === c.symbol && (
                  <Check size={20} color="#059669" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Contextual Modal 5: Date Picker ────────────────────────────────── */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setDateModalVisible(false)}
          />
          <View style={styles.selectionDialog}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color="#059669" />
                <Text style={styles.modalTitle}>Expense date</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDateModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close date modal"
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Quick Option 1: Today */}
            <TouchableOpacity
              style={[
                styles.selectionOptionRow,
                isToday && styles.selectionOptionRowSelected,
              ]}
              onPress={() => {
                setExpenseDate(new Date());
                setDateModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.selectionOptionText, isToday && { fontWeight: '700', color: '#059669' }]}>
                  Today
                </Text>
                <Text style={styles.dateSubtext}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              {isToday && <Check size={18} color="#059669" strokeWidth={2.5} />}
            </TouchableOpacity>

            {/* Quick Option 2: Yesterday */}
            <TouchableOpacity
              style={[
                styles.selectionOptionRow,
                isYesterday && styles.selectionOptionRowSelected,
              ]}
              onPress={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setExpenseDate(y);
                setDateModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.selectionOptionText, isYesterday && { fontWeight: '700', color: '#059669' }]}>
                  Yesterday
                </Text>
                <Text style={styles.dateSubtext}>
                  {(() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    return y.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  })()}
                </Text>
              </View>
              {isYesterday && <Check size={18} color="#059669" strokeWidth={2.5} />}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dateDividerRow}>
              <View style={styles.dateDividerLine} />
              <Text style={styles.dateDividerText}>OR CHOOSE FROM CALENDAR</Text>
              <View style={styles.dateDividerLine} />
            </View>

            {/* Interactive Calendar */}
            <View style={styles.calendarContainer}>
              {/* Calendar Month & Navigation */}
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={goToPreviousMonth}
                  accessibilityLabel="Previous month"
                >
                  <ChevronLeft size={18} color="#374151" />
                </TouchableOpacity>

                <Text style={styles.calendarMonthText}>{calendarMonthTitle}</Text>

                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={goToNextMonth}
                  accessibilityLabel="Next month"
                >
                  <ChevronRight size={18} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Weekday Labels (S M T W T F S) */}
              <View style={styles.weekDaysRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                  <Text key={idx} style={styles.weekDayText}>
                    {w}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const isSelected =
                    expenseDate.getDate() === dayNum &&
                    expenseDate.getMonth() === calendarViewDate.getMonth() &&
                    expenseDate.getFullYear() === calendarViewDate.getFullYear();

                  const isTodayCell =
                    new Date().getDate() === dayNum &&
                    new Date().getMonth() === calendarViewDate.getMonth() &&
                    new Date().getFullYear() === calendarViewDate.getFullYear();

                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      style={styles.dayCell}
                      onPress={() => handleSelectCalendarDay(dayNum)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Day ${dayNum}`}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.dayCellInner,
                          isSelected && styles.dayCellSelected,
                          isTodayCell && !isSelected && styles.dayCellToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            isTodayCell && !isSelected && styles.dayTextToday,
                          ]}
                        >
                          {dayNum}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Contextual Modal 6: Notes ──────────────────────────────────────── */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setNotesModalVisible(false)}
        >
          <View style={styles.selectionDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add a note</Text>
              <TouchableOpacity
                onPress={() => setNotesModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.notesTextInput}
              placeholder="Add optional notes, details, or bill reference..."
              placeholderTextColor="#9CA3AF"
              value={tempNotes}
              onChangeText={setTempNotes}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <TouchableOpacity
              style={styles.notesSaveBtn}
              onPress={() => {
                setNotes(tempNotes.trim());
                setNotesModalVisible(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.notesSaveBtnText}>Save note</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    backgroundColor: '#FFFFFF',
  },
  // 1. Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  // 2. Participants context row
  groupContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  withYouAndText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  groupContextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupContextChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  // 3 & 4. Form rows (Category + Description, Currency + Amount)
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  categoryTile: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  descriptionInputWrapper: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    paddingBottom: 4,
  },
  descriptionInput: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 4,
  },
  currencyBox: {
    width: 48,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  currencyBoxText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  amountInputWrapper: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    paddingBottom: 2,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 0,
    letterSpacing: -0.5,
  },
  // 5. Paid by [you] and split [equally]
  paidByContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  paidByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  paidByText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  pillButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  pillButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  equalSummaryText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 6,
  },
  // 6. Split breakdown section
  splitBreakdownSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  memberCheckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  memberCheckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberCheckRight: {
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
    color: '#6B7280',
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
    color: '#6B7280',
  },
  exactInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    width: 80,
    textAlign: 'right',
  },
  calcShareText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  pctInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    width: 56,
    textAlign: 'right',
  },
  pctSuffix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  // 7. Bottom Toolbar (Splitwise Style)
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  toolbarGroupText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toolbarActionBtnActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  attachmentPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attachmentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    maxWidth: 200,
  },
  // 8. Save CTA Button
  saveCtaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#059669',
    marginHorizontal: 20,
    marginTop: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  selectionDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  categoryItemSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  categoryItemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  categoryItemLabelSelected: {
    color: '#059669',
    fontWeight: '700',
  },
  selectionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  selectionOptionRowSelected: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
  },
  selectionOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectionOptionTextSelected: {
    color: '#059669',
  },
  splitMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  splitMethodOptionSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  splitMethodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  splitMethodTextCol: {
    flex: 1,
    marginRight: 8,
  },
  splitMethodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  splitMethodSub: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  notesTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  notesSaveBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dateDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  dateDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  calendarContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#059669',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  dayText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#059669',
    fontWeight: '700',
  },
});

export default AddExpenseScreen;
