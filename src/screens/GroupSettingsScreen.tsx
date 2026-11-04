import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Card,
  Text,
  TextInput,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import HapticButton from '../components/ui/HapticButton';
import HapticIconButton from '../components/ui/HapticIconButton';
import { HapticListItem } from '../components/ui/HapticList';
import {
  getGroupById,
  getGroupMembers,
  updateGroup,
  deleteGroup as deleteGroupService,
  leaveGroup,
  removeMember,
} from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { getOptimizedSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { Group, GroupMember } from '../types';

const ICON_CHOICES = ['👥', '🏠', '🎉', '🧳', '🍽️', '🚗', '🏖️', '🎮', '💼'];

const GroupSettingsScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64?: string | null } | null>(null);

  const isAdmin = useMemo(() => {
    const me = members.find((m) => m.userId === user?.uid);
    return me?.role === 'admin';
  }, [members, user?.uid]);

  const load = async () => {
    try {
      setLoading(true);
      const [g, m] = await Promise.all([getGroupById(groupId), getGroupMembers(groupId)]);
      setGroup(g);
      setName(g?.name ?? '');
      setIcon(g?.imageUrl ?? g?.icon ?? '');
      setMembers(m);
    } catch (e) {
      Alert.alert('Error', 'Failed to load group settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId]);
  useLayoutEffect(() => { navigation.setOptions({ title: 'Group Settings' }); }, []);

  const onSave = async () => {
    if (!isAdmin) return;
    const updates: Partial<Group> = {};
    if (name && name !== group?.name) updates.name = name;
    if (pickedImage?.base64) {
      updates.imageUrl = `data:image/jpeg;base64,${pickedImage.base64}`;
    } else if (icon && icon !== (group?.imageUrl ?? group?.icon ?? '')) {
      updates.imageUrl = icon;
    }
    if (Object.keys(updates).length === 0) return Alert.alert('Nothing to update');
    try {
      setSaving(true);
      await updateGroup(groupId, updates);
      if (pickedImage) setPickedImage(null);
      Alert.alert('Updated', 'Group updated successfully.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (!isAdmin) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow media library access to select an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setPickedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const onShareInvite = async () => {
    const code = group?.joinCode;
    if (!code) return;
    await Share.share({ message: `Join my group on Splitwiser! Use code: ${code}` });
  };

  const checkSettledBeforeAction = async (targetUserId: string): Promise<boolean> => {
    try {
      const [expenses, mems] = await Promise.all([
        getGroupExpenses(groupId),
        getGroupMembers(groupId),
      ]);
      const settlements = getOptimizedSettlements(expenses, mems);
      const hasUnsettled = settlements.some(
        (s) => (s.fromUserId === targetUserId || s.toUserId === targetUserId) && s.amount > 0
      );
      return !hasUnsettled;
    } catch {
      return true;
    }
  };

  const onKick = (memberId: string, memberName: string) => {
    if (!isAdmin || memberId === user?.uid) return;
    Alert.alert('Remove member', `Remove ${memberName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const settled = await checkSettledBeforeAction(memberId);
          if (!settled) {
            Alert.alert('Cannot remove', 'This member has unsettled balances.');
            return;
          }
          try {
            await removeMember(groupId, memberId);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const onLeave = () => {
    Alert.alert('Leave group', 'You can leave only when balances are settled. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const settled = await checkSettledBeforeAction(user!.uid);
          if (!settled) {
            Alert.alert('Cannot leave', 'Please settle your balances first.');
            return;
          }
          try {
            await leaveGroup(groupId, user!.uid);
            navigation.popToTop();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const onDeleteGroup = () => {
    if (!isAdmin) return;
    const others = members.filter((m) => m.userId !== user?.uid);
    if (others.length > 0) {
      Alert.alert('Cannot delete', 'Remove all other members before deleting the group.');
      return;
    }
    Alert.alert('Delete group', 'This will permanently delete the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroupService(groupId);
            navigation.popToTop();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete group');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Group Info */}
        <Card style={styles.card}>
          <Card.Title title="Group Info" />
          <Card.Content>
            <TextInput
              label="Group Name"
              value={name}
              onChangeText={setName}
              editable={!!isAdmin}
              style={{ marginBottom: 12 }}
            />
            <Text style={{ marginBottom: 8 }}>Icon</Text>
            <View style={styles.iconRow}>
              {ICON_CHOICES.map((i) => (
                <HapticButton
                  key={i}
                  mode={icon === i ? 'contained' : 'outlined'}
                  style={styles.iconBtn}
                  onPress={() => setIcon(i)}
                  disabled={!isAdmin}
                >
                  {i}
                </HapticButton>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HapticButton
                mode="outlined"
                onPress={pickImage}
                disabled={!isAdmin}
                icon="image"
                style={{ marginRight: 12 }}
              >
                {pickedImage ? 'Change Image' : 'Upload Image'}
              </HapticButton>
              {pickedImage?.uri ? (
                <Image source={{ uri: pickedImage.uri }} style={styles.previewImg} />
              ) : group?.imageUrl && /^(https?:|data:image)/.test(group.imageUrl) ? (
                <Image source={{ uri: group.imageUrl }} style={styles.previewImg} />
              ) : group?.imageUrl ? (
                <Text style={{ fontSize: 32 }}>{group.imageUrl}</Text>
              ) : null}
            </View>
            {isAdmin && (
              <HapticButton
                mode="contained"
                style={{ marginTop: 12 }}
                loading={saving}
                disabled={saving}
                onPress={onSave}
              >
                Save Changes
              </HapticButton>
            )}
          </Card.Content>
        </Card>

        {/* Members */}
        <Card style={styles.card}>
          <Card.Title title="Members" />
          <Card.Content>
            {members.map((m) => (
              <HapticListItem
                key={m.userId}
                title={m.userName}
                description={m.role === 'admin' ? 'Admin' : undefined}
                left={() =>
                  m.imageUrl ? (
                    <Avatar.Image size={40} source={{ uri: m.imageUrl }} />
                  ) : (
                    <Avatar.Text size={40} label={(m.userName || '?').charAt(0)} />
                  )
                }
                right={() =>
                  isAdmin && m.userId !== user?.uid ? (
                    <HapticIconButton
                      icon="account-remove"
                      onPress={() => onKick(m.userId, m.userName)}
                      accessibilityLabel={`Remove ${m.userName}`}
                      accessibilityRole="button"
                    />
                  ) : null
                }
              />
            ))}
          </Card.Content>
        </Card>

        {/* Invite */}
        <Card style={styles.card}>
          <Card.Title title="Invite" />
          <Card.Content>
            <Text style={{ marginBottom: 8 }}>Join Code: {group?.joinCode}</Text>
            <HapticButton mode="outlined" onPress={onShareInvite} icon="share-variant">
              Share invite
            </HapticButton>
          </Card.Content>
        </Card>

        {/* Danger Zone */}
        <Card style={styles.card}>
          <Card.Title title="Danger Zone" />
          <Card.Content>
            <HapticButton
              mode="outlined"
              textColor="#d32f2f"
              onPress={onLeave}
              icon="logout-variant"
            >
              Leave Group
            </HapticButton>
            {isAdmin && (
              <HapticButton
                mode="contained"
                buttonColor="#d32f2f"
                onPress={onDeleteGroup}
                icon="delete"
                style={{ marginTop: 8 }}
              >
                Delete Group
              </HapticButton>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 16 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  iconBtn: { marginRight: 8, marginBottom: 8 },
  previewImg: { width: 48, height: 48, borderRadius: 24 },
});

export default GroupSettingsScreen;
