import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Switch,
} from 'react-native';
import {
  Share2,
  Camera,
  Trash2,
  LogOut,
  ImageIcon,
  Users,
  UserPlus,
  Shuffle,
  Coins,
  Bell,
  Clock,
  FileSpreadsheet,
  History,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Shield,
  Edit3,
  Sliders,
  Check,
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
  addMemberDirect,
  transferOwnership,
  archiveGroup,
  unarchiveGroup,
} from '../services/groups';
import { getGroupExpenses } from '../services/expenses';
import { getGroupSettlements } from '../services/settlements';
import { getGroupExpensesLocal } from '../repositories/expenseRepository';
import { getLocalGroupById, getLocalGroupMembers } from '../repositories/groupRepository';
import { getGroupSettlementsLocal } from '../repositories/settlementRepository';
import { networkMonitor } from '../sync/networkMonitor';
import { getOptimizedSettlements, calculateGroupSettlements } from '../utils/balanceCalculator';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { TypedConfirmDialog } from '../components/common/TypedConfirmDialog';
import { GroupCoverPhotoModal } from '../components/common/GroupCoverPhotoModal';
import { getDefaultCoverPhoto } from '../constants/presetCovers';
import { formatCurrency } from '../utils/currency';
import { logGroupActivity } from '../services/activityService';
import {
  getGroupUserPreferences,
  updateGroupUserPreferences,
} from '../services/groupPreferencesService';
import { AppUser, Group, GroupMember, GroupSettings, GroupType, Expense, Settlement, OptimizedSettlement } from '../types';

// Modular Settings Modals
import { EditGroupInfoModal, GROUP_TYPES } from '../components/groupSettings/EditGroupInfoModal';
import { AddMembersModal } from '../components/groupSettings/AddMembersModal';
import { GroupMembersModal } from '../components/groupSettings/GroupMembersModal';
import { MemberDetailsModal } from '../components/groupSettings/MemberDetailsModal';
import { CurrencySelectorModal } from '../components/groupSettings/CurrencySelectorModal';
import { GroupNotificationsModal } from '../components/groupSettings/GroupNotificationsModal';
import { BalanceRemindersModal } from '../components/groupSettings/BalanceRemindersModal';
import { GroupExportModal } from '../components/groupSettings/GroupExportModal';
import { RecentActivityModal } from '../components/groupSettings/RecentActivityModal';

const GroupSettingsScreen = ({ route, navigation }: any) => {
  const { groupId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recordedSettlements, setRecordedSettlements] = useState<Settlement[]>([]);
  const [settlements, setSettlements] = useState<OptimizedSettlement[]>([]);
  const [hideUninvolved, setHideUninvolved] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Modals Visibility
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [editInfoVisible, setEditInfoVisible] = useState(false);
  const [addMembersVisible, setAddMembersVisible] = useState(false);
  const [membersListVisible, setMembersListVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [remindersVisible, setRemindersVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [activityVisible, setActivityVisible] = useState(false);

  // Destructive confirmation dialogs
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false);
  const [confirmArchiveVisible, setConfirmArchiveVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);

  const isAdmin = useMemo(() => {
    const me = members.find((m) => m.userId === user?.uid);
    return me?.role === 'admin';
  }, [members, user?.uid]);

  const loadData = useCallback(async () => {
    try {
      // 1. Instant local read
      const [localG, localM, localE, localS] = await Promise.all([
        getLocalGroupById(groupId),
        getLocalGroupMembers(groupId),
        getGroupExpensesLocal(groupId),
        getGroupSettlementsLocal(groupId),
      ]);

      if (localG) setGroup(localG);
      if (localM && localM.length > 0) {
        const normalized = user?.uid && user?.name
          ? localM.map((item) => (item.userId === user.uid ? { ...item, userName: user.name } : item))
          : localM;
        setMembers(normalized);
      }
      if (localE) setExpenses(localE);
      if (localS) setRecordedSettlements(localS);

      const calculated = calculateGroupSettlements(
        localE || [],
        localM || [],
        localS || [],
        localG?.settings?.simplifyDebts ?? true
      );
      setSettlements(calculated);

      if (user?.uid) {
        getGroupUserPreferences(groupId, user.uid).then((prefs) => {
          setHideUninvolved(prefs.hideUninvolvedExpenses);
          setIsMuted(prefs.muted);
        });
      }

      setLoading(false);

      // 2. Fresh remote read if online
      if (networkMonitor.isCurrentlyOnline()) {
        const [g, m, e, s] = await Promise.all([
          getGroupById(groupId).catch(() => null),
          getGroupMembers(groupId).catch(() => []),
          getGroupExpenses(groupId).catch(() => []),
          getGroupSettlements(groupId).catch(() => []),
        ]);

        if (g) setGroup(g);
        if (m.length > 0) {
          const normalized = user?.uid && user?.name
            ? m.map((item) => (item.userId === user.uid ? { ...item, userName: user.name } : item))
            : m;
          setMembers(normalized);
        }
        if (e.length > 0) setExpenses(e);
        if (s.length > 0) setRecordedSettlements(s);

        const remoteCalculated = calculateGroupSettlements(
          e,
          m,
          s,
          g?.settings?.simplifyDebts ?? true
        );
        setSettlements(remoteCalculated);
      }
    } catch (e) {
      console.warn('[GroupSettingsScreen] load error:', e);
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if target user has unsettled debts
  const checkMemberHasUnsettled = (targetUserId: string): boolean => {
    return settlements.some(
      (s) => (s.fromUserId === targetUserId || s.toUserId === targetUserId) && s.amount > 0.01
    );
  };

  // Avatar picker
  const pickAvatar = async () => {
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
      const base64Url = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateGroup(groupId, { imageUrl: base64Url });
      await logGroupActivity(
        groupId,
        { id: user?.uid || '', name: user?.name || 'Admin' },
        'avatar_updated',
        `${user?.name || 'Admin'} updated the group avatar`
      );
      await loadData();
    }
  };

  // Share group code
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

  // Save info updates (Name, Type, Description)
  const handleSaveInfo = async (updates: { name: string; type: GroupType; description: string }) => {
    await updateGroup(groupId, updates);
    await logGroupActivity(
      groupId,
      { id: user?.uid || '', name: user?.name || 'Admin' },
      'info_updated',
      `${user?.name || 'Admin'} updated group details: "${updates.name}"`
    );
    await loadData();
  };

  // Add members
  const handleAddMembers = async (usersToAdd: AppUser[]) => {
    for (const u of usersToAdd) {
      await addMemberDirect(groupId, {
        uid: u.uid,
        name: u.name,
        email: u.email,
        photoUrl: u.photoURL || u.imageUrl,
      });
      await logGroupActivity(
        groupId,
        { id: user?.uid || '', name: user?.name || 'Admin' },
        'member_added',
        `${user?.name || 'Admin'} added ${u.name} to the group`
      );
    }
    await loadData();
  };

  // Remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    if (checkMemberHasUnsettled(memberToRemove.userId)) {
      Alert.alert(
        'Outstanding Balances Exist',
        `${memberToRemove.userName} has unsettled balances in this group. Please settle all balances before removing them.`
      );
      setMemberToRemove(null);
      return;
    }

    setIsDialogLoading(true);
    try {
      await removeMember(groupId, memberToRemove.userId);
      await logGroupActivity(
        groupId,
        { id: user?.uid || '', name: user?.name || 'Admin' },
        'member_removed',
        `${user?.name || 'Admin'} removed ${memberToRemove.userName} from the group`
      );
      setMemberToRemove(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove member.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  // Transfer Admin role
  const handleTransferAdmin = async (targetMember: GroupMember) => {
    Alert.alert(
      'Transfer Admin Role?',
      `Are you sure you want to promote ${targetMember.userName} to Group Admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote to Admin',
          style: 'default',
          onPress: async () => {
            try {
              await transferOwnership(groupId, user?.uid || '', targetMember.userId);
              await logGroupActivity(
                groupId,
                { id: user?.uid || '', name: user?.name || 'Admin' },
                'ownership_transferred',
                `${user?.name || 'Admin'} promoted ${targetMember.userName} to Group Admin`
              );
              await loadData();
              Alert.alert('Role Updated', `${targetMember.userName} is now a Group Admin.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update admin role.');
            }
          },
        },
      ]
    );
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (checkMemberHasUnsettled(user!.uid)) {
      Alert.alert(
        'Outstanding Balance',
        'You have an unsettled balance in this group. Please settle your balances before leaving.'
      );
      setConfirmLeaveVisible(false);
      return;
    }

    setIsDialogLoading(true);
    try {
      const others = members.filter((m) => m.userId !== user?.uid);
      if (others.length === 0) {
        await deleteGroupService(groupId);
      } else {
        await leaveGroup(groupId, user!.uid);
        await logGroupActivity(
          groupId,
          { id: user?.uid || '', name: user?.name || 'Member' },
          'member_left',
          `${user?.name || 'Member'} left the group`
        );
      }

      setConfirmLeaveVisible(false);
      navigation.popToTop();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to leave group.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  // Archive / Unarchive group
  const handleToggleArchive = async () => {
    const isCurrentlyArchived = group?.isArchived || group?.status === 'archived';
    setIsDialogLoading(true);
    try {
      if (isCurrentlyArchived) {
        await unarchiveGroup(groupId);
        await logGroupActivity(
          groupId,
          { id: user?.uid || '', name: user?.name || 'Admin' },
          'group_unarchived',
          `${user?.name || 'Admin'} unarchived this group`
        );
      } else {
        await archiveGroup(groupId);
        await logGroupActivity(
          groupId,
          { id: user?.uid || '', name: user?.name || 'Admin' },
          'group_archived',
          `${user?.name || 'Admin'} archived this group`
        );
      }
      setConfirmArchiveVisible(false);
      await loadData();
      Alert.alert(
        isCurrentlyArchived ? 'Group Unarchived' : 'Group Archived',
        isCurrentlyArchived
          ? 'This group is now active again in your groups list.'
          : 'This group has been archived. You can unarchive it at any time.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to archive/unarchive group.');
    } finally {
      setIsDialogLoading(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    const hasAnyUnsettled = settlements.some((s) => s.amount > 0.01);
    if (hasAnyUnsettled) {
      Alert.alert(
        'Cannot Delete Group',
        'There are unsettled balances between group members. Settle all balances before deleting the group.'
      );
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

  // Update Group Settings (Simplify Debts, Split Types, Permissions)
  const handleUpdateGroupSettings = async (newSettings: GroupSettings) => {
    await updateGroup(groupId, { settings: newSettings });
    await logGroupActivity(
      groupId,
      { id: user?.uid || '', name: user?.name || 'Admin' },
      'settings_updated',
      `${user?.name || 'Admin'} updated group expense preferences`
    );
    await loadData();
  };

  // Update Hide Uninvolved
  const handleUpdateHideUninvolved = async (val: boolean) => {
    if (!user?.uid) return;
    setHideUninvolved(val);
    await updateGroupUserPreferences(groupId, user.uid, { hideUninvolvedExpenses: val });
  };

  // Update Currency
  const handleSelectCurrency = async (newCurrency: string) => {
    await updateGroup(groupId, { currency: newCurrency });
    await logGroupActivity(
      groupId,
      { id: user?.uid || '', name: user?.name || 'Admin' },
      'currency_changed',
      `${user?.name || 'Admin'} changed group currency to ${newCurrency}`
    );
    await loadData();
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const isArchived = Boolean(group?.isArchived || group?.status === 'archived');
  const typeConfig = GROUP_TYPES.find((t) => t.key === (group?.type || 'home')) || GROUP_TYPES[0];
  const TypeIcon = typeConfig.icon;
  const debtorsCount = settlements.filter((s) => s.toUserId === user?.uid && s.amount > 0.01).length;

  return (
    <View style={styles.container}>
      <AppHeader title="Group Settings" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 30, 50) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <TouchableOpacity
            style={styles.headerCoverPreview}
            onPress={() => isAdmin && setCoverModalVisible(true)}
            activeOpacity={isAdmin ? 0.85 : 1}
          >
            <Image
              source={{
                uri:
                  group?.coverPhoto?.imageUrl ||
                  group?.bannerUrl ||
                  getDefaultCoverPhoto(groupId, group?.icon, group?.name).imageUrl,
              }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={styles.coverScrim} />
            {isAdmin && (
              <View style={styles.changeCoverBadge}>
                <Camera size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.changeCoverBadgeText}>Change Cover</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileMetaBox}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={isAdmin ? pickAvatar : undefined}
              activeOpacity={isAdmin ? 0.8 : 1}
            >
              <MemberAvatar
                name={group?.name || 'Group'}
                imageUrl={group?.imageUrl}
                size={58}
              />
              {isAdmin && (
                <View style={styles.cameraIconCircle}>
                  <Camera size={11} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileInfoText}>
              <Text style={styles.groupMainTitle} numberOfLines={1}>
                {group?.name || 'Group'}
              </Text>
              <View style={styles.tagRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
                  <TypeIcon size={12} color={typeConfig.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                    {typeConfig.label}
                  </Text>
                </View>
                {isArchived && (
                  <View style={styles.archivedBadge}>
                    <Archive size={11} color="#DC2626" style={{ marginRight: 3 }} />
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                )}
              </View>
            </View>

            {isAdmin && (
              <TouchableOpacity
                style={styles.quickEditBtn}
                onPress={() => setEditInfoVisible(true)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color="#059669" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 1. GROUP INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Group Information</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setEditInfoVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Edit3 size={16} color="#059669" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Name & Description</Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {group?.description ? group.description : 'Add trip notes or apartment info'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setEditInfoVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <TypeIcon size={16} color={typeConfig.color} />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Group Category</Text>
                <Text style={styles.rowSubtitle}>{typeConfig.label}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setCoverModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <ImageIcon size={16} color="#0284C7" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Cover Photo</Text>
                <Text style={styles.rowSubtitle}>
                  {group?.coverPhoto ? 'Custom/Preset Photo' : 'No Cover Selected'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <View style={[styles.settingRow, styles.lastRow]}>
              <View style={styles.rowIcon}>
                <Share2 size={16} color="#7C3AED" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Group Join Code</Text>
                <Text style={styles.rowCodeText}>{group?.joinCode || '------'}</Text>
              </View>
              <TouchableOpacity style={styles.codeShareBtn} onPress={onShareInvite} activeOpacity={0.8}>
                <Text style={styles.codeShareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2. MEMBERS & INVITATIONS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Members & Invitations</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setMembersListVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Users size={16} color="#059669" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Member List</Text>
                <Text style={styles.rowSubtitle}>{members.length} members in group</Text>
              </View>
              <View style={styles.memberAvatarsPile}>
                {members.slice(0, 3).map((m, i) => (
                  <View key={m.userId} style={[styles.avatarPileItem, { marginLeft: i > 0 ? -8 : 0 }]}>
                    <MemberAvatar name={m.userName} imageUrl={m.imageUrl} size={24} />
                  </View>
                ))}
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.settingRow, styles.lastRow]}
                onPress={() => setAddMembersVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <UserPlus size={16} color="#0284C7" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Add New Members</Text>
                  <Text style={styles.rowSubtitle}>Invite friends by search or link</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 3. EXPENSE & BALANCE PREFERENCES */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Expense & Balance Preferences</Text>
          <View style={styles.cardContainer}>
            {/* Quick Simplify Debts Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.rowIcon}>
                <Shuffle size={16} color="#059669" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Simplify Debts</Text>
                <Text style={styles.rowSubtitle}>Minimizes total payment transfers</Text>
              </View>
              <Switch
                value={group?.settings?.simplifyDebts ?? true}
                onValueChange={async (val) => {
                  if (!isAdmin) return;
                  if (!val) {
                    Alert.alert(
                      'Disable Simplify Debts?',
                      'Balances will show exact bilateral debts from every individual expense rather than the shortest repayment paths.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disable',
                          style: 'destructive',
                          onPress: async () => {
                            await handleUpdateGroupSettings({
                              ...(group?.settings || {}),
                              simplifyDebts: false,
                            });
                          },
                        },
                      ]
                    );
                    return;
                  }
                  await handleUpdateGroupSettings({
                    ...(group?.settings || {}),
                    simplifyDebts: true,
                  });
                }}
                disabled={!isAdmin}
                trackColor={{ false: '#D1D5DB', true: '#059669' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setCurrencyModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Coins size={16} color="#D97706" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Group Currency</Text>
                <Text style={styles.rowSubtitle}>{group?.currency || 'INR'}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, styles.lastRow]}
              onPress={() => setEditInfoVisible(false)} // Opens full preferences
              onPressIn={() => {}}
              onPressOut={() => {}}
            >
              <View style={styles.rowIcon}>
                <Sliders size={16} color="#7C3AED" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Split & Permission Rules</Text>
                <Text style={styles.rowSubtitle}>
                  Default split: {group?.settings?.defaultSplitType || 'equal'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. NOTIFICATIONS & REMINDERS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Notifications & Reminders</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setNotificationsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Bell size={16} color="#059669" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Group Notifications</Text>
                <Text style={styles.rowSubtitle}>
                  {isMuted ? 'Muted' : 'Active push notifications'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, styles.lastRow]}
              onPress={() => setRemindersVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Clock size={16} color="#D97706" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Send Balance Reminders</Text>
                <Text style={styles.rowSubtitle}>
                  {debtorsCount > 0
                    ? `${debtorsCount} members currently owe you`
                    : 'All members settled up'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. DATA & EXPORT */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Data & Export (100% Free)</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setExportVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <FileSpreadsheet size={16} color="#059669" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Export Financial Data</Text>
                <Text style={styles.rowSubtitle}>CSV spreadsheet & text summary report</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, styles.lastRow]}
              onPress={() => setActivityVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <History size={16} color="#4B5563" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Recent Settings Activity</Text>
                <Text style={styles.rowSubtitle}>Audit history of group changes</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. GROUP LIFECYCLE & DANGER ZONE */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Group Management</Text>
          <View style={styles.cardContainer}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setConfirmArchiveVisible(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: '#FFFBEB' }]}>
                  {isArchived ? (
                    <ArchiveRestore size={16} color="#D97706" />
                  ) : (
                    <Archive size={16} color="#D97706" />
                  )}
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>
                    {isArchived ? 'Unarchive Group' : 'Archive Group'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {isArchived
                      ? 'Restore group back to active groups'
                      : 'Hide from active list while preserving expenses'}
                  </Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setConfirmLeaveVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIcon, { backgroundColor: '#FEF2F2' }]}>
                <LogOut size={16} color="#DC2626" />
              </View>
              <View style={styles.rowMeta}>
                <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Leave Group</Text>
                <Text style={styles.rowSubtitle}>Remove yourself from this group</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.settingRow, styles.lastRow]}
                onPress={() => setConfirmDeleteVisible(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Trash2 size={16} color="#DC2626" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Delete Group</Text>
                  <Text style={styles.rowSubtitle}>Permanently remove group and records</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Cover Photo Modal */}
      <GroupCoverPhotoModal
        visible={coverModalVisible}
        group={group}
        currentUserId={user?.uid}
        onClose={() => setCoverModalVisible(false)}
        onSuccess={loadData}
      />

      {/* Edit Group Info Modal */}
      <EditGroupInfoModal
        visible={editInfoVisible}
        group={group}
        isAdmin={isAdmin}
        memberCount={members.length}
        creatorName={members.find((m) => m.userId === group?.createdBy)?.userName}
        onClose={() => setEditInfoVisible(false)}
        onSave={handleSaveInfo}
      />

      {/* Add Members Modal */}
      <AddMembersModal
        visible={addMembersVisible}
        groupId={groupId}
        groupName={group?.name || 'Group'}
        joinCode={group?.joinCode || ''}
        currentUserId={user?.uid || ''}
        existingMembers={members}
        onClose={() => setAddMembersVisible(false)}
        onAddMembers={handleAddMembers}
      />

      {/* Group Members List Modal */}
      <GroupMembersModal
        visible={membersListVisible}
        members={members}
        currency={group?.currency || 'INR'}
        currentUserId={user?.uid || ''}
        isAdmin={isAdmin}
        settlements={settlements}
        onClose={() => setMembersListVisible(false)}
        onOpenAddMembers={() => setAddMembersVisible(true)}
        onSelectMember={(m) => setSelectedMember(m)}
      />

      {/* Member Details Modal */}
      <MemberDetailsModal
        visible={Boolean(selectedMember)}
        member={selectedMember}
        currency={group?.currency || 'INR'}
        netBalance={0}
        isCurrentUser={selectedMember?.userId === user?.uid}
        isAdmin={isAdmin}
        onClose={() => setSelectedMember(null)}
        onRemove={(m) => setMemberToRemove(m)}
        onTransferAdmin={handleTransferAdmin}
      />

      {/* Currency Selector Modal */}
      <CurrencySelectorModal
        visible={currencyModalVisible}
        currentCurrency={group?.currency || 'INR'}
        isAdmin={isAdmin}
        onClose={() => setCurrencyModalVisible(false)}
        onSelect={handleSelectCurrency}
      />

      {/* Notifications Modal */}
      <GroupNotificationsModal
        visible={notificationsVisible}
        groupId={groupId}
        userId={user?.uid || ''}
        groupName={group?.name || 'Group'}
        onClose={() => setNotificationsVisible(false)}
      />

      {/* Balance Reminders Modal */}
      <BalanceRemindersModal
        visible={remindersVisible}
        groupId={groupId}
        groupName={group?.name || 'Group'}
        currency={group?.currency || 'INR'}
        currentUserId={user?.uid || ''}
        currentUserName={user?.name || 'Member'}
        settlements={settlements}
        members={members}
        onClose={() => setRemindersVisible(false)}
      />

      {/* Export Group Data Modal */}
      {group && (
        <GroupExportModal
          visible={exportVisible}
          group={group}
          members={members}
          expenses={expenses}
          settlements={recordedSettlements}
          onClose={() => setExportVisible(false)}
        />
      )}

      {/* Recent Activity Modal */}
      <RecentActivityModal
        visible={activityVisible}
        groupId={groupId}
        groupName={group?.name || 'Group'}
        onClose={() => setActivityVisible(false)}
      />

      {/* Remove Member Confirmation */}
      <ConfirmationDialog
        visible={Boolean(memberToRemove)}
        title="Remove Member"
        message={`Are you sure you want to remove ${memberToRemove?.userName} from this group?`}
        confirmLabel="Remove"
        isDestructive
        isLoading={isDialogLoading}
        onDismiss={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
      />

      {/* Leave Group Confirmation */}
      <ConfirmationDialog
        visible={confirmLeaveVisible}
        title="Leave Group"
        message="Are you sure you want to leave this group? You can only rejoin with an invitation code."
        confirmLabel="Leave"
        isDestructive
        isLoading={isDialogLoading}
        onDismiss={() => setConfirmLeaveVisible(false)}
        onConfirm={handleLeaveGroup}
      />

      {/* Archive Group Confirmation */}
      <ConfirmationDialog
        visible={confirmArchiveVisible}
        title={isArchived ? 'Unarchive Group' : 'Archive Group'}
        message={
          isArchived
            ? 'Restore this group back to your active list?'
            : 'Archiving hides the group from your active list, but all expenses and history remain safely preserved.'
        }
        confirmLabel={isArchived ? 'Unarchive' : 'Archive'}
        isLoading={isDialogLoading}
        onDismiss={() => setConfirmArchiveVisible(false)}
        onConfirm={handleToggleArchive}
      />

      {/* Delete Group Typed Confirmation */}
      <TypedConfirmDialog
        visible={confirmDeleteVisible}
        title="Delete Group"
        description="This action cannot be undone. All expense records and settlements will be removed. Type DELETE to confirm:"
        expectedWord="DELETE"
        confirmLabel="Delete Permanently"
        isLoading={isDialogLoading}
        onCancel={() => setConfirmDeleteVisible(false)}
        onConfirm={handleDeleteGroup}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Profile Header Card
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerCoverPreview: {
    width: '100%',
    height: 100,
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  coverScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  changeCoverBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeCoverBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: -24,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  cameraIconCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfoText: {
    flex: 1,
  },
  groupMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  archivedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  quickEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section & Cards
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMeta: {
    flex: 1,
    paddingRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  rowCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
    marginTop: 2,
  },
  codeShareBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  codeShareBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  memberAvatarsPile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  avatarPileItem: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
  },
});

export default GroupSettingsScreen;
