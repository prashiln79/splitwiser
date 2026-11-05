import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MemberAvatar } from './MemberAvatar';
import { Group } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface GroupCardProps {
  group: Group;
  netBalance?: number;
  isSettled?: boolean;
  onPress: () => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  netBalance = 0,
  isSettled = true,
  onPress,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const memberCount = group.memberIds?.length || 1;

  // Determine balance display
  let balanceText = 'settled up';
  let balanceColor = '#9E9E9E';

  if (!isSettled && Math.abs(netBalance) >= 0.01) {
    if (netBalance > 0) {
      balanceText = `you are owed ${formatCurrency(netBalance)}`;
      balanceColor = '#1CC88A';
    } else {
      balanceText = `you owe ${formatCurrency(Math.abs(netBalance))}`;
      balanceColor = '#E74C3C';
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && { backgroundColor: '#F5F5F5' },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Group ${group.name}. ${balanceText}`}
    >
      {/* Avatar */}
      <MemberAvatar
        name={group.name}
        imageUrl={group.imageUrl}
        size={44}
      />

      {/* Group info */}
      <View style={styles.infoContainer}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.balanceText} numberOfLines={1}>
          <Text style={{ color: balanceColor }}>{balanceText}</Text>
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '400',
  },
});
