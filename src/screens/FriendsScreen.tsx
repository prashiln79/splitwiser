import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {
  Appbar,
  Avatar,
  Divider,
  List,
  Text,
  useTheme,
} from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import HapticIconButton from '../components/ui/HapticIconButton';
import { HapticListAccordion } from '../components/ui/HapticList';
import { subscribeToGroups, getGroupMembers } from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { computeFriendBalances } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { FriendBalance } from '../types';

const FriendsScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  const fetchData = async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      // Get all groups the user belongs to, then compute friend balances
      const { getGroups } = await import('../services/groups');
      const groups = await getGroups(user.uid);

      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const [members, expenses] = await Promise.all([
            getGroupMembers(group.id),
            getGroupExpenses(group.id),
          ]);
          return { groupId: group.id, groupName: group.name, expenses, members };
        })
      );

      setFriends(computeFriendBalances(groupsWithData, user.uid));
    } catch (error) {
      console.error('[FriendsScreen] fetch error:', error);
      Alert.alert('Error', 'Failed to load friends balance data.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused && user) fetchData();
  }, [isFocused, user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false);
    setIsRefreshing(false);
  };

  // Shimmer animation
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const SkeletonRow = () => (
    <View style={styles.skeletonRow}>
      <Animated.View style={[styles.skeletonAvatar, { opacity: opacityAnim }]} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Animated.View style={[styles.skeletonLine, { width: '60%', opacity: opacityAnim }]} />
        <Animated.View style={[styles.skeletonLineSmall, { width: '40%', opacity: opacityAnim }]} />
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: FriendBalance }) => {
    const balanceColor = item.netBalance < 0 ? 'red' : 'green';
    const balanceText =
      item.netBalance < 0
        ? `You owe ${formatCurrency(Math.abs(item.netBalance))}`
        : `Owes you ${formatCurrency(item.netBalance)}`;

    return (
      <HapticListAccordion
        title={item.userName}
        description={item.netBalance !== 0 ? balanceText : 'Settled up'}
        descriptionStyle={{ color: item.netBalance !== 0 ? balanceColor : 'gray' }}
        accessibilityRole="button"
        accessibilityLabel={`${item.userName}. ${item.netBalance !== 0 ? balanceText : 'Settled up'}`}
        left={(props: any) => (
          <Avatar.Text {...props} size={40} label={(item.userName || '?').charAt(0)} />
        )}
      >
        {item.groups.map((group) => {
          const gc = group.balance < 0 ? 'red' : 'green';
          const gt =
            group.balance < 0
              ? `You owe ${formatCurrency(Math.abs(group.balance))}`
              : `Owes you ${formatCurrency(group.balance)}`;
          return (
            <List.Item
              key={group.groupId}
              title={group.groupName}
              description={gt}
              descriptionStyle={{ color: gc }}
              left={(props) => (
                <Avatar.Text {...props} size={36} label={(group.groupName || '?').charAt(0)} />
              )}
            />
          );
        })}
      </HapticListAccordion>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.Content title="Friends" />
        </Appbar.Header>
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Friends" />
      </Appbar.Header>

      {showTooltip && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipContent}>
            <Text style={styles.tooltipText}>
              💡 These show your direct balance with each friend across all shared groups.
            </Text>
            <HapticIconButton
              icon="close"
              size={16}
              onPress={() => setShowTooltip(false)}
              accessibilityLabel="Close tooltip"
              accessibilityRole="button"
            />
          </View>
        </View>
      )}

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.userId}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={<Text style={styles.emptyText}>No balances with friends yet.</Text>}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyText: { textAlign: 'center', marginTop: 20 },
  tooltipContainer: { backgroundColor: '#f0f8ff', margin: 8, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#2196f3' },
  tooltipContent: { flexDirection: 'row', alignItems: 'flex-start', padding: 12 },
  tooltipText: { fontSize: 12, color: '#555', lineHeight: 16, flex: 1, paddingRight: 8 },
  skeletonContainer: { padding: 16 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0e0e0' },
  skeletonLine: { height: 14, backgroundColor: '#e0e0e0', borderRadius: 6, marginBottom: 6 },
  skeletonLineSmall: { height: 12, backgroundColor: '#e0e0e0', borderRadius: 6 },
});

export default FriendsScreen;
