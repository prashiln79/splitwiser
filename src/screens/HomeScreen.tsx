import React, { useEffect, useState, useCallback } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import HapticButton from '../components/ui/HapticButton';
import HapticCard from '../components/ui/HapticCard';
import { HapticAppbarAction } from '../components/ui/HapticAppbar';
import * as Haptics from 'expo-haptics';
import {
  createGroup,
  subscribeToGroups,
  getGroupMembers,
} from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { Group, OptimizedSettlement } from '../types';

const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupSettlements, setGroupSettlements] = useState<
    Record<string, { netBalance: number; isSettled: boolean }>
  >({});

  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // ── Settlement status per group ───────────────────────────────────────────
  const refreshSettlements = useCallback(
    async (groupList: Group[]) => {
      if (!user) return;
      const results: Record<string, { netBalance: number; isSettled: boolean }> = {};

      await Promise.all(
        groupList.map(async (group) => {
          try {
            const [members, expenses] = await Promise.all([
              getGroupMembers(group.id),
              getGroupExpenses(group.id),
            ]);
            const settlements = getOptimizedSettlements(expenses, members);
            const myOwes = settlements
              .filter((s) => s.fromUserId === user.uid)
              .reduce((acc, s) => acc + s.amount, 0);
            const myOwed = settlements
              .filter((s) => s.toUserId === user.uid)
              .reduce((acc, s) => acc + s.amount, 0);
            const netBalance = myOwed - myOwes;
            results[group.id] = { netBalance, isSettled: netBalance === 0 };
          } catch {
            results[group.id] = { netBalance: 0, isSettled: true };
          }
        })
      );

      setGroupSettlements(results);
    },
    [user]
  );

  // ── Real-time subscription to groups ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const unsubscribe = subscribeToGroups(user.uid, (updatedGroups) => {
      setGroups(updatedGroups);
      setIsLoading(false);
      refreshSettlements(updatedGroups);
    });

    return unsubscribe;
  }, [user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshSettlements(groups);
    setIsRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      await createGroup(newGroupName.trim(), user.uid, user.name);
      setModalVisible(false);
      setNewGroupName('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const getSettlementText = (groupId: string) => {
    const status = groupSettlements[groupId];
    if (!status) return 'Calculating...';
    if (status.isSettled) return '✓ You are settled up.';
    if (status.netBalance > 0) return `You are owed ${formatCurrency(status.netBalance)}`;
    return `You owe ${formatCurrency(Math.abs(status.netBalance))}`;
  };

  const getStatusColor = (groupId: string) => {
    const status = groupSettlements[groupId];
    if (!status || status.isSettled) return '#4CAF50';
    return status.netBalance > 0 ? '#4CAF50' : '#F44336';
  };

  const renderGroup = ({ item }: { item: Group }) => {
    const isImage = item.imageUrl && /^(https?:|data:image)/.test(item.imageUrl);
    const groupIcon = item.imageUrl || item.name?.charAt(0) || '?';

    return (
      <HapticCard
        style={styles.card}
        onPress={() =>
          navigation.navigate('GroupDetails', {
            groupId: item.id,
            groupName: item.name,
            groupIcon,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Group ${item.name}. ${getSettlementText(item.id)}`}
      >
        <HapticCard.Title
          title={item.name}
          left={(props: any) =>
            isImage ? (
              <Avatar.Image {...props} source={{ uri: item.imageUrl! }} />
            ) : (
              <Avatar.Text {...props} label={item.name.charAt(0)} />
            )
          }
        />
        <HapticCard.Content>
          <Text style={[styles.settlementStatus, { color: getStatusColor(item.id) }]}>
            {getSettlementText(item.id)}
          </Text>
        </HapticCard.Content>
      </HapticCard>
    );
  };

  return (
    <View style={styles.container}>
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Create a New Group</Text>
          <TextInput
            label="Group Name"
            value={newGroupName}
            onChangeText={setNewGroupName}
            style={styles.input}
            accessibilityLabel="New group name"
          />
          <HapticButton
            mode="contained"
            onPress={handleCreateGroup}
            loading={isCreatingGroup}
            disabled={isCreatingGroup}
            accessibilityLabel="Create Group"
            accessibilityRole="button"
          >
            Create
          </HapticButton>
        </Modal>
      </Portal>

      <Appbar.Header>
        <Appbar.Content title="Your Groups" />
        <HapticAppbarAction
          icon="plus"
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Create new group"
          accessibilityRole="button"
        />
        <HapticAppbarAction
          icon="account-plus"
          onPress={() => navigation.navigate('JoinGroup')}
          accessibilityLabel="Join a group"
          accessibilityRole="button"
        />
      </Appbar.Header>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No groups yet. Create or join one!</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { marginBottom: 16 },
  settlementStatus: { fontWeight: '500', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 20 },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  input: { marginBottom: 20 },
});

export default HomeScreen;
