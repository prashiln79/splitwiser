import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Search,
  UserPlus,
  Shield,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember, OptimizedSettlement } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import { formatCurrency } from '../../utils/currency';

interface GroupMembersModalProps {
  visible: boolean;
  members: GroupMember[];
  currency: string;
  currentUserId: string;
  isAdmin: boolean;
  settlements: OptimizedSettlement[];
  onClose: () => void;
  onOpenAddMembers: () => void;
  onSelectMember: (member: GroupMember) => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  visible,
  members,
  currency,
  currentUserId,
  isAdmin,
  settlements,
  onClose,
  onOpenAddMembers,
  onSelectMember,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Compute individual net balance in this group for each member
  const memberNetBalances = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.userId, 0));

    settlements.forEach((s) => {
      // s.fromUserId owes s.toUserId
      const fromCurrent = map.get(s.fromUserId) || 0;
      map.set(s.fromUserId, fromCurrent - s.amount);

      const toCurrent = map.get(s.toUserId) || 0;
      map.set(s.toUserId, toCurrent + s.amount);
    });

    return map;
  }, [members, settlements]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;
    const term = searchTerm.toLowerCase();
    return members.filter((m) => m.userName.toLowerCase().includes(term));
  }, [members, searchTerm]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Group Members ({members.length})</Text>
              <Text style={styles.sheetSubtitle}>Manage group roster & roles</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBox}>
            <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search member name..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Members List */}
          <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
            {filteredMembers.map((m, index) => {
              const isCurrentUser = m.userId === currentUserId;
              const isMemberAdmin = m.role === 'admin';
              const balance = memberNetBalances.get(m.userId) || 0;

              return (
                <TouchableOpacity
                  key={m.userId}
                  style={styles.memberCard}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    onSelectMember(m);
                  }}
                  activeOpacity={0.75}
                >
                  <MemberAvatar name={m.userName} imageUrl={m.imageUrl} size={42} />
                  <View style={styles.memberMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.userName} {isCurrentUser ? '(You)' : ''}
                      </Text>
                      {isMemberAdmin && (
                        <View style={styles.adminBadge}>
                          <Shield size={10} color="#059669" style={{ marginRight: 3 }} />
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.balanceSubtitle,
                        balance > 0.01
                          ? styles.positiveText
                          : balance < -0.01
                          ? styles.negativeText
                          : styles.settledText,
                      ]}
                    >
                      {balance > 0.01
                        ? `Gets back ${formatCurrency(balance, currency)}`
                        : balance < -0.01
                        ? `Owes ${formatCurrency(Math.abs(balance), currency)}`
                        : 'Settled up'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#D1D5DB" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Add Members Action */}
          {isAdmin && (
            <View style={styles.footerBar}>
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => {
                  onClose();
                  onOpenAddMembers();
                }}
                activeOpacity={0.85}
              >
                <UserPlus size={16} color="#FFFFFF" strokeWidth={2.3} style={{ marginRight: 8 }} />
                <Text style={styles.addMemberBtnText}>Add New Members</Text>
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
    maxHeight: '85%',
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
  sheetSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  membersList: {
    paddingHorizontal: 20,
    maxHeight: 380,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  memberMeta: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  balanceSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  positiveText: {
    color: '#059669',
  },
  negativeText: {
    color: '#DC2626',
  },
  settledText: {
    color: '#6B7280',
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 12,
  },
  addMemberBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

