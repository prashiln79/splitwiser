import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import {
  X,
  FileSpreadsheet,
  FileText,
  Share2,
  Calendar,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Group, GroupMember, Expense, Settlement } from '../../types';
import {
  ExportDateRange,
  ExportFormat,
  filterItemsByDateRange,
  shareGroupExport,
} from '../../services/exportService';
import { formatCurrency } from '../../utils/currency';
import { useAppTheme, ThemeColors } from '../../theme';

interface GroupExportModalProps {
  visible: boolean;
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  onClose: () => void;
}

export const GroupExportModal: React.FC<GroupExportModalProps> = ({
  visible,
  group,
  members,
  expenses,
  settlements,
  onClose,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<ExportDateRange>('all');
  const [exporting, setExporting] = useState(false);

  const filteredExpenses = useMemo(
    () => filterItemsByDateRange(expenses, dateRange),
    [expenses, dateRange]
  );
  const filteredSettlements = useMemo(
    () => filterItemsByDateRange(settlements, dateRange),
    [settlements, dateRange]
  );

  const totalExpenseAmount = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [filteredExpenses]
  );

  const handleExport = async () => {
    setExporting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      await shareGroupExport(
        {
          group,
          members,
          expenses,
          settlements,
          format,
          dateRange,
        },
        (payload) => Share.share(payload)
      );
      onClose();
    } catch (e) {
      console.warn('Export share error:', e);
    } finally {
      setExporting(false);
    }
  };

  const DATE_RANGE_OPTIONS: Array<{ key: ExportDateRange; label: string }> = [
    { key: 'all', label: 'All Time' },
    { key: 'this_month', label: 'This Month' },
    { key: 'prev_month', label: 'Previous Month' },
    { key: 'this_year', label: 'This Year' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Export Group Data</Text>
              <Text style={styles.sheetSubtitle}>100% Free Financial Data Export</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Format Selection */}
            <Text style={styles.sectionHeading}>Export Format</Text>
            <View style={styles.formatRow}>
              <TouchableOpacity
                style={[styles.formatCard, format === 'csv' && styles.formatCardActive]}
                onPress={() => setFormat('csv')}
                activeOpacity={0.8}
              >
                <FileSpreadsheet
                  size={24}
                  color={format === 'csv' ? '#059669' : '#6B7280'}
                  strokeWidth={2.2}
                />
                <Text style={[styles.formatTitle, format === 'csv' && styles.formatTitleActive]}>
                  CSV Spreadsheet
                </Text>
                <Text style={styles.formatSubtitle}>Excel, Google Sheets & Numbers</Text>
                {format === 'csv' && (
                  <View style={styles.formatBadge}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formatCard, format === 'summary' && styles.formatCardActive]}
                onPress={() => setFormat('summary')}
                activeOpacity={0.8}
              >
                <FileText
                  size={24}
                  color={format === 'summary' ? '#059669' : '#6B7280'}
                  strokeWidth={2.2}
                />
                <Text style={[styles.formatTitle, format === 'summary' && styles.formatTitleActive]}>
                  Text Summary
                </Text>
                <Text style={styles.formatSubtitle}>Quick shareable text report</Text>
                {format === 'summary' && (
                  <View style={styles.formatBadge}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Date Range Selection */}
            <Text style={styles.sectionHeading}>Date Range</Text>
            <View style={styles.rangePillsRow}>
              {DATE_RANGE_OPTIONS.map((opt) => {
                const isSelected = dateRange === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.rangePill, isSelected && styles.rangePillActive]}
                    onPress={() => setDateRange(opt.key)}
                    activeOpacity={0.75}
                  >
                    <Calendar
                      size={13}
                      color={isSelected ? '#FFFFFF' : '#4B5563'}
                      strokeWidth={2}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[styles.rangePillText, isSelected && styles.rangePillTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Live Data Preview Box */}
            <Text style={styles.sectionHeading}>Report Preview</Text>
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Expenses to Export</Text>
                <Text style={styles.previewValue}>{filteredExpenses.length} transactions</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Expense Amount</Text>
                <Text style={[styles.previewValue, { color: '#059669', fontWeight: '700' }]}>
                  {formatCurrency(totalExpenseAmount, group.currency)}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Settlement Payments</Text>
                <Text style={styles.previewValue}>{filteredSettlements.length} payments</Text>
              </View>
              <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.previewLabel}>Members Covered</Text>
                <Text style={styles.previewValue}>{members.length} members</Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExport}
              disabled={exporting}
              activeOpacity={0.85}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Share2 size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                  <Text style={styles.exportBtnText}>Generate & Share Export</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
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
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 8,
    },
    formatRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    formatCard: {
      flex: 1,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      position: 'relative',
    },
    formatCardActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#F0FDF4',
    },
    formatTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 8,
    },
    formatTitleActive: {
      color: colors.primary,
    },
    formatSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 14,
    },
    formatBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangePillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    rangePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    rangePillActive: {
      backgroundColor: colors.primary,
    },
    rangePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    rangePillTextActive: {
      color: '#FFFFFF',
    },
    previewBox: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 4,
      marginBottom: 20,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    previewLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    previewValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    footerBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 12,
    },
    exportBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
  });
