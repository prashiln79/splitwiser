import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Delete, X, Shield, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';

export type PasscodeMode = 'setup' | 'change' | 'disable' | 'verify';

interface PasscodeKeypadModalProps {
  visible: boolean;
  mode: PasscodeMode;
  onClose: () => void;
  onSuccess: () => void;
  verifyPasscodeFn: (pin: string) => Promise<boolean>;
  setPasscodeFn?: (pin: string) => Promise<boolean>;
  removePasscodeFn?: (currentPin: string) => Promise<boolean>;
  changePasscodeFn?: (currentPin: string, newPin: string) => Promise<boolean>;
}

export const PasscodeKeypadModal: React.FC<PasscodeKeypadModalProps> = ({
  visible,
  mode,
  onClose,
  onSuccess,
  verifyPasscodeFn,
  setPasscodeFn,
  removePasscodeFn,
  changePasscodeFn,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Step states:
  // 'setup': 1 (enter new) -> 2 (confirm new)
  // 'change': 1 (enter current) -> 2 (enter new) -> 3 (confirm new)
  // 'disable': 1 (enter current)
  // 'verify': 1 (enter current)
  const [step, setStep] = useState<number>(1);
  const [pin, setPin] = useState<string>('');
  const [tempNewPin, setTempNewPin] = useState<string>('');
  const [currentPin, setCurrentPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep(1);
      setPin('');
      setTempNewPin('');
      setCurrentPin('');
      setErrorMessage('');
      setIsProcessing(false);
    }
  }, [visible, mode]);

  const triggerShake = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= 4 || isProcessing) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const nextPin = pin + num;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      handlePinComplete(nextPin);
    }
  };

  const handleDelete = () => {
    if (pin.length === 0 || isProcessing) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handlePinComplete = async (completedPin: string) => {
    setIsProcessing(true);

    if (mode === 'setup') {
      if (step === 1) {
        setTempNewPin(completedPin);
        setPin('');
        setStep(2);
        setIsProcessing(false);
      } else if (step === 2) {
        if (completedPin === tempNewPin) {
          if (setPasscodeFn) {
            const ok = await setPasscodeFn(completedPin);
            if (ok) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              onSuccess();
              onClose();
              return;
            }
          }
          setErrorMessage('Failed to save passcode. Try again.');
          triggerShake();
          setPin('');
          setIsProcessing(false);
        } else {
          setErrorMessage("Passcodes didn't match. Try again.");
          triggerShake();
          setPin('');
          setStep(1);
          setTempNewPin('');
          setIsProcessing(false);
        }
      }
    } else if (mode === 'change') {
      if (step === 1) {
        // Verify current PIN
        const isValid = await verifyPasscodeFn(completedPin);
        if (isValid) {
          setCurrentPin(completedPin);
          setPin('');
          setStep(2);
          setIsProcessing(false);
        } else {
          setErrorMessage('Incorrect current passcode.');
          triggerShake();
          setPin('');
          setIsProcessing(false);
        }
      } else if (step === 2) {
        setTempNewPin(completedPin);
        setPin('');
        setStep(3);
        setIsProcessing(false);
      } else if (step === 3) {
        if (completedPin === tempNewPin) {
          if (changePasscodeFn) {
            const ok = await changePasscodeFn(currentPin, completedPin);
            if (ok) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              onSuccess();
              onClose();
              return;
            }
          }
          setErrorMessage('Failed to update passcode. Try again.');
          triggerShake();
          setPin('');
          setIsProcessing(false);
        } else {
          setErrorMessage("Passcodes didn't match. Try again.");
          triggerShake();
          setPin('');
          setStep(2);
          setTempNewPin('');
          setIsProcessing(false);
        }
      }
    } else if (mode === 'disable') {
      if (removePasscodeFn) {
        const ok = await removePasscodeFn(completedPin);
        if (ok) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          onSuccess();
          onClose();
          return;
        }
      }
      setErrorMessage('Incorrect passcode.');
      triggerShake();
      setPin('');
      setIsProcessing(false);
    } else if (mode === 'verify') {
      const isValid = await verifyPasscodeFn(completedPin);
      if (isValid) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        onSuccess();
        onClose();
      } else {
        setErrorMessage('Incorrect passcode.');
        triggerShake();
        setPin('');
        setIsProcessing(false);
      }
    }
  };

  const getTitle = () => {
    if (mode === 'setup') {
      return step === 1 ? 'Create a 4-Digit Passcode' : 'Confirm Your Passcode';
    }
    if (mode === 'change') {
      if (step === 1) return 'Enter Current Passcode';
      if (step === 2) return 'Enter New Passcode';
      return 'Confirm New Passcode';
    }
    if (mode === 'disable') {
      return 'Turn Off Passcode Lock';
    }
    return 'Enter Passcode';
  };

  const getSubtitle = () => {
    if (mode === 'setup') {
      return step === 1
        ? 'Protect your personal balances and financial history'
        : 'Re-enter your 4-digit passcode to confirm';
    }
    if (mode === 'change') {
      if (step === 1) return 'Verify your identity before changing passcode';
      if (step === 2) return 'Choose a new 4-digit passcode';
      return 'Re-enter your new passcode to confirm';
    }
    if (mode === 'disable') {
      return 'Enter your current passcode to disable app lock';
    }
    return 'Enter your 4-digit passcode to continue';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom + 16, 32),
            },
          ]}
        >
          {/* Top Bar / Close Button */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textPrimary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5' }]}>
            <Shield size={32} color={colors.primary} strokeWidth={2.2} />
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{getTitle()}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{getSubtitle()}</Text>

          {/* Error Message */}
          <View style={styles.errorContainer}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : (
              <Text style={styles.errorTextInvisible}>Placeholder</Text>
            )}
          </View>

          {/* 4 PIN Indicator Dots */}
          <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      borderColor: isFilled ? colors.primary : colors.border,
                      backgroundColor: isFilled ? colors.primary : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Numeric Keypad */}
          <View style={styles.keypadContainer}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['', '0', 'del'],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key, colIndex) => {
                  if (key === '') {
                    return <View key={colIndex} style={styles.keypadCellEmpty} />;
                  }

                  if (key === 'del') {
                    return (
                      <TouchableOpacity
                        key={colIndex}
                        style={styles.keypadCell}
                        onPress={handleDelete}
                        activeOpacity={0.6}
                        accessibilityLabel="Delete digit"
                        accessibilityRole="button"
                      >
                        <Delete size={26} color={colors.textPrimary} strokeWidth={2} />
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={colIndex}
                      style={[
                        styles.keypadCell,
                        styles.keypadDigitCell,
                        { backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC' },
                      ]}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.6}
                      accessibilityLabel={`Digit ${key}`}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.keypadDigitText, { color: colors.textPrimary }]}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 19,
    marginBottom: 10,
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  errorTextInvisible: {
    opacity: 0,
    fontSize: 13,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 14,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  keypadCell: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
  keypadDigitCell: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  keypadCellEmpty: {
    flex: 1,
  },
  keypadDigitText: {
    fontSize: 25,
    fontWeight: '600',
  },
});

