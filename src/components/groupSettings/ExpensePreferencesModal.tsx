import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  Shuffle,
  EyeOff,
  PieChart,
  Users,
  Shield,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupSettings, SplitType } from '../../types';

interface ExpensePreferencesModalProps {
  visible: boolean;
  isAdmin: boolean;
  groupSettings: GroupSettings;
  hideUninvolvedExpenses: boolean;
  onClose: () => void;
  onUpdateGroupSettings: (settings: GroupSettings) => Promise<void>;
  onUpdateHideUninvolved: (value: boolean) => Promise<void>;
}

export const ExpensePreferencesModal: React.FC<ExpensePreferencesModalProps> = ({
  visible,
  isAdmin,
  groupSettings,
  hideUninvolvedExpenses,
  onClose,
  onUpdateGroupSettings,
  onUpdateHideUninvolved,
}) => {
  const [simplifyDebts, setSimplifyDebts] = useState<boolean>(
    groupSettings.simplifyDebts ?? true
  );
  const [defaultSplit, setDefaultSplit] = useState<SplitType>(
    groupSettings.defaultSplitType || 'equal'
  );
  const [defaultParticipants, setDefaultParticipants] = useState<'all' | 'last'>(
    groupSettings.defaultParticipants === 'last' ? 'last' : 'all'
  );
  const [memberPermissions, setMemberPermissions] = useState<'anyone' | 'admin_only'>(
    groupSettings.memberPermissions || 'anyone'
  );

  useEffect(() => {
    if (visible) {
      setSimplifyDebts(groupSettings.simplifyDebts ?? true);
      setDefaultSplit(groupSettings.defaultSplitType || 'equal');
      setDefaultParticipants(
        groupSettings.defaultParticipants === 'last' ? 'last' : 'all'
      );
      setMemberPermissions(groupSettings.memberPermissions || 'anyone');
    }
  }, [visible, groupSettings]);

  const handleToggleSimplify = async (val: boolean) => {
    if (!isAdmin) return;

    if (!val) {
      // Warning before disabling
      Alert.alert(
        'Disable Simplify Debts?',
        'When disabled, member balances will display exact bilateral debts from every individual expense rather than the shortest repayment paths.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              setSimplifyDebts(false);
              await onUpdateGroupSettings({ ...groupSettings, simplifyDebts: false });
            },
          },
        ]
      );
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setSimplifyDebts(true);
    await onUpdateGroupSettings({ ...groupSettings, simplifyDebts: true });
  };

  const handleSelectSplit = async (type: SplitType) => {
    if (!isAdmin) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setDefaultSplit(type);
    await onUpdateGroupSettings({ ...groupSettings, defaultSplitType: type });
  };

  const handleSelectParticipants = async (p: 'all' | 'last') => {
    if (!isAdmin) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setDefaultParticipants(p);
    await onUpdateGroupSettings({ ...groupSettings, defaultParticipants: p });
  };

  const handleSelectPermissions = async (perm: 'anyone' | 'admin_only') => {
    if (!isAdmin) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMemberPermissions(perm);
    await onUpdateGroupSettings({ ...groupSettings, memberPermissions: perm });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={styles.sheetContainer}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Expense & Balance Preferences</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Group-Wide Settings Header */}
            <Text style={styles.sectionHeading}>Group-Wide Calculations</Text>
            <View style={styles.boxContainer}>
              {/* Simplify Debts */}
              <View style={styles.switchRow}>
                <View style={styles.rowIcon}>
                  <Shuffle size={17} color="#059669" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Simplify Debts</Text>
                  <Text style={styles.rowSubtitle}>
                    Automatically combines debts to minimize the total number of transactions
                    needed to settle up.
                  </Text>
                </View>
                <Switch
                  value={simplifyDebts}
                  onValueChange={handleToggleSimplify}
                  disabled={!isAdmin}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Personal Viewing Preference */}
            <Text style={styles.sectionHeading}>Personal Viewing Preference</Text>
            <View style={styles.boxContainer}>
              <View style={styles.switchRow}>
                <View style={styles.rowIcon}>
                  <EyeOff size={17} color="#0284C7" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle}>Hide expenses not involving me</Text>
                  <Text style={styles.rowSubtitle}>
                    Filters your group timeline to only show expenses where you are a payer or
                    participant. (Does not affect others)
                  </Text>
                </View>
                <Switch
                  value={hideUninvolvedExpenses}
                  onValueChange={async (val) => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    await onUpdateHideUninvolved(val);
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#059669' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Default Split Method */}
            <Text style={styles.sectionHeading}>Default Split Method</Text>
            <View style={styles.boxContainer}>
              {(['equal', 'unequal', 'percentage', 'shares', 'adjustment', 'itemized'] as SplitType[]).map((type) => {
                const isSelected = defaultSplit === type;
                const labels: Record<SplitType, { title: string; subtitle: string }> = {
                  equal: { title: 'Split Equally', subtitle: 'Divides total equally among all participants' },
                  unequal: { title: 'Exact Amounts', subtitle: 'Specify custom numerical amounts per person' },
                  percentage: { title: 'Percentages', subtitle: 'Split by exact percent portions (100%)' },
                  shares: { title: 'By Shares', subtitle: 'Specify ratios or portion weights (e.g. 1 share, 2 shares)' },
                  adjustment: { title: 'Adjustments', subtitle: 'Base equal split plus custom per-person adjustments' },
                  itemized: { title: 'Itemized Receipt', subtitle: 'Assign individual items, tax, and tip directly' },
                };
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.selectRow, isSelected && styles.selectRowActive]}
                    onPress={() => handleSelectSplit(type)}
                    disabled={!isAdmin}
                    activeOpacity={0.7}
                  >
                    <View style={styles.selectMeta}>
                      <Text style={styles.selectTitle}>{labels[type].title}</Text>
                      <Text style={styles.selectSubtitle}>{labels[type].subtitle}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Default Participants */}
            <Text style={styles.sectionHeading}>Default Participants</Text>
            <View style={styles.boxContainer}>
              <TouchableOpacity
                style={[styles.selectRow, defaultParticipants === 'all' && styles.selectRowActive]}
                onPress={() => handleSelectParticipants('all')}
                disabled={!isAdmin}
                activeOpacity={0.7}
              >
                <View style={styles.selectMeta}>
                  <Text style={styles.selectTitle}>All Group Members</Text>
                  <Text style={styles.selectSubtitle}>Every member selected automatically for new expenses</Text>
                </View>
                {defaultParticipants === 'all' && (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.selectRow, defaultParticipants === 'last' && styles.selectRowActive]}
                onPress={() => handleSelectParticipants('last')}
                disabled={!isAdmin}
                activeOpacity={0.7}
              >
                <View style={styles.selectMeta}>
                  <Text style={styles.selectTitle}>Remember Last Selection</Text>
                  <Text style={styles.selectSubtitle}>Pre-selects participants from the most recently added expense</Text>
                </View>
                {defaultParticipants === 'last' && (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Expense Editing Permissions */}
            <Text style={styles.sectionHeading}>Expense Editing Permissions</Text>
            <View style={[styles.boxContainer, { marginBottom: 30 }]}>
              <TouchableOpacity
                style={[styles.selectRow, memberPermissions === 'anyone' && styles.selectRowActive]}
                onPress={() => handleSelectPermissions('anyone')}
                disabled={!isAdmin}
                activeOpacity={0.7}
              >
                <View style={styles.selectMeta}>
                  <Text style={styles.selectTitle}>Anyone Can Edit</Text>
                  <Text style={styles.selectSubtitle}>Any group member can add, edit, or delete expenses</Text>
                </View>
                {memberPermissions === 'anyone' && (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.selectRow, memberPermissions === 'admin_only' && styles.selectRowActive]}
                onPress={() => handleSelectPermissions('admin_only')}
                disabled={!isAdmin}
                activeOpacity={0.7}
              >
                <View style={styles.selectMeta}>
                  <Text style={styles.selectTitle}>Admin Only</Text>
                  <Text style={styles.selectSubtitle}>Only group admins can modify or delete group expenses</Text>
                </View>
                {memberPermissions === 'admin_only' && (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
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
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  boxContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMeta: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  selectRowActive: {
    backgroundColor: '#F0FDF4',
  },
  selectMeta: {
    flex: 1,
    paddingRight: 10,
  },
  selectTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#111827',
  },
  selectSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

