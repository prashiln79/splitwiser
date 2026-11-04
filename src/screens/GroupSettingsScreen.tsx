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
  Copy,
  Camera,
  Trash2,
  LogOut,
  Shield,
  User,
  Users,
  Check,
  Edit2,
  X,
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
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { Group, GroupMember } from '../types';

const GroupSettingsScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow photo library access to change the group avatar.');
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
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <View style={styles.avatarEditRow}>
            <View style={styles.avatarContainer}>
              <MemberAvatar
                name={name || group?.name || 'Group'}
                imageUrl={pickedImage?.uri || group?.imageUrl}
                size={72}
              />
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.cameraBadge, { backgroundColor: colors.primary }]}
                  onPress={pickImage}
                  accessibilityRole="button"
                  accessibilityLabel="Change group photo"
                >
                  <Camera size={14} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.nameInputContainer}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Group Name
              </Text>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={name}
                onChangeText={setName}
                editable={isAdmin}
                placeholder="Group Name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.saveChangesBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveChangesBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Prominent Join Code Card (Fixes "Group code is not visible on groups") */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <View style={styles.joinCodeHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Group Join Code
            </Text>
            <StatusBadge variant="admin" label="Shareable" size="sm" />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Anyone with this 6-character code can join this group from their device.
          </Text>

          <View
            style={[
              styles.codeDisplayBox,
              { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
            ]}
          >
            <Text style={[styles.codeDisplayNumber, { color: colors.primaryDark }]}>
              {group?.joinCode || '------'}
            </Text>
          </View>

          <View style={styles.codeActionsRow}>
            <TouchableOpacity
              style={[
                styles.shareCodeButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={onShareInvite}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Share invite code"
            >
              <Share2 size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={styles.shareCodeButtonText}>Share Code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members Management */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <View style={styles.membersHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Members ({members.length})
            </Text>
          </View>

          <View style={styles.membersList}>
            {members.map((m) => {
              const isCurrentUser = m.userId === user?.uid;
              const isMemberAdmin = m.role === 'admin';

              return (
                <View
                  key={m.userId}
                  style={[
                    styles.memberRow,
                    { borderBottomColor: colors.borderLight },
                  ]}
                >
                  <View style={styles.memberLeft}>
                    <MemberAvatar name={m.userName} size={40} />
                    <View style={styles.memberMeta}>
                      <Text
                        style={[styles.memberName, { color: colors.textPrimary }]}
                      >
                        {m.userName} {isCurrentUser ? '(You)' : ''}
                      </Text>
                      <Text style={[styles.memberRoleText, { color: colors.textSecondary }]}>
                        {isMemberAdmin ? '★ Group Admin' : 'Member'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.memberRight}>
                    {isAdmin && !isCurrentUser && (
                      <TouchableOpacity
                        style={[styles.removeMemberBtn, { backgroundColor: colors.expenseLight }]}
                        onPress={() => setMemberToRemove(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.userName}`}
                      >
                        <Trash2 size={14} color={colors.expense} strokeWidth={2.2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Danger Zone */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <Text style={[styles.dangerTitle, { color: colors.expense }]}>
            Danger Zone
          </Text>

          <TouchableOpacity
            style={[styles.dangerButton, { borderColor: colors.expense + '40' }]}
            onPress={() => setConfirmLeaveVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <LogOut size={16} color={colors.expense} strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={[styles.dangerButtonText, { color: colors.expense }]}>
              Leave Group
            </Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.dangerButton,
                { borderColor: colors.expense + '40', marginTop: spacing.sm },
              ]}
              onPress={() => setConfirmDeleteVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Trash2 size={16} color={colors.expense} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={[styles.dangerButtonText, { color: colors.expense }]}>
                Delete Group Permanently
              </Text>
            </TouchableOpacity>
          )}
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
  card: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  avatarEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInputContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginBottom: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  saveChangesBtn: {
    marginTop: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  saveChangesBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  joinCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    marginBottom: spacing.md,
  },
  codeDisplayBox: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  codeDisplayNumber: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Courier',
    letterSpacing: 4,
  },
  codeActionsRow: {
    flexDirection: 'row',
  },
  shareCodeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  shareCodeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  membersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  membersList: {},
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  memberRoleText: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  memberRight: {},
  removeMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  dangerButtonText: {
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
});

export default GroupSettingsScreen;
