import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../theme';

interface TypedConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  expectedWord?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export const TypedConfirmDialog: React.FC<TypedConfirmDialogProps> = ({
  visible,
  title,
  description,
  expectedWord = 'DELETE',
  confirmLabel = 'Delete Permanently',
  isLoading = false,
  onCancel,
  onConfirm,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [typedText, setTypedText] = useState('');

  const isMatched = typedText.trim().toUpperCase() === expectedWord.toUpperCase();

  const handleConfirmPress = async () => {
    if (!isMatched || isLoading) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    await onConfirm();
    setTypedText('');
  };

  const handleCancelPress = () => {
    setTypedText('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancelPress}>
      <View style={styles.backdrop}>
        <View style={styles.dialogBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.warningIconWrapper}>
              <AlertTriangle size={24} color="#DC2626" strokeWidth={2.3} />
            </View>
            <TouchableOpacity onPress={handleCancelPress} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.instruction}>
              Please type <Text style={styles.boldTarget}>{expectedWord}</Text> to confirm:
            </Text>
            <TextInput
              style={styles.textInput}
              value={typedText}
              onChangeText={setTypedText}
              placeholder={`Type "${expectedWord}"`}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelPress}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!isMatched || isLoading) && styles.disabledBtn]}
              onPress={handleConfirmPress}
              disabled={!isMatched || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
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
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialogBox: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.2,
      shadowRadius: 12,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    warningIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      padding: 6,
      borderRadius: 14,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    description: {
      fontSize: 13.5,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 16,
    },
    inputWrapper: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
    },
    instruction: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
    },
    boldTarget: {
      fontWeight: '800',
      color: '#DC2626',
      letterSpacing: 0.5,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmBtn: {
      flex: 1.4,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#DC2626',
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    disabledBtn: {
      backgroundColor: isDark ? '#7F1D1D' : '#FCA5A5',
      opacity: 0.6,
    },
  });

