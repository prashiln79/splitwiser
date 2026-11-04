import React, { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  ActivityIndicator,
  Paragraph,
  Title,
  useTheme,
} from 'react-native-paper';
import HapticCard from '../components/ui/HapticCard';
import HapticFAB from '../components/ui/HapticFAB';
import HapticIconButton from '../components/ui/HapticIconButton';
import * as Haptics from 'expo-haptics';
import { getGroupMembers } from '../services/groups';
import { subscribeToExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { Expense, GroupMember, OptimizedSettlement } from '../types';

const GroupDetailsScreen = ({ route, navigation }: any) => {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const theme = useTheme();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<OptimizedSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currency = '₹';

  useEffect(() => {
    navigation.setOptions({
      title: groupName,
      headerRight: () => (
        <HapticIconButton
          icon="cog"
          onPress={() => navigation.navigate('GroupSettings', { groupId })}
          accessibilityLabel="Group settings"
          accessibilityRole="button"
        />
      ),
    });
  }, [groupName, groupId]);

  // Load members once
  useEffect(() => {
    getGroupMembers(groupId)
      .then(setMembers)
      .catch((e) => console.error('[GroupDetails] members:', e));
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updatedMembers = await getGroupMembers(groupId);
      setMembers(updatedMembers);
      setSettlements(getOptimizedSettlements(expenses, updatedMembers));
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMemberName = (uid: string) =>
    members.find((m) => m.userId === uid)?.userName ?? 'Unknown';

  const renderExpense = ({ item }: { item: Expense }) => {
    if (!user) return null;
    const userSplit = item.splits.find((s) => s.userId === user.uid);
    const userShare = userSplit ? userSplit.amount : 0;
    const paidByMe = (item.paidBy || item.createdBy) === user.uid;
    const net = paidByMe ? item.amount - userShare : -userShare;

    let balanceText: string;
    let balanceColor = 'black';

    if (net > 0) {
      balanceText = `You are owed ${currency}${net.toFixed(2)}`;
      balanceColor = 'green';
    } else if (net < 0) {
      balanceText = `You borrowed ${currency}${Math.abs(net).toFixed(2)}`;
      balanceColor = 'red';
    } else {
      balanceText = 'You are settled for this expense.';
    }

    return (
      <HapticCard style={styles.card} accessibilityRole="button">
        <HapticCard.Content>
          <Title>{item.description}</Title>
          <Paragraph>Amount: {currency}{item.amount.toFixed(2)}</Paragraph>
          <Paragraph>Paid by: {getMemberName(item.paidBy || item.createdBy)}</Paragraph>
          <Paragraph style={{ color: balanceColor }}>{balanceText}</Paragraph>
        </HapticCard.Content>
      </HapticCard>
    );
  };

  const renderSettlementSummary = () => {
    if (!user) return null;
    const userOwes = settlements.filter((s) => s.fromUserId === user.uid);
    const userIsOwed = settlements.filter((s) => s.toUserId === user.uid);
    const totalOwed = userOwes.reduce((s, x) => s + x.amount, 0);
    const totalReceive = userIsOwed.reduce((s, x) => s + x.amount, 0);

    if (userOwes.length === 0 && userIsOwed.length === 0) {
      return (
        <View style={styles.settledContainer}>
          <Text style={styles.settledText}>✓ You are all settled up!</Text>
        </View>
      );
    }

    return (
      <View style={styles.settlementContainer}>
        {totalOwed > 0 && (
          <View style={styles.owedSection}>
            <Text style={styles.sectionTitle}>
              You need to pay:{' '}
              <Text style={styles.amountOwed}>{currency}{totalOwed.toFixed(2)}</Text>
            </Text>
            {userOwes.map((s, i) => (
              <View key={`owes-${i}`} style={styles.settlementItem}>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{s.toUserName}</Text>
                  <Text style={styles.settlementAmount}>{currency}{s.amount.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {totalReceive > 0 && (
          <View style={[styles.receiveSection, totalOwed > 0 && { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>
              You will receive:{' '}
              <Text style={styles.amountReceive}>{currency}{totalReceive.toFixed(2)}</Text>
            </Text>
            {userIsOwed.map((s, i) => (
              <View key={`receive-${i}`} style={styles.settlementItem}>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{s.fromUserName}</Text>
                  <Text style={styles.settlementAmount}>{currency}{s.amount.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const renderHeader = () => (
    <>
      <HapticCard style={styles.card}>
        <HapticCard.Content>
          <Title>Settlement Summary</Title>
          {renderSettlementSummary()}
        </HapticCard.Content>
      </HapticCard>
      <Title style={styles.expensesTitle}>Expenses</Title>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.contentContainer}
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No expenses recorded yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
      <HapticFAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('AddExpense', { groupId })}
        accessibilityLabel="Add expense"
        accessibilityRole="button"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flex: 1, padding: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 16 },
  expensesTitle: { marginTop: 16, marginBottom: 8, fontSize: 20, fontWeight: 'bold' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
  settlementContainer: { marginBottom: 8 },
  settledContainer: { alignItems: 'center', paddingVertical: 12 },
  settledText: { fontSize: 16, color: '#2e7d32', fontWeight: '500' },
  owedSection: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  receiveSection: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  amountOwed: { color: '#d32f2f', fontWeight: 'bold' },
  amountReceive: { color: '#2e7d32', fontWeight: 'bold' },
  settlementItem: { marginVertical: 4 },
  personInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  personName: { fontSize: 14, color: '#555', flex: 1 },
  settlementAmount: { fontSize: 14, fontWeight: '600', color: '#333' },
  emptyText: { fontSize: 14, color: '#666', paddingVertical: 8 },
});

export default GroupDetailsScreen;
