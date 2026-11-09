import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import {
  X,
  Search,
  UserPlus,
  Share2,
  Check,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppUser, GroupMember } from '../../types';
import { searchUsers } from '../../services/friendService';
import { MemberAvatar } from '../common/MemberAvatar';

interface AddMembersModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  joinCode: string;
  currentUserId: string;
  existingMembers: GroupMember[];
  onClose: () => void;
  onAddMembers: (users: AppUser[]) => Promise<void>;
}

export const AddMembersModal: React.FC<AddMembersModalProps> = ({
  visible,
  groupId,
  groupName,
  joinCode,
  currentUserId,
  existingMembers,
  onClose,
  onAddMembers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

  useEffect(() => {
    if (!visible) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedUsers([]);
      setCopiedCode(false);
    }
  }, [visible]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchTerm.trim().length >= 2) {
        setSearching(true);
        try {
          const results = await searchUsers(searchTerm.trim(), currentUserId);
          setSearchResults(results);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, currentUserId]);

  const toggleSelectUser = (user: AppUser) => {
    if (existingMemberIds.has(user.uid)) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.uid === user.uid);
      if (exists) return prev.filter((u) => u.uid !== user.uid);
      return [...prev, user];
    });
  };

  const handleAddSelected = async () => {
    if (selectedUsers.length === 0) return;
    setAdding(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      await onAddMembers(selectedUsers);
      onClose();
    } catch (e) {
      console.warn('Failed to add members:', e);
    } finally {
      setAdding(false);
    }
  };

  const handleShareCode = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      await Share.share({
        message: `Join my group "${groupName}" on Splitwiser! Use this join code: ${joinCode}`,
      });
      setCopiedCode(true);
    } catch {
      // Ignored
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Members</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.contentBody}>
            {/* Quick Share Join Code Banner */}
            <View style={styles.shareCodeCard}>
              <View style={styles.shareCodeInfo}>
                <Text style={styles.shareCodeTitle}>Group Join Code</Text>
                <Text style={styles.shareCodeNumber}>{joinCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShareCode}
                activeOpacity={0.8}
              >
                <Share2 size={15} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
                <Text style={styles.shareBtnText}>Share Code</Text>
              </TouchableOpacity>
            </View>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectedRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {selectedUsers.map((u) => (
                    <TouchableOpacity
                      key={u.uid}
                      style={styles.selectedChip}
                      onPress={() => toggleSelectUser(u)}
                      activeOpacity={0.7}
                    >
                      <MemberAvatar name={u.name} imageUrl={u.photoURL || u.imageUrl} size={22} />
                      <Text style={styles.selectedChipText} numberOfLines={1}>
                        {u.name}
                      </Text>
                      <X size={13} color="#065F46" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search registered friends by name or email..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color="#059669" />}
            </View>

            {/* Search Results List */}
            <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
              {searchTerm.trim().length >= 2 && searchResults.length === 0 && !searching && (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyTitle}>No matching users found</Text>
                  <Text style={styles.emptySubtitle}>
                    Ask them to sign up, or share the join code above to let them join directly!
                  </Text>
                </View>
              )}

              {searchResults.map((user) => {
                const isAlreadyMember = existingMemberIds.has(user.uid);
                const isSelected = selectedUsers.some((u) => u.uid === user.uid);

                return (
                  <TouchableOpacity
                    key={user.uid}
                    style={[
                      styles.userRow,
                      isAlreadyMember && styles.disabledUserRow,
                      isSelected && styles.selectedUserRow,
                    ]}
                    onPress={() => toggleSelectUser(user)}
                    disabled={isAlreadyMember}
                    activeOpacity={0.7}
                  >
                    <MemberAvatar name={user.name} imageUrl={user.photoURL || user.imageUrl} size={38} />
                    <View style={styles.userMeta}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email || 'Registered User'}
                      </Text>
                    </View>

                    {isAlreadyMember ? (
                      <View style={styles.alreadyBadge}>
                        <Check size={12} color="#059669" style={{ marginRight: 3 }} />
                        <Text style={styles.alreadyText}>In Group</Text>
                      </View>
                    ) : isSelected ? (
                      <View style={styles.checkedCircle}>
                        <CheckCircle2 size={20} color="#059669" />
                      </View>
                    ) : (
                      <View style={styles.uncheckedCircle} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Bottom Action */}
          {selectedUsers.length > 0 && (
            <View style={styles.footerBar}>
              <TouchableOpacity
                style={styles.confirmAddBtn}
                onPress={handleAddSelected}
                disabled={adding}
                activeOpacity={0.85}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UserPlus size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                    <Text style={styles.confirmAddBtnText}>
                      Add {selectedUsers.length} {selectedUsers.length === 1 ? 'Member' : 'Members'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  contentBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  shareCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  shareCodeInfo: {
    flex: 1,
  },
  shareCodeTitle: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  shareCodeNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 2,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedRow: {
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    maxWidth: 90,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  resultsScroll: {
    maxHeight: 260,
  },
  emptyResults: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  disabledUserRow: {
    opacity: 0.5,
  },
  selectedUserRow: {
    backgroundColor: '#F0FDF4',
  },
  userMeta: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  userEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  alreadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alreadyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  checkedCircle: {
    padding: 2,
  },
  uncheckedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  confirmAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 12,
  },
  confirmAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
