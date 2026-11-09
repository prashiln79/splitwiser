import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import {
  X,
  Check,
  AlertCircle,
  Equal,
  Hash,
  Percent,
  Scale,
  SlidersHorizontal,
  Receipt,
  Plus,
  Minus,
  Trash,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GroupMember, SplitType } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';
import {
  toCents,
  fromCents,
  formatCents,
  distributeCentsEqually,
  distributeCentsByShares,
  distributeCentsByPercentages,
  calculateAdjustmentSplits,
  calculateItemizedSplits,
  ItemizedBillItem,
} from '../../utils/splitMath';

export interface SplitConfigurationData {
  splitMethod: SplitType;
  selectedMembers: Record<string, boolean>;
  exactAmounts: Record<string, string>;
  percentages: Record<string, string>;
  shares: Record<string, string>;
  adjustments: Record<string, string>;
  itemizedItems: {
    id: string;
    title: string;
    amount: string;
    assignedMemberIds: string[];
  }[];
  itemizedTax: string;
  itemizedTip: string;
}

interface SplitConfigurationModalProps {
  visible: boolean;
  onClose: () => void;
  members: GroupMember[];
  currentUserId: string;
  totalAmount: number;
  currency: string;
  initialSplitMethod: SplitType;
  initialData: SplitConfigurationData;
  totalPaidAmount?: number;
  onConfirmSplit: (data: SplitConfigurationData, newTotalAmount?: number) => void;
}

const SPLIT_TABS: { key: SplitType; label: string; icon: any }[] = [
  { key: 'equal', label: 'Equal', icon: Equal },
  { key: 'unequal', label: 'Exact', icon: Hash },
  { key: 'percentage', label: 'Percent', icon: Percent },
  { key: 'shares', label: 'Shares', icon: Scale },
  { key: 'adjustment', label: 'Adjust', icon: SlidersHorizontal },
  { key: 'itemized', label: 'Itemized', icon: Receipt },
];

export const SplitConfigurationModal: React.FC<SplitConfigurationModalProps> = ({
  visible,
  onClose,
  members,
  currentUserId,
  totalAmount,
  currency,
  initialSplitMethod,
  initialData,
  totalPaidAmount,
  onConfirmSplit,
}) => {
  const [activeTab, setActiveTab] = useState<SplitType>(initialSplitMethod);

  // Local draft states
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [itemizedItems, setItemizedItems] = useState<
    { id: string; title: string; amount: string; assignedMemberIds: string[] }[]
  >([]);
  const [itemizedTax, setItemizedTax] = useState<string>('');
  const [itemizedTip, setItemizedTip] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setActiveTab(initialSplitMethod);
      setSelectedMembers({ ...initialData.selectedMembers });
      setExactAmounts({ ...initialData.exactAmounts });
      setPercentages({ ...initialData.percentages });
      setShares({ ...initialData.shares });
      setAdjustments({ ...initialData.adjustments });
      setItemizedItems(
        initialData.itemizedItems.length > 0
          ? initialData.itemizedItems.map((i) => ({ ...i, assignedMemberIds: [...i.assignedMemberIds] }))
          : [
              {
                id: '1',
                title: 'Item 1',
                amount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
                assignedMemberIds: members.map((m) => m.userId),
              },
            ]
      );
      setItemizedTax(initialData.itemizedTax || '');
      setItemizedTip(initialData.itemizedTip || '');
    }
  }, [visible, initialSplitMethod, initialData, members, totalAmount]);

  const totalExpenseCents = toCents(totalAmount);

  // 1. Equal Split Calculations
  const includedMemberIds = useMemo(() => {
    return members.map((m) => m.userId).filter((id) => selectedMembers[id]);
  }, [members, selectedMembers]);

  const equalShares = useMemo(() => {
    if (includedMemberIds.length === 0 || totalExpenseCents <= 0) return {};
    const distributed = distributeCentsEqually(totalExpenseCents, includedMemberIds.length);
    const map: Record<string, number> = {};
    includedMemberIds.forEach((id, idx) => {
      map[id] = distributed[idx];
    });
    return map;
  }, [includedMemberIds, totalExpenseCents]);

  // 2. Exact Amounts Calculations
  const exactAllocatedCents = useMemo(() => {
    return Object.values(exactAmounts).reduce((sum, v) => sum + toCents(v), 0);
  }, [exactAmounts]);

  // 3. Percentages Calculations
  const totalPercentage = useMemo(() => {
    return Object.values(percentages).reduce((sum, v) => sum + (parseFloat(v || '0') || 0), 0);
  }, [percentages]);

  const percentageShares = useMemo(() => {
    const list = members.map((m) => ({
      id: m.userId,
      pct: parseFloat(percentages[m.userId] || '0') || 0,
    }));
    const distributed = distributeCentsByPercentages(totalExpenseCents, list);
    const map: Record<string, number> = {};
    distributed.forEach((d) => {
      map[d.id] = d.cents;
    });
    return map;
  }, [members, percentages, totalExpenseCents]);

  // 4. Shares Calculations
  const totalSharesCount = useMemo(() => {
    return Object.values(shares).reduce((sum, v) => sum + (parseInt(v || '0', 10) || 0), 0);
  }, [shares]);

  const sharesCalculatedShares = useMemo(() => {
    const list = members.map((m) => ({
      id: m.userId,
      shares: parseInt(shares[m.userId] || '0', 10) || 0,
    }));
    const distributed = distributeCentsByShares(totalExpenseCents, list);
    const map: Record<string, number> = {};
    distributed.forEach((d) => {
      map[d.id] = d.cents;
    });
    return map;
  }, [members, shares, totalExpenseCents]);

  // 5. Adjustment Calculations
  const adjustmentCalc = useMemo(() => {
    const adjInCents: Record<string, number> = {};
    members.forEach((m) => {
      adjInCents[m.userId] = toCents(adjustments[m.userId] || '0');
    });
    return calculateAdjustmentSplits(totalExpenseCents, includedMemberIds, adjInCents);
  }, [totalExpenseCents, includedMemberIds, adjustments, members]);

  // 6. Itemized Calculations
  const itemizedCalc = useMemo(() => {
    const billItems: ItemizedBillItem[] = itemizedItems.map((it) => ({
      id: it.id,
      title: it.title,
      amountCents: toCents(it.amount),
      assignedMemberIds: it.assignedMemberIds,
    }));
    const taxCents = toCents(itemizedTax);
    const tipCents = toCents(itemizedTip);
    return calculateItemizedSplits(
      billItems,
      taxCents,
      tipCents,
      members.map((m) => m.userId)
    );
  }, [itemizedItems, itemizedTax, itemizedTip, members]);

  // Active Tab Total Allocated & Validation
  const activeTabMeta = useMemo(() => {
    switch (activeTab) {
      case 'equal': {
        const count = includedMemberIds.length;
        const isValid = count > 0;
        const error = count === 0 ? 'Select at least one participant.' : undefined;
        return {
          allocatedCents: count > 0 ? totalExpenseCents : 0,
          diffCents: count > 0 ? 0 : totalExpenseCents,
          isValid,
          errorMessage: error,
          participantCount: count,
        };
      }
      case 'unequal': {
        const diff = totalExpenseCents - exactAllocatedCents;
        const isValid = Math.abs(diff) === 0;
        const participantCount = Object.values(exactAmounts).filter((v) => toCents(v) > 0).length;
        return {
          allocatedCents: exactAllocatedCents,
          diffCents: diff,
          isValid: isValid && participantCount > 0,
          errorMessage:
            participantCount === 0
              ? 'Enter amounts for participants.'
              : !isValid
              ? `Exact total differs by ${formatCents(Math.abs(diff), currency)}.`
              : undefined,
          participantCount,
        };
      }
      case 'percentage': {
        const diffPct = 100 - totalPercentage;
        const isValid = Math.abs(diffPct) < 0.05;
        const participantCount = Object.values(percentages).filter((v) => parseFloat(v || '0') > 0).length;
        return {
          allocatedCents: Math.round((totalExpenseCents * totalPercentage) / 100),
          diffCents: Math.round((totalExpenseCents * diffPct) / 100),
          isValid: isValid && participantCount > 0,
          errorMessage:
            participantCount === 0
              ? 'Enter percentages for participants.'
              : !isValid
              ? `Percentages must total 100% (currently ${totalPercentage.toFixed(1)}%).`
              : undefined,
          participantCount,
        };
      }
      case 'shares': {
        const isValid = totalSharesCount > 0;
        const participantCount = Object.values(shares).filter((v) => parseInt(v || '0', 10) > 0).length;
        return {
          allocatedCents: isValid ? totalExpenseCents : 0,
          diffCents: isValid ? 0 : totalExpenseCents,
          isValid,
          errorMessage: !isValid ? 'Allocate at least one share.' : undefined,
          participantCount,
        };
      }
      case 'adjustment': {
        const diff = adjustmentCalc.netAdjustmentCents;
        const isValid = adjustmentCalc.isValid && includedMemberIds.length > 0;
        return {
          allocatedCents: totalExpenseCents + diff,
          diffCents: -diff,
          isValid,
          errorMessage: adjustmentCalc.errorMessage,
          participantCount: includedMemberIds.length,
        };
      }
      case 'itemized': {
        const diff = totalExpenseCents - itemizedCalc.grandTotalCents;
        const isValid = itemizedCalc.isValid && Math.abs(diff) === 0;
        const participantCount = Object.values(itemizedCalc.memberTotals).filter((m) => m.totalCents > 0).length;
        return {
          allocatedCents: itemizedCalc.grandTotalCents,
          diffCents: diff,
          isValid,
          errorMessage:
            itemizedCalc.errorMessage ||
            (Math.abs(diff) !== 0
              ? `Itemized total (${formatCents(itemizedCalc.grandTotalCents, currency)}) differs from expense total.`
              : undefined),
          participantCount,
        };
      }
      default:
        return {
          allocatedCents: totalExpenseCents,
          diffCents: 0,
          isValid: true,
          errorMessage: undefined,
          participantCount: members.length,
        };
    }
  }, [
    activeTab,
    includedMemberIds,
    totalExpenseCents,
    exactAllocatedCents,
    exactAmounts,
    totalPercentage,
    percentages,
    totalSharesCount,
    shares,
    adjustmentCalc,
    itemizedCalc,
    currency,
    members.length,
  ]);

  // Handlers for Items
  const handleAddItem = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const newId = String(Date.now());
    setItemizedItems((prev) => [
      ...prev,
      {
        id: newId,
        title: `Item ${prev.length + 1}`,
        amount: '',
        assignedMemberIds: members.map((m) => m.userId),
      },
    ]);
  };

  const handleDeleteItem = (itemId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setItemizedItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleToggleItemMember = (itemId: string, memberId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setItemizedItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const has = it.assignedMemberIds.includes(memberId);
        const next = has
          ? it.assignedMemberIds.filter((id) => id !== memberId)
          : [...it.assignedMemberIds, memberId];
        return { ...it, assignedMemberIds: next };
      })
    );
  };

  // Sync Total to Itemized Grand Total
  const handleSyncItemizedTotal = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const newTotal = fromCents(itemizedCalc.grandTotalCents);
    onConfirmSplit(
      {
        splitMethod: 'itemized',
        selectedMembers,
        exactAmounts,
        percentages,
        shares,
        adjustments,
        itemizedItems,
        itemizedTax,
        itemizedTip,
      },
      newTotal
    );
    onClose();
  };

  const handleConfirm = () => {
    if (!activeTabMeta.isValid) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      Alert.alert('Incomplete Split', activeTabMeta.errorMessage || 'Please balance the split before confirming.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    onConfirmSplit({
      splitMethod: activeTab,
      selectedMembers,
      exactAmounts,
      percentages,
      shares,
      adjustments,
      itemizedItems,
      itemizedTax,
      itemizedTip,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Split Options</Text>
                <Text style={styles.modalSubtitle}>
                  Expense: {formatCents(totalExpenseCents, currency)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Horizontal Segmented Tabs */}
            <View style={styles.tabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScrollContent}
              >
                {SPLIT_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const IconComp = tab.icon;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tabButton, isActive && styles.tabButtonActive]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        setActiveTab(tab.key);
                      }}
                      activeOpacity={0.7}
                    >
                      <IconComp
                        size={15}
                        color={isActive ? '#059669' : '#6B7280'}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Tab Body */}
            <View style={styles.bodyContainer}>
              {/* 1. EQUAL SPLIT */}
              {activeTab === 'equal' && (
                <View style={styles.tabContent}>
                  <View style={styles.equalHeaderRow}>
                    <Text style={styles.bodySubheading}>
                      {includedMemberIds.length} of {members.length} members included
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        const allSelected = members.every((m) => selectedMembers[m.userId]);
                        const updated: Record<string, boolean> = {};
                        members.forEach((m) => {
                          updated[m.userId] = !allSelected;
                        });
                        setSelectedMembers(updated);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionLinkText}>
                        {members.every((m) => selectedMembers[m.userId]) ? 'Deselect all' : 'Select all'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.membersListScroll} showsVerticalScrollIndicator={false}>
                    {members.map((m) => {
                      const isChecked = !!selectedMembers[m.userId];
                      const isMe = m.userId === currentUserId;
                      const shareCents = equalShares[m.userId] || 0;
                      return (
                        <TouchableOpacity
                          key={m.userId}
                          style={styles.memberRow}
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            }
                            setSelectedMembers((prev) => ({
                              ...prev,
                              [m.userId]: !prev[m.userId],
                            }));
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.memberLeft}>
                            <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                            <Text style={styles.memberName} numberOfLines={1}>
                              {isMe ? `${m.userName} (You)` : m.userName}
                            </Text>
                          </View>

                          <View style={styles.memberRight}>
                            {isChecked && totalExpenseCents > 0 && (
                              <Text style={styles.shareAmountText}>
                                {formatCents(shareCents, currency)}
                              </Text>
                            )}
                            <View
                              style={[
                                styles.checkbox,
                                isChecked && styles.checkboxChecked,
                              ]}
                            >
                              {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 2. EXACT AMOUNTS */}
              {activeTab === 'unequal' && (
                <View style={styles.tabContent}>
                  <View style={styles.statusPillRow}>
                    <Text style={styles.bodySubheading}>
                      Entered: {formatCents(exactAllocatedCents, currency)} of{' '}
                      {formatCents(totalExpenseCents, currency)}
                    </Text>
                    {Math.abs(totalExpenseCents - exactAllocatedCents) === 0 ? (
                      <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                        <Check size={12} color="#059669" strokeWidth={3} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Balanced</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                        <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>
                          {totalExpenseCents > exactAllocatedCents
                            ? `${formatCents(totalExpenseCents - exactAllocatedCents, currency)} left`
                            : `${formatCents(exactAllocatedCents - totalExpenseCents, currency)} over`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <ScrollView
                    style={styles.membersListScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {members.map((m) => {
                      const isMe = m.userId === currentUserId;
                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberLeft}>
                            <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                            <Text style={styles.memberName} numberOfLines={1}>
                              {isMe ? `${m.userName} (You)` : m.userName}
                            </Text>
                          </View>

                          <View style={styles.currencyInputBox}>
                            <Text style={styles.currencyPrefix}>{currency}</Text>
                            <TextInput
                              style={styles.numericInput}
                              value={exactAmounts[m.userId] || ''}
                              onChangeText={(val) => {
                                const cleaned = val.replace(/[^0-9.]/g, '');
                                const parts = cleaned.split('.');
                                if (parts.length > 2) return;
                                if (parts[1] && parts[1].length > 2) return;
                                setExactAmounts((prev) => ({ ...prev, [m.userId]: cleaned }));
                              }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor="#9CA3AF"
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 3. PERCENTAGES */}
              {activeTab === 'percentage' && (
                <View style={styles.tabContent}>
                  <View style={styles.statusPillRow}>
                    <Text style={styles.bodySubheading}>
                      Total: {totalPercentage.toFixed(1)}% of 100%
                    </Text>
                    {Math.abs(100 - totalPercentage) < 0.05 ? (
                      <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                        <Check size={12} color="#059669" strokeWidth={3} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>100%</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                        <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>
                          {totalPercentage < 100
                            ? `${(100 - totalPercentage).toFixed(1)}% left`
                            : `${(totalPercentage - 100).toFixed(1)}% over`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <ScrollView
                    style={styles.membersListScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {members.map((m) => {
                      const isMe = m.userId === currentUserId;
                      const shareCents = percentageShares[m.userId] || 0;
                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberLeft}>
                            <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.memberName} numberOfLines={1}>
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </Text>
                              <Text style={styles.calcSharePreview}>
                                {formatCents(shareCents, currency)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.pctInputBox}>
                            <TextInput
                              style={styles.numericInput}
                              value={percentages[m.userId] || ''}
                              onChangeText={(val) => {
                                const cleaned = val.replace(/[^0-9.]/g, '');
                                setPercentages((prev) => ({ ...prev, [m.userId]: cleaned }));
                              }}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="#9CA3AF"
                              selectTextOnFocus
                            />
                            <Text style={styles.pctSuffix}>%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 4. SHARES */}
              {activeTab === 'shares' && (
                <View style={styles.tabContent}>
                  <View style={styles.statusPillRow}>
                    <Text style={styles.bodySubheading}>
                      Total shares: {totalSharesCount}
                    </Text>
                    {totalSharesCount > 0 ? (
                      <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                        <Check size={12} color="#059669" strokeWidth={3} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>
                          {totalSharesCount} active
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                        <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>0 shares</Text>
                      </View>
                    )}
                  </View>

                  <ScrollView style={styles.membersListScroll} showsVerticalScrollIndicator={false}>
                    {members.map((m) => {
                      const isMe = m.userId === currentUserId;
                      const count = parseInt(shares[m.userId] || '0', 10);
                      const shareCents = sharesCalculatedShares[m.userId] || 0;
                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberLeft}>
                            <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.memberName} numberOfLines={1}>
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </Text>
                              <Text style={styles.calcSharePreview}>
                                {formatCents(shareCents, currency)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => {
                                if (Platform.OS !== 'web') {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                }
                                const next = Math.max(0, count - 1);
                                setShares((prev) => ({ ...prev, [m.userId]: String(next) }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Minus size={14} color="#1F2937" strokeWidth={2.5} />
                            </TouchableOpacity>

                            <Text style={styles.stepperCountText}>
                              {count} {count === 1 ? 'share' : 'shares'}
                            </Text>

                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => {
                                if (Platform.OS !== 'web') {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                }
                                setShares((prev) => ({ ...prev, [m.userId]: String(count + 1) }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Plus size={14} color="#1F2937" strokeWidth={2.5} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 5. ADJUSTMENT SPLIT */}
              {activeTab === 'adjustment' && (
                <View style={styles.tabContent}>
                  <View style={styles.statusPillRow}>
                    <Text style={styles.bodySubheading}>
                      Base: {formatCents(Math.floor(totalExpenseCents / Math.max(1, includedMemberIds.length)), currency)}/ea
                    </Text>
                    {adjustmentCalc.netAdjustmentCents === 0 ? (
                      <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                        <Check size={12} color="#059669" strokeWidth={3} />
                        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Balanced</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                        <AlertCircle size={12} color="#E11D48" strokeWidth={2.5} />
                        <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>
                          Net: {formatCents(adjustmentCalc.netAdjustmentCents, currency)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <ScrollView
                    style={styles.membersListScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {members.map((m) => {
                      const isMe = m.userId === currentUserId;
                      const splitItem = adjustmentCalc.splits.find((s) => s.id === m.userId);
                      const finalCents = splitItem ? splitItem.cents : 0;
                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberLeft}>
                            <MemberAvatar name={m.userName} size={36} imageUrl={m.imageUrl} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.memberName} numberOfLines={1}>
                                {isMe ? `${m.userName} (You)` : m.userName}
                              </Text>
                              <Text style={styles.calcSharePreview}>
                                Share: {formatCents(finalCents, currency)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.currencyInputBox}>
                            <TextInput
                              style={styles.numericInput}
                              value={adjustments[m.userId] || ''}
                              onChangeText={(val) => {
                                // Allow negative and positive numbers
                                const cleaned = val.replace(/[^0-9.-]/g, '');
                                setAdjustments((prev) => ({ ...prev, [m.userId]: cleaned }));
                              }}
                              keyboardType="numbers-and-punctuation"
                              placeholder="+/- 0"
                              placeholderTextColor="#9CA3AF"
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 6. ITEMIZED SPLIT */}
              {activeTab === 'itemized' && (
                <View style={styles.tabContent}>
                  <ScrollView
                    style={styles.itemizedScrollView}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Item list */}
                    {itemizedItems.map((item, index) => (
                      <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemTopRow}>
                          <TextInput
                            style={styles.itemTitleInput}
                            value={item.title}
                            onChangeText={(val) => {
                              setItemizedItems((prev) =>
                                prev.map((it) => (it.id === item.id ? { ...it, title: val } : it))
                              );
                            }}
                            placeholder={`Item ${index + 1}`}
                            placeholderTextColor="#9CA3AF"
                          />
                          <View style={styles.itemAmountBox}>
                            <Text style={styles.currencyPrefix}>{currency}</Text>
                            <TextInput
                              style={styles.itemAmountInput}
                              value={item.amount}
                              onChangeText={(val) => {
                                const cleaned = val.replace(/[^0-9.]/g, '');
                                setItemizedItems((prev) =>
                                  prev.map((it) => (it.id === item.id ? { ...it, amount: cleaned } : it))
                                );
                              }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                          {itemizedItems.length > 1 && (
                            <TouchableOpacity
                              onPress={() => handleDeleteItem(item.id)}
                              style={styles.itemDeleteBtn}
                            >
                              <Trash size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Assignee Chips */}
                        <Text style={styles.assignedLabel}>Shared with:</Text>
                        <View style={styles.memberChipsWrap}>
                          {members.map((m) => {
                            const isAssigned = item.assignedMemberIds.includes(m.userId);
                            const isMe = m.userId === currentUserId;
                            return (
                              <TouchableOpacity
                                key={m.userId}
                                style={[
                                  styles.memberChip,
                                  isAssigned && styles.memberChipSelected,
                                ]}
                                onPress={() => handleToggleItemMember(item.id, m.userId)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.memberChipText,
                                    isAssigned && styles.memberChipTextSelected,
                                  ]}
                                >
                                  {isMe ? 'You' : m.userName}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}

                    {/* Add Item Button */}
                    <TouchableOpacity
                      style={styles.addItemBtn}
                      onPress={handleAddItem}
                      activeOpacity={0.7}
                    >
                      <Plus size={15} color="#059669" strokeWidth={2.5} />
                      <Text style={styles.addItemBtnText}>Add another item</Text>
                    </TouchableOpacity>

                    {/* Tax & Tip inputs */}
                    <View style={styles.taxTipRow}>
                      <View style={styles.taxTipCol}>
                        <Text style={styles.taxTipLabel}>Tax ({currency})</Text>
                        <TextInput
                          style={styles.taxTipInput}
                          value={itemizedTax}
                          onChangeText={(val) => setItemizedTax(val.replace(/[^0-9.]/g, ''))}
                          placeholder="0.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.taxTipCol}>
                        <Text style={styles.taxTipLabel}>Tip ({currency})</Text>
                        <TextInput
                          style={styles.taxTipInput}
                          value={itemizedTip}
                          onChangeText={(val) => setItemizedTip(val.replace(/[^0-9.]/g, ''))}
                          placeholder="0.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    {/* Sync Action if itemized grand total differs from total expense */}
                    {Math.abs(totalExpenseCents - itemizedCalc.grandTotalCents) !== 0 && (
                      <TouchableOpacity
                        style={styles.syncTotalBtn}
                        onPress={handleSyncItemizedTotal}
                        activeOpacity={0.8}
                      >
                        <RefreshCw size={14} color="#059669" />
                        <Text style={styles.syncTotalBtnText}>
                          Update total expense to {formatCents(itemizedCalc.grandTotalCents, currency)}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Per-member calculation summary */}
                    <View style={styles.itemizedSummaryBox}>
                      <Text style={styles.itemizedSummaryHeading}>Summary per member</Text>
                      {members.map((m) => {
                        const mTot = itemizedCalc.memberTotals[m.userId] || {
                          itemCents: 0,
                          taxTipCents: 0,
                          totalCents: 0,
                        };
                        const isMe = m.userId === currentUserId;
                        return (
                          <View key={m.userId} style={styles.summaryItemRow}>
                            <Text style={styles.summaryMemberName}>
                              {isMe ? `${m.userName} (You)` : m.userName}
                            </Text>
                            <Text style={styles.summaryMemberAmount}>
                              {formatCents(mTot.totalCents, currency)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Bottom Summary Preview Bar */}
            <View style={styles.summaryPreviewBar}>
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryMetric}>
                  <Text style={styles.summaryMetricLabel}>Expense</Text>
                  <Text style={styles.summaryMetricValue}>
                    {formatCents(totalExpenseCents, currency)}
                  </Text>
                </View>

                <View style={styles.summaryMetric}>
                  <Text style={styles.summaryMetricLabel}>Allocated</Text>
                  <Text style={styles.summaryMetricValue}>
                    {formatCents(activeTabMeta.allocatedCents, currency)}
                  </Text>
                </View>

                {activeTabMeta.isValid ? (
                  <View style={[styles.statusBadge, styles.statusBadgeBalanced]}>
                    <Check size={13} color="#059669" strokeWidth={3} />
                    <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Balanced</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, styles.statusBadgeUnbalanced]}>
                    <AlertCircle size={13} color="#E11D48" strokeWidth={2.5} />
                    <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>
                      {activeTabMeta.diffCents > 0
                        ? `${formatCents(activeTabMeta.diffCents, currency)} left`
                        : `${formatCents(Math.abs(activeTabMeta.diffCents), currency)} over`}
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm CTA */}
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  !activeTabMeta.isValid && styles.confirmBtnDisabled,
                ]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Confirm Split</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
  },
  tabsWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  bodyContainer: {
    minHeight: 280,
    maxHeight: 380,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  equalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bodySubheading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  statusPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  statusBadgeBalanced: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeUnbalanced: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  membersListScroll: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    width: 95,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 4,
  },
  numericInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    padding: 0,
  },
  pctInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    width: 70,
  },
  pctSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 2,
  },
  calcSharePreview: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
    gap: 6,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  stepperCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    minWidth: 54,
    textAlign: 'center',
  },
  itemizedScrollView: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 4,
  },
  itemAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    width: 85,
  },
  itemAmountInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    padding: 0,
  },
  itemDeleteBtn: {
    padding: 6,
  },
  assignedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  memberChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  memberChipSelected: {
    backgroundColor: '#059669',
  },
  memberChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  memberChipTextSelected: {
    color: '#FFFFFF',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    marginBottom: 12,
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  taxTipRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taxTipCol: {
    flex: 1,
  },
  taxTipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  taxTipInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  syncTotalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 8,
    marginBottom: 12,
  },
  syncTotalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  itemizedSummaryBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  itemizedSummaryHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryMemberName: {
    fontSize: 12,
    color: '#374151',
  },
  summaryMemberAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  summaryPreviewBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#FFFFFF',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryMetric: {
    gap: 2,
  },
  summaryMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  summaryMetricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  confirmBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

