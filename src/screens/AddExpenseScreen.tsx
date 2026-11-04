import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Paragraph,
  Text,
  TextInput,
  Title,
} from 'react-native-paper';
import HapticButton from '../components/ui/HapticButton';
import HapticCheckboxItem from '../components/ui/HapticCheckbox';
import HapticMenu from '../components/ui/HapticMenu';
import HapticSegmentedButtons from '../components/ui/HapticSegmentedButtons';
import { getGroupMembers } from '../services/groups';
import { createExpense } from '../services/expenses';
import { useAuth } from '../context/AuthContext';
import { GroupMember, ExpenseSplit, SplitType } from '../types';

const AddExpenseScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitMethod, setSplitMethod] = useState<string>('equal');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

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
          initPercentages[m.userId] = (basePercentage + (index < remainder ? 1 : 0)).toString();
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

  const handleAddExpense = async () => {
    const currentSplitMethod = splitMethod as SplitType;
    if (!description || !amount) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (!payerId) {
      Alert.alert('Error', 'Please select who paid.');
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      let splits: ExpenseSplit[] = [];
      let splitType: SplitType = splitMethod as SplitType;

      if (splitMethod === 'equal') {
        const included = Object.keys(selectedMembers).filter((uid) => selectedMembers[uid]);
        if (included.length === 0) throw new Error('Select at least one member.');
        const splitAmount = Math.round((numericAmount / included.length) * 100) / 100;
        const totalSplit = splitAmount * included.length;
        const remainder = Math.round((numericAmount - totalSplit) * 100) / 100;
        splits = included.map((uid, i) => ({
          userId: uid,
          amount: i === 0 ? splitAmount + remainder : splitAmount,
          type: 'equal',
        }));
      } else if (splitMethod === 'exact') {
        const total = Object.values(exactAmounts).reduce(
          (sum, v) => sum + parseFloat(v || '0'),
          0
        );
        if (Math.abs(total - numericAmount) > 0.01) {
          throw new Error(`Exact amounts must add up to ${numericAmount.toFixed(2)}.`);
        }
        splits = Object.entries(exactAmounts)
          .filter(([, v]) => parseFloat(v || '0') > 0)
          .map(([uid, v]) => ({
            userId: uid,
            amount: Math.round(parseFloat(v) * 100) / 100,
            type: 'unequal' as SplitType,
          }));
        splitType = 'unequal';
      } else if (splitMethod === 'percentage') {
        const total = Object.values(percentages).reduce(
          (sum, v) => sum + parseFloat(v || '0'),
          0
        );
        if (Math.abs(total - 100) > 0.01) {
          throw new Error(`Percentages must add up to 100%. Current: ${total.toFixed(2)}%`);
        }
        splits = Object.entries(percentages)
          .filter(([, v]) => parseFloat(v || '0') > 0)
          .map(([uid, v]) => ({
            userId: uid,
            amount: Math.round(numericAmount * (parseFloat(v) / 100) * 100) / 100,
            type: 'percentage',
          }));
      } else if (splitMethod === 'shares') {
        const nonZero = Object.entries(shares).filter(
          ([, v]) => parseInt(v || '0', 10) > 0
        );
        const totalShares = nonZero.reduce((s, [, v]) => s + parseInt(v, 10), 0);
        if (totalShares === 0) throw new Error('Total shares cannot be zero.');

        const amounts = nonZero.map(([uid, v]) => ({
          userId: uid,
          amount: Math.round(numericAmount * (parseInt(v, 10) / totalShares) * 100) / 100,
          type: 'unequal' as SplitType,
        }));

        // Adjust for rounding error
        const totalCalc = amounts.reduce((s, x) => s + x.amount, 0);
        const diff = Math.round((numericAmount - totalCalc) * 100) / 100;
        if (Math.abs(diff) > 0 && amounts.length > 0) {
          amounts[0].amount = Math.round((amounts[0].amount + diff) * 100) / 100;
        }

        splits = amounts;
        splitType = 'unequal';
      }

      await createExpense(groupId, user!.uid, {
        description,
        amount: numericAmount,
        paidBy: payerId,
        splitType,
        splits,
      });

      Alert.alert('Success', 'Expense added!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSplitInputs = () => {
    switch (splitMethod) {
      case 'equal':
        return members.map((m) => (
          <HapticCheckboxItem
            key={m.userId}
            label={m.userName}
            status={selectedMembers[m.userId] ? 'checked' : 'unchecked'}
            onPress={() =>
              setSelectedMembers((prev) => ({ ...prev, [m.userId]: !prev[m.userId] }))
            }
            accessibilityLabel={`Select ${m.userName}`}
            accessibilityRole="checkbox"
          />
        ));
      case 'exact':
        return members.map((m) => (
          <TextInput
            key={m.userId}
            label={`${m.userName}'s exact amount`}
            value={exactAmounts[m.userId]}
            onChangeText={(text) =>
              setExactAmounts((prev) => ({ ...prev, [m.userId]: text }))
            }
            keyboardType="numeric"
            style={styles.splitInput}
          />
        ));
      case 'percentage':
        return members.map((m) => (
          <TextInput
            key={m.userId}
            label={`${m.userName}'s percentage`}
            value={percentages[m.userId]}
            onChangeText={(text) =>
              setPercentages((prev) => ({ ...prev, [m.userId]: text }))
            }
            keyboardType="numeric"
            style={styles.splitInput}
          />
        ));
      case 'shares':
        return members.map((m) => (
          <TextInput
            key={m.userId}
            label={`${m.userName}'s shares`}
            value={shares[m.userId]}
            onChangeText={(text) =>
              setShares((prev) => ({ ...prev, [m.userId]: text }))
            }
            keyboardType="numeric"
            style={styles.splitInput}
          />
        ));
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const selectedPayerName =
    payerId ? members.find((m) => m.userId === payerId)?.userName ?? 'Select Payer' : 'Select Payer';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
        <TextInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
          keyboardType="numeric"
        />

        <HapticMenu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <HapticButton onPress={() => setMenuVisible(true)}>
              Paid by: {selectedPayerName}
            </HapticButton>
          }
        >
          {members.map((m) => (
            <HapticMenu.Item
              key={m.userId}
              onPress={() => { setPayerId(m.userId); setMenuVisible(false); }}
              title={m.userName}
            />
          ))}
        </HapticMenu>

        <Title style={styles.splitTitle}>Split Method</Title>
        <HapticSegmentedButtons
          value={splitMethod}
          onValueChange={(v) => setSplitMethod(v as SplitType)}
          buttons={[
            { value: 'equal', label: 'Equally' },
            { value: 'exact', label: 'Exact' },
            { value: 'percentage', label: '%' },
            { value: 'shares', label: 'Shares' },
          ]}
          style={styles.input}
        />

        {splitMethod === 'exact' && amount && (
          <Paragraph style={styles.helperText}>
            Total: ₹
            {Object.values(exactAmounts)
              .reduce((s, v) => s + parseFloat(v || '0'), 0)
              .toFixed(2)}{' '}
            / ₹{amount}
          </Paragraph>
        )}
        {splitMethod === 'percentage' && (
          <Paragraph style={styles.helperText}>
            Total:{' '}
            {Object.values(percentages)
              .reduce((s, v) => s + parseFloat(v || '0'), 0)
              .toFixed(2)}%
          </Paragraph>
        )}

        <View style={styles.splitInputsContainer}>{renderSplitInputs()}</View>

        <HapticButton
          mode="contained"
          onPress={handleAddExpense}
          style={styles.button}
          loading={isSubmitting}
          disabled={isSubmitting}
          accessibilityLabel="Add Expense"
          accessibilityRole="button"
        >
          Add Expense
        </HapticButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { marginBottom: 16 },
  button: { marginTop: 24 },
  splitTitle: { marginTop: 16, marginBottom: 8 },
  splitInputsContainer: { marginTop: 8 },
  splitInput: { marginBottom: 8 },
  helperText: { fontSize: 12, marginBottom: 8, opacity: 0.7 },
});

export default AddExpenseScreen;
