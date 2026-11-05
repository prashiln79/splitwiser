import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Share2,
  Camera,
  Trash2,
  LogOut,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { Group, GroupMember } from '../types';

const GroupSettingsScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64?: string | null } | null>(null);

  // Dialog states
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);

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
      setMembers(m);
    } catch {
      Alert.alert('Error', 'Failed to load group settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [groupId]);

  const onSave = async () => {
    if (!isAdmin) return;
    const updates: Partial<Group> = {};
    if (name.trim() && name.trim() !== group?.name) updates.name = name.trim();
    if (pickedImage?.base64) {
      updates.imageUrl = `data:image/jpeg;base64,${pickedImage.base64}`;
    }
    if (Object.keys(updates).length === 0) {
      Alert.alert('No Changes', 'There are no changes to save.');
      return;
    }
    try {
      setSaving(true);
      await updateGroup(groupId, updates);
      if (pickedImage) setPickedImage(null);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Updated', 'Group settings updated successfully.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update group.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (!isAdmin) return;
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access to change the group avatar.');
        return;
      }
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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const code = group?.joinCode;
    if (!code) return;
    try {
      await Share.share({
        message: `Join my "${group.name}" group on Splitwiser! Use code: ${code}`,
      });
    } catch {
      // Ignored
    }
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

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsDialogLoading(true);
    try {
      const settled = await checkSettledBeforeAction(memberToRemove.userId);
      if (!settled) {
        Alert.alert('Cannot Remove', 'This member has unsettled balances. Please settle first.');
        setMemberToRemove(null);
        return;
      }
      await removeMember(groupId, memberToRemove.userId);
      setMemberToRemove(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove member.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setIsDialogLoading(true);
    try {
      const settled = await checkSettledBeforeAction(user!.uid);
      if (!settled) {
        Alert.alert('Cannot Leave', 'Please settle your balances before leaving the group.');
        setConfirmLeaveVisible(false);
        return;
      }
      await leaveGroup(groupId, user!.uid);
      setConfirmLeaveVisible(false);
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to leave group.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    const others = members.filter((m) => m.userId !== user?.uid);
    if (others.length > 0) {
      Alert.alert('Cannot Delete', 'Please remove all other members before deleting this group.');
      setConfirmDeleteVisible(false);
      return;
    }
    setIsDialogLoading(true);
    try {
      await deleteGroupService(groupId);
      setConfirmDeleteVisible(false);
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete group.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Group Settings"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 48) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Edit Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GROUP DETAILS</Text>
          <View style={styles.boxContainer}>
            <View style={styles.avatarEditRow}>
              <View style={styles.avatarContainer}>
                <MemberAvatar
                  name={name || group?.name || 'Group'}
                  imageUrl={pickedImage?.uri || group?.imageUrl}
                  size={60}
                />
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.cameraBadge}
                    onPress={pickImage}
                    accessibilityRole="button"
                    accessibilityLabel="Change group photo"
                  >
                    <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.nameInputContainer}>
                <Text style={styles.fieldLabel}>Group Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  editable={isAdmin}
                  placeholder="Group Name"
                  placeholderTextColor="#9E9E9E"
                />
              </View>
            </View>

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.saveChangesBtn,
                  { backgroundColor: name.trim() ? '#059669' : '#E8E8E8' },
                ]}
                onPress={onSave}
                disabled={saving || !name.trim()}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.saveChangesBtnText, { color: name.trim() ? '#FFFFFF' : '#9E9E9E' }]}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Join Code */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>GROUP JOIN CODE</Text>
          <View style={styles.boxContainer}>
            <Text style={styles.cardDescription}>
              Share this 6-character code with friends so they can join this group.
            </Text>

            <View style={styles.codeDisplayBox}>
              <Text style={styles.codeDisplayNumber}>
                {group?.joinCode || '------'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.shareCodeButton}
              onPress={onShareInvite}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Share invite code"
            >
              <Share2 size={16} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.shareCodeButtonText}>Share Code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members Management */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MEMBERS ({members.length})</Text>
          <View style={styles.rowsContainer}>
            {members.map((m, index) => {
              const isCurrentUser = m.userId === user?.uid;
              const isMemberAdmin = m.role === 'admin';
              const isLast = index === members.length - 1;

              return (
                <View
                  key={m.userId}
                  style={[styles.memberRow, isLast && styles.lastRow]}
                >
                  <View style={styles.memberLeft}>
                    <MemberAvatar name={m.userName} size={40} />
                    <View style={styles.memberMeta}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.userName} {isCurrentUser ? '(You)' : ''}
                      </Text>
                      <Text style={styles.memberRoleText}>
                        {isMemberAdmin ? 'Group Admin' : 'Member'}
                      </Text>
                    </View>
                  </View>

                  {isAdmin && !isCurrentUser && (
                    <TouchableOpacity
                      style={styles.removeMemberBtn}
                      onPress={() => setMemberToRemove(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.userName}`}
                    >
                      <Trash2 size={16} color="#E74C3C" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DANGER ZONE</Text>
          <View style={styles.rowsContainer}>
            <TouchableOpacity
              style={[styles.dangerRow, !isAdmin && styles.lastRow]}
              onPress={() => setConfirmLeaveVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <LogOut size={18} color="#E74C3C" strokeWidth={2} style={{ marginRight: 10 }} />
              <Text style={styles.dangerRowText}>Leave Group</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.dangerRow, styles.lastRow]}
                onPress={() => setConfirmDeleteVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Trash2 size={18} color="#E74C3C" strokeWidth={2} style={{ marginRight: 10 }} />
                <Text style={styles.dangerRowText}>Delete Group</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        visible={confirmLeaveVisible}
        onDismiss={() => setConfirmLeaveVisible(false)}
        onConfirm={handleLeaveGroup}
        title="Leave Group?"
        message="Are you sure you want to leave this group? All your balances must be settled first."
        confirmLabel="Leave Group"
        isDestructive
        isLoading={isDialogLoading}
        icon="logout"
      />

      <ConfirmationDialog
        visible={confirmDeleteVisible}
        onDismiss={() => setConfirmDeleteVisible(false)}
        onConfirm={handleDeleteGroup}
        title="Delete Group?"
        message="This action cannot be undone. All expenses, balances, and history will be permanently deleted."
        confirmLabel="Delete Permanently"
        isDestructive
        isLoading={isDialogLoading}
        icon="trash"
      />

      <ConfirmationDialog
        visible={!!memberToRemove}
        onDismiss={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member?"
        message={`Are you sure you want to remove ${memberToRemove?.userName} from the group?`}
        confirmLabel="Remove"
        isDestructive
        isLoading={isDialogLoading}
        icon="trash"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  boxContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
    padding: 16,
  },
  avatarEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInputContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 4,
  },
  nameInput: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  saveChangesBtn: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveChangesBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
    marginBottom: 12,
  },
  codeDisplayBox: {
    backgroundColor: '#F0FAF6',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  codeDisplayNumber: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
    color: '#059669',
  },
  shareCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  shareCodeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rowsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  memberRoleText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  removeMemberBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  dangerRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E74C3C',
  },
});

export default GroupSettingsScreen;
