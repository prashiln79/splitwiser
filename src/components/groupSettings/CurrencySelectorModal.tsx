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
import { X, Search, Check, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../theme';
import {
  SUPPORTED_CURRENCIES,
  CurrencyInfo,
} from '../../utils/currencyData';

export { SUPPORTED_CURRENCIES };
export type CurrencyItem = CurrencyInfo;

export interface CurrencySelectorModalProps {
  visible: boolean;
  currentCurrency: string;
  isAdmin?: boolean;
  title?: string;
  requireConfirmation?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  onClose: () => void;
  onSelect: (currencyCode: string) => void;
}

export const CurrencySelectorModal: React.FC<CurrencySelectorModalProps> = ({
  visible,
  currentCurrency,
  isAdmin = true,
  title = 'Select Currency',
  requireConfirmation,
  confirmTitle,
  confirmMessage,
  onClose,
  onSelect,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CurrencyInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // If requireConfirmation is explicitly set, use that.
  // Otherwise, if title is 'Group Currency', require confirmation by default.
  const shouldConfirm =
    requireConfirmation !== undefined
      ? requireConfirmation
      : title === 'Group Currency';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SUPPORTED_CURRENCIES;
    return SUPPORTED_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = (item: CurrencyInfo) => {
    if (!isAdmin) return;
    if (item.code === currentCurrency) {
      onClose();
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (shouldConfirm) {
      setSelected(item);
      setShowConfirm(true);
    } else {
      onSelect(item.code);
      onClose();
    }
  };

  const handleConfirm = () => {
    if (selected) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onSelect(selected.code);
      setShowConfirm(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search currency code, country or symbol..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <ScrollView
            style={styles.currencyList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.map((item) => {
              const isCurrent =
                item.code.toUpperCase() === (currentCurrency || '').toUpperCase();
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.currencyRow, isCurrent && styles.currentCurrencyRow]}
                  onPress={() => handleSelect(item)}
                  disabled={!isAdmin}
                  activeOpacity={0.7}
                >
                  <View style={styles.symbolBadge}>
                    <Text style={styles.symbolBadgeText}>{item.symbol}</Text>
                  </View>
                  <View style={styles.currencyMeta}>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>{item.name}</Text>
                  </View>
                  {item.decimals !== 2 && (
                    <Text style={styles.decimalsTag}>
                      {item.decimals === 0 ? '0 decimals' : `${item.decimals} dec`}
                    </Text>
                  )}
                  {isCurrent && (
                    <View style={styles.activePill}>
                      <Check size={14} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matching currencies found</Text>
              </View>
            )}
          </ScrollView>

          {/* Confirmation Sub-Dialog */}
          {showConfirm && selected && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmBox}>
                <View style={styles.confirmHeader}>
                  <AlertCircle size={22} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmTitle}>
                    {confirmTitle || 'Change Currency?'}
                  </Text>
                </View>
                <Text style={styles.confirmBody}>
                  {confirmMessage ? (
                    confirmMessage
                  ) : (
                    <>
                      Changing currency to{' '}
                      <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                        {selected.code} ({selected.name})
                      </Text>
                      .{'\n\n'}
                      <Text style={{ fontStyle: 'italic', color: colors.textMuted }}>
                        Note: Existing expenses and payments will maintain their recorded currency values and history.
                      </Text>
                    </>
                  )}
                </Text>

                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.cancelConfirmBtn}
                    onPress={() => setShowConfirm(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelConfirmBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptConfirmBtn}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.acceptConfirmBtnText}>Confirm Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
    },
    currencyList: {
      paddingHorizontal: 20,
      maxHeight: 380,
    },
    currencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    currentCurrencyRow: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#F0FDF4',
    },
    symbolBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    symbolBadgeText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    currencyMeta: {
      flex: 1,
      marginLeft: 12,
    },
    currencyCode: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    currencyName: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    decimalsTag: {
      fontSize: 11,
      color: colors.textMuted,
      marginRight: 8,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#D1FAE5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    activePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyContainer: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    confirmOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      borderRadius: 20,
    },
    confirmBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    confirmHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    confirmTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    confirmBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: 10,
    },
    cancelConfirmBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelConfirmBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    acceptConfirmBtn: {
      flex: 1.5,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptConfirmBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
