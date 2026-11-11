import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Delete, Shield, Fingerprint, ScanFace } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';
import { useSecurity } from '../../context/SecurityContext';

export const AppLockOverlay: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const {
    isSecurityEnabled,
    isBiometricsEnabled,
    biometricType,
    isAppLocked,
    unlockApp,
    verifyPasscode,
    authenticateWithBiometrics,
  } = useSecurity();

  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hasPromptedBioRef = useRef<boolean>(false);

  // Auto-prompt biometrics once on lock
  useEffect(() => {
    if (isAppLocked && isBiometricsEnabled && !hasPromptedBioRef.current && lockoutSeconds === 0) {
      hasPromptedBioRef.current = true;
      const timer = setTimeout(() => {
        authenticateWithBiometrics().catch(() => {});
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isAppLocked, isBiometricsEnabled, lockoutSeconds, authenticateWithBiometrics]);

  // Reset biometric prompt trigger when app becomes unlocked
  useEffect(() => {
    if (!isAppLocked) {
      hasPromptedBioRef.current = false;
      setPin('');
      setErrorMessage('');
    }
  }, [isAppLocked]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

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
    if (lockoutSeconds > 0 || isVerifying || pin.length >= 4) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const nextPin = pin + num;
    setPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      handleComplete(nextPin);
    }
  };

  const handleDelete = () => {
    if (lockoutSeconds > 0 || isVerifying || pin.length === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleComplete = async (completedPin: string) => {
    setIsVerifying(true);
    const isValid = await verifyPasscode(completedPin);

    if (isValid) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setPin('');
      setFailedAttempts(0);
      setErrorMessage('');
      unlockApp();
      setIsVerifying(false);
    } else {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      triggerShake();
      setPin('');
      setIsVerifying(false);

      if (nextFailed >= 5) {
        setLockoutSeconds(30);
        setErrorMessage('Too many failed attempts. Try again in 30s.');
      } else {
        const remaining = 5 - nextFailed;
        setErrorMessage(`Incorrect passcode. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
      }
    }
  };

  const handleBiometricPress = () => {
    if (lockoutSeconds > 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    authenticateWithBiometrics().catch(() => {});
  };

  if (!isSecurityEnabled || !isAppLocked) {
    return null;
  }

  return (
    <View
      style={[
        styles.overlayContainer,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 24, 48),
          paddingBottom: Math.max(insets.bottom + 16, 32),
        },
      ]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Brand & Shield Icon */}
      <View style={styles.topSection}>
        <View style={[styles.shieldCircle, { backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5' }]}>
          <Shield size={36} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Splitwiser is Locked</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {lockoutSeconds > 0
            ? `Please wait ${lockoutSeconds}s before trying again`
            : 'Enter your 4-digit passcode to continue'}
        </Text>
      </View>

      {/* Error Message */}
      <View style={styles.errorContainer}>
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <Text style={styles.errorTextInvisible}>Placeholder</Text>
        )}
      </View>

      {/* 4 PIN Dots */}
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

      {/* Keypad */}
      <View style={styles.keypadContainer}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['bio', '0', 'del'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, colIndex) => {
              if (key === 'bio') {
                if (!isBiometricsEnabled || lockoutSeconds > 0) {
                  return <View key={colIndex} style={styles.keypadCellEmpty} />;
                }
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={styles.keypadCell}
                    onPress={handleBiometricPress}
                    activeOpacity={0.6}
                    accessibilityLabel="Unlock with Biometrics"
                    accessibilityRole="button"
                  >
                    {biometricType === 'face' ? (
                      <ScanFace size={28} color={colors.primary} strokeWidth={2.2} />
                    ) : (
                      <Fingerprint size={28} color={colors.primary} strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>
                );
              }

              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={styles.keypadCell}
                    onPress={handleDelete}
                    disabled={lockoutSeconds > 0}
                    activeOpacity={0.6}
                    accessibilityLabel="Delete digit"
                    accessibilityRole="button"
                  >
                    <Delete size={26} color={lockoutSeconds > 0 ? colors.border : colors.textPrimary} strokeWidth={2} />
                  </TouchableOpacity>
                );
              }

              const isDisabled = lockoutSeconds > 0;
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[
                    styles.keypadCell,
                    styles.keypadDigitCell,
                    {
                      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
                      opacity: isDisabled ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => handleKeyPress(key)}
                  disabled={isDisabled}
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
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  shieldCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorTextInvisible: {
    opacity: 0,
    fontSize: 13.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginBottom: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  keypadCell: {
    flex: 1,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
  },
  keypadDigitCell: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  keypadCellEmpty: {
    flex: 1,
  },
  keypadDigitText: {
    fontSize: 26,
    fontWeight: '600',
  },
});
