import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import {
  Shield,
  Lock,
  KeyRound,
  Fingerprint,
  ScanFace,
  ChevronRight,
  Clock,
  Check,
  X,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';
import { useSecurity } from '../../context/SecurityContext';
import { PasscodeKeypadModal, PasscodeMode } from './PasscodeKeypadModal';

interface SecuritySettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', seconds: 0 },
  { label: 'After 1 minute', seconds: 60 },
  { label: 'After 5 minutes', seconds: 300 },
  { label: 'After 15 minutes', seconds: 900 },
];

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const {
    isSecurityEnabled,
    isBiometricsEnabled,
    biometricType,
    hasBiometricHardware,
    isBiometricEnrolled,
    autoLockTimeout,
    setPasscode,
    verifyPasscode,
    removePasscode,
    changePasscode,
    setBiometricsEnabled,
    setAutoLockTimeout,
  } = useSecurity();

  const [keypadVisible, setKeypadVisible] = useState<boolean>(false);
  const [keypadMode, setKeypadMode] = useState<PasscodeMode>('setup');

  const switchTrackColor = {
    false: isDark ? colors.surfaceSecondary : '#E5E7EB',
    true: colors.primary,
  };

  const getSwitchThumbColor = (val: boolean) => {
    if (Platform.OS === 'android') {
      return val ? '#FFFFFF' : '#F4F3F4';
    }
    return '#FFFFFF';
  };

  const handleTogglePasscode = (nextVal: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }

    if (nextVal) {
      // Setup new passcode
      setKeypadMode('setup');
      setKeypadVisible(true);
    } else {
      // Must verify current passcode before disabling
      setKeypadMode('disable');
      setKeypadVisible(true);
    }
  };

  const handleChangePasscodePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setKeypadMode('change');
    setKeypadVisible(true);
  };

  const handleToggleBiometrics = async (nextVal: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    await setBiometricsEnabled(nextVal);
  };

  const handleSelectTimeout = async (seconds: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await setAutoLockTimeout(seconds);
  };

  const getBiometricTitle = () => {
    if (biometricType === 'face') return 'Unlock with Face ID';
    if (biometricType === 'fingerprint') return 'Unlock with Fingerprint';
    return 'Unlock with Biometrics';
  };

  const getBiometricSubtitle = () => {
    if (biometricType === 'face') {
      return 'Unlock Splitwiser using facial recognition';
    }
    if (biometricType === 'fingerprint') {
      return 'Unlock Splitwiser using your fingerprint';
    }
    return 'Unlock Splitwiser using device biometrics';
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Top Header Bar */}
          <View
            style={[
              styles.headerBar,
              {
                paddingTop: Math.max(insets.top, 16),
                borderBottomColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View style={{ width: 40 }} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Passcode</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6' }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityLabel="Close security settings"
              accessibilityRole="button"
            >
              <X size={18} color={colors.textPrimary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Status Hero Card */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
                  borderColor: isSecurityEnabled ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIconCircle,
                  { backgroundColor: isSecurityEnabled ? '#ECFDF5' : isDark ? colors.background : '#F3F4F6' },
                ]}
              >
                <Shield
                  size={28}
                  color={isSecurityEnabled ? '#059669' : colors.textMuted}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={[styles.heroStatusTitle, { color: colors.textPrimary }]}>
                  {isSecurityEnabled ? 'App Protection is Active' : 'App Protection is Off'}
                </Text>
                <Text style={[styles.heroStatusSub, { color: colors.textMuted }]}>
                  {isSecurityEnabled
                    ? isBiometricsEnabled
                      ? `Protected by 4-digit passcode and ${biometricType === 'face' ? 'Face ID' : 'fingerprint'}.`
                      : 'Protected by 4-digit passcode.'
                    : 'Enable passcode to secure your expenses and group balances.'}
                </Text>
              </View>
            </View>

            {/* Section: Passcode & Biometrics */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>APP LOCK</Text>
            </View>

            <View style={[styles.cardGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Passcode Lock Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingIconCol}>
                  <Lock size={20} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={styles.settingMetaCol}>
                  <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Passcode Lock</Text>
                  <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                    Require a 4-digit passcode to open Splitwiser
                  </Text>
                </View>
                <Switch
                  value={isSecurityEnabled}
                  onValueChange={handleTogglePasscode}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(isSecurityEnabled)}
                />
              </View>

              {/* Change Passcode Option (when enabled) */}
              {isSecurityEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={handleChangePasscodePress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Change passcode"
                  >
                    <View style={styles.settingIconCol}>
                      <KeyRound size={20} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={styles.settingMetaCol}>
                      <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Change Passcode</Text>
                      <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                        Update your existing 4-digit passcode
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}

              {/* Biometrics Toggle (when enrolled and passcode enabled) */}
              {isSecurityEnabled && hasBiometricHardware && isBiometricEnrolled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingIconCol}>
                      {biometricType === 'face' ? (
                        <ScanFace size={20} color={colors.primary} strokeWidth={2.2} />
                      ) : (
                        <Fingerprint size={20} color={colors.primary} strokeWidth={2.2} />
                      )}
                    </View>
                    <View style={styles.settingMetaCol}>
                      <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{getBiometricTitle()}</Text>
                      <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                        {getBiometricSubtitle()}
                      </Text>
                    </View>
                    <Switch
                      value={isBiometricsEnabled}
                      onValueChange={handleToggleBiometrics}
                      trackColor={switchTrackColor}
                      thumbColor={getSwitchThumbColor(isBiometricsEnabled)}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Section: Auto-Lock Timeout (when passcode is enabled) */}
            {isSecurityEnabled && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>AUTO-LOCK</Text>
                </View>

                <View style={[styles.cardGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {TIMEOUT_OPTIONS.map((opt, idx) => {
                    const isSelected = autoLockTimeout === opt.seconds;
                    const isLast = idx === TIMEOUT_OPTIONS.length - 1;

                    return (
                      <React.Fragment key={opt.seconds}>
                        <TouchableOpacity
                          style={styles.timeoutRow}
                          onPress={() => handleSelectTimeout(opt.seconds)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.settingIconCol}>
                            <Clock size={18} color={isSelected ? colors.primary : colors.textMuted} strokeWidth={2} />
                          </View>
                          <Text
                            style={[
                              styles.timeoutLabel,
                              {
                                color: isSelected ? colors.primary : colors.textPrimary,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.6} />}
                        </TouchableOpacity>
                        {!isLast && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            )}

            {/* Security Notice Card */}
            <View style={[styles.infoCard, { backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAFC', borderColor: colors.border }]}>
              <Info size={18} color={colors.textMuted} strokeWidth={2} style={{ marginTop: 2, marginRight: 10 }} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                Passcodes are cryptographically hashed using SHA-256 and stored exclusively inside your device's hardware-backed Keystore / Keychain.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Keypad Modal for Setup / Change / Disable */}
      <PasscodeKeypadModal
        visible={keypadVisible}
        mode={keypadMode}
        onClose={() => setKeypadVisible(false)}
        onSuccess={() => {}}
        verifyPasscodeFn={verifyPasscode}
        setPasscodeFn={setPasscode}
        removePasscodeFn={removePasscode}
        changePasscodeFn={changePasscode}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroTextCol: {
    flex: 1,
  },
  heroStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  heroStatusSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingIconCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingMetaCol: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  timeoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timeoutLabel: {
    flex: 1,
    fontSize: 14.5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
});

