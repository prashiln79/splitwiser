import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { X, ArrowRight, RefreshCw, AlertCircle, Check, DollarSign } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors } from '../../theme';
import {
  SUPPORTED_CURRENCIES,
  getCurrencySymbol,
  getCurrencyName,
  normalizeCurrencyCode,
  toMinorUnit,
  isValidFinancialAmount,
} from '../../utils/currency';
import { convertCurrencyAmount, getExchangeRate, ExchangeRateResult } from '../../services/exchangeRateService';
import { recordConversionLocal } from '../../repositories/conversionRepository';
import { GroupMember } from '../../types';

export interface CurrencyConversionModalProps {
  visible: boolean;
  groupId: string;
  currentUserId: string;
  availableSourceCurrencies: string[];
  initialSourceCurrency?: string;
  defaultTargetCurrency?: string;
  members?: GroupMember[];
  onClose?: () => void;
  onDismiss?: () => void;
  onSuccess?: () => void;
  onConversionSuccess?: () => void;
}

export const CurrencyConversionModal: React.FC<CurrencyConversionModalProps> = ({
  visible,
  groupId,
  currentUserId,
  availableSourceCurrencies,
  initialSourceCurrency = 'INR',
  defaultTargetCurrency = 'USD',
  members,
  onClose,
  onDismiss,
  onSuccess,
  onConversionSuccess,
}) => {
  const handleClose = onClose || onDismiss || (() => {});
  const handleSuccess = onSuccess || onConversionSuccess || (() => {});
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const bottomPadding = useMemo(() => {
    const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16);
    return bottomInset + 12;
  }, [insets.bottom]);

  const sources = useMemo(() => {
    const list = availableSourceCurrencies.length > 0 ? availableSourceCurrencies : ['INR', 'USD'];
    return Array.from(new Set(list.map(normalizeCurrencyCode)));
  }, [availableSourceCurrencies]);

  const [sourceCurrency, setSourceCurrency] = useState(
    normalizeCurrencyCode(initialSourceCurrency)
  );
  const [targetCurrency, setTargetCurrency] = useState(
    normalizeCurrencyCode(defaultTargetCurrency)
  );
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateInfo, setRateInfo] = useState<ExchangeRateResult | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial source currency
  useEffect(() => {
    if (visible) {
      const src = sources.includes(normalizeCurrencyCode(initialSourceCurrency))
        ? normalizeCurrencyCode(initialSourceCurrency)
        : sources[0] || 'INR';
      setSourceCurrency(src);
      // Pick a default target different from source
      if (src === 'INR') {
        setTargetCurrency('USD');
      } else {
        setTargetCurrency('INR');
      }
    }
  }, [visible, initialSourceCurrency, sources]);

  // Fetch exchange rate whenever source or target changes
  useEffect(() => {
    if (!visible) return;
    if (sourceCurrency === targetCurrency) {
      setRateInfo({
        baseCurrency: sourceCurrency,
        targetCurrency: targetCurrency,
        rate: 1.0,
        rateTimestamp: Date.now(),
        source: 'live',
        isStale: false,
      });
      setRateError(null);
      return;
    }

    let isMounted = true;
    setIsLoadingRate(true);
    setRateError(null);

    getExchangeRate(sourceCurrency, targetCurrency)
      .then((res) => {
        if (!isMounted) return;
        setRateInfo(res);
      })
      .catch((err) => {
        if (!isMounted) return;
        setRateError(err.message || 'Unable to fetch rate.');
        setRateInfo(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRate(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, sourceCurrency, targetCurrency]);

  const numericAmount = parseFloat(amount) || 0;
  const convertedAmount = rateInfo ? numericAmount * rateInfo.rate : 0;

  const handleSwapCurrencies = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const temp = sourceCurrency;
    setSourceCurrency(targetCurrency);
    setTargetCurrency(temp);
  };

  const handleConfirmConversion = async () => {
    const val = isValidFinancialAmount(numericAmount, sourceCurrency);
    if (!val.isValid) {
      Alert.alert('Invalid Amount', val.errorMessage || 'Please enter a valid amount.');
      return;
    }

    if (!rateInfo || rateInfo.rate <= 0) {
      Alert.alert('Rate Unavailable', 'An active exchange rate is required to convert.');
      return;
    }

    if (sourceCurrency === targetCurrency) {
      Alert.alert('Same Currency', 'Please select different source and target currencies.');
      return;
    }

    const sourceMinor = toMinorUnit(numericAmount, sourceCurrency);
    const targetMinor = toMinorUnit(convertedAmount, targetCurrency);

    setIsSubmitting(true);
    try {
      await recordConversionLocal(
        groupId,
        currentUserId,
        sourceCurrency,
        targetCurrency,
        sourceMinor,
        targetMinor,
        rateInfo.rate,
        rateInfo.rateTimestamp,
        rateInfo.source,
        note.trim() || undefined
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert(
        'Currency Converted',
        `Successfully recorded conversion of ${getCurrencySymbol(sourceCurrency)}${numericAmount.toFixed(2)} ${sourceCurrency} to ${getCurrencySymbol(targetCurrency)}${convertedAmount.toFixed(2)} ${targetCurrency}.`
      );

      handleClose();
      handleSuccess();
    } catch (err: any) {
      Alert.alert('Conversion Failed', err.message || 'Could not record conversion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeAgoStr = useMemo(() => {
    if (!rateInfo) return '';
    const diffSec = Math.floor((Date.now() - rateInfo.rateTimestamp) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  }, [rateInfo]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheetContainer, { paddingBottom: bottomPadding }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Convert Currency</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Free service badge */}
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>100% Free · No Conversion Fees</Text>
            </View>

            {/* Currency Pair Selectors */}
            <View style={styles.pairRow}>
              {/* Source Picker */}
              <View style={styles.currencyBlock}>
                <Text style={styles.blockLabel}>FROM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {sources.map((cur) => {
                    const isSelected = cur === sourceCurrency;
                    return (
                      <TouchableOpacity
                        key={cur}
                        style={[styles.curChip, isSelected && styles.curChipSelected]}
                        onPress={() => setSourceCurrency(cur)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.curChipText, isSelected && styles.curChipTextSelected]}>
                          {cur}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <TouchableOpacity style={styles.swapBtn} onPress={handleSwapCurrencies} activeOpacity={0.7}>
                <RefreshCw size={18} color={colors.primary} />
              </TouchableOpacity>

              {/* Target Picker */}
              <View style={styles.currencyBlock}>
                <Text style={styles.blockLabel}>TO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {SUPPORTED_CURRENCIES.slice(0, 8).map((cur) => {
                    const isSelected = cur.code === targetCurrency;
                    return (
                      <TouchableOpacity
                        key={cur.code}
                        style={[styles.curChip, isSelected && styles.curChipSelected]}
                        onPress={() => setTargetCurrency(cur.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.curChipText, isSelected && styles.curChipTextSelected]}>
                          {cur.code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Amount input */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>AMOUNT TO CONVERT</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.amountSymbol}>{getCurrencySymbol(sourceCurrency)}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.amountCode}>{sourceCurrency}</Text>
              </View>
            </View>

            {/* Rate & Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.rateHeader}>
                <Text style={styles.rateLabel}>EXCHANGE RATE</Text>
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceTagText}>
                    {rateInfo?.source === 'live' ? 'Live Rate' : 'Cached Rate'} ({timeAgoStr})
                  </Text>
                </View>
              </View>

              {isLoadingRate ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    Fetching exchange rate...
                  </Text>
                </View>
              ) : rateError ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{rateError}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.rateValue}>
                    1 {sourceCurrency} = {rateInfo?.rate.toFixed(4)} {targetCurrency}
                  </Text>

                  {numericAmount > 0 && (
                    <View style={styles.conversionPreview}>
                      <View style={styles.previewCol}>
                        <Text style={styles.previewSub}>You convert</Text>
                        <Text style={styles.previewMain}>
                          {getCurrencySymbol(sourceCurrency)}
                          {numericAmount.toFixed(2)} {sourceCurrency}
                        </Text>
                      </View>
                      <ArrowRight size={20} color={colors.primary} style={{ marginHorizontal: 8 }} />
                      <View style={styles.previewCol}>
                        <Text style={styles.previewSub}>You get</Text>
                        <Text style={[styles.previewMain, { color: colors.income }]}>
                          {getCurrencySymbol(targetCurrency)}
                          {convertedAmount.toFixed(2)} {targetCurrency}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Note Input */}
            <View style={styles.noteBox}>
              <TextInput
                style={styles.noteInput}
                placeholder="Optional conversion note (e.g. Bank exchange, Wire transfer)"
                placeholderTextColor={colors.textMuted}
                value={note}
                onChangeText={setNote}
                maxLength={120}
              />
            </View>

            {/* Notice */}
            <Text style={styles.disclaimerText}>
              Note: Explicit currency conversion balances your debt between currencies. Original expenses maintain their recorded currencies.
            </Text>

            {/* Actions */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (numericAmount <= 0 || !rateInfo || isSubmitting) && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirmConversion}
              disabled={numericAmount <= 0 || !rateInfo || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Currency Conversion</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    freeBadge: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      alignSelf: 'center',
      marginBottom: 14,
    },
    freeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    pairRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    currencyBlock: {
      flex: 1,
    },
    blockLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
    },
    chipScroll: {
      flexDirection: 'row',
    },
    curChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
    },
    curChipSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#F0FAF6',
    },
    curChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    curChipTextSelected: {
      fontWeight: '700',
      color: colors.primary,
    },
    swapBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    inputCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    amountSymbol: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingVertical: 2,
    },
    amountCode: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      marginLeft: 6,
    },
    previewCard: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    rateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    rateLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    sourceTag: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    sourceTagText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    rateValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    conversionPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    previewCol: {
      flex: 1,
    },
    previewSub: {
      fontSize: 11,
      color: colors.textMuted,
    },
    previewMain: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    errorText: {
      fontSize: 13,
      color: '#DC2626',
    },
    noteBox: {
      marginBottom: 14,
    },
    noteInput: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.textPrimary,
    },
    disclaimerText: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
      marginBottom: 16,
      textAlign: 'center',
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    confirmBtnDisabled: {
      opacity: 0.5,
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
