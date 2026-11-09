import React, { useState } from 'react';
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
              <X size={18} color="#6B7280" />
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
              placeholderTextColor="#9CA3AF"
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
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
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  description: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 16,
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  instruction: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  boldTarget: {
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
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
    backgroundColor: '#FCA5A5',
  },
});

