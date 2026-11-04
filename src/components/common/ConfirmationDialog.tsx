import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, Trash2, LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography, spacing, radii, shadows } from '../../theme';

interface ConfirmationDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  icon?: 'warning' | 'trash' | 'logout';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  onDismiss,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  icon = 'warning',
}) => {
  const { colors } = useAppTheme();

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDismiss();
  };

  const IconComp =
    icon === 'trash' ? Trash2 : icon === 'logout' ? LogOut : AlertTriangle;
  const iconColor = isDestructive ? colors.expense : colors.warning;
  const iconBg = isDestructive ? colors.expenseLight : colors.warningLight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            shadows.lg,
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <IconComp size={28} color={iconColor} strokeWidth={2.2} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              onPress={handleCancel}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: isDestructive ? colors.expense : colors.primary },
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: typography.lineHeights.sm,
    marginBottom: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: typography.sizes.sm,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
});

