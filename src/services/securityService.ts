import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BiometricType,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  AUTO_LOCK_TIMEOUT_OPTIONS,
  generateSalt,
  hashPasscode,
  isValidPinFormat,
  isLockoutTriggered,
  getRemainingAttempts,
} from '../utils/securityUtils';

export {
  BiometricType,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  AUTO_LOCK_TIMEOUT_OPTIONS,
  generateSalt,
  hashPasscode,
  isValidPinFormat,
  isLockoutTriggered,
  getRemainingAttempts,
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const CONFIG_KEY = '@splitwiser:security_config';
const PIN_HASH_KEY = 'splitwiser_security_pin_hash';
const PIN_SALT_KEY = 'splitwiser_security_pin_salt';

// ─── Secure Storage Helpers ───────────────────────────────────────────────────
async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {}
  await AsyncStorage.setItem(key, value);
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
    }
  } catch {}
  return await AsyncStorage.getItem(key);
}

async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {}
  await AsyncStorage.removeItem(key);
}

// ─── Biometric Hardware Detection ─────────────────────────────────────────────
export async function detectBiometrics(): Promise<{
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricType: BiometricType;
}> {
  if (Platform.OS === 'web') {
    return { hasHardware: false, isEnrolled: false, biometricType: 'none' };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { hasHardware: false, isEnrolled: false, biometricType: 'none' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = 'none';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'face';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris';
    } else if (hasHardware) {
      biometricType = 'fingerprint';
    }

    return {
      hasHardware,
      isEnrolled,
      biometricType,
    };
  } catch (e) {
    console.warn('[securityService] Biometric detection notice:', e);
    return { hasHardware: false, isEnrolled: false, biometricType: 'none' };
  }
}

export async function promptBiometricAuth(promptMessage?: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Unlock Splitwiser',
      cancelLabel: 'Use Passcode',
      disableDeviceFallback: true, // Keypad passcode is handled by our app
    });

    return result.success;
  } catch (e) {
    console.warn('[securityService] Biometric authentication error:', e);
    return false;
  }
}

// ─── Security Configuration Management ────────────────────────────────────────
export async function getSecurityConfig(): Promise<SecurityConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_SECURITY_CONFIG;
    return { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SECURITY_CONFIG;
  }
}

export async function saveSecurityConfig(
  updates: Partial<SecurityConfig>
): Promise<SecurityConfig> {
  const current = await getSecurityConfig();
  const merged: SecurityConfig = { ...current, ...updates };
  try {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('[securityService] Save config notice:', e);
  }
  return merged;
}

// ─── Passcode Lifecycle ───────────────────────────────────────────────────────
export async function setPasscode(pin: string): Promise<boolean> {
  if (!pin || pin.length !== 4) return false;

  try {
    const salt = generateSalt();
    const hash = await hashPasscode(pin, salt);

    await setSecureItem(PIN_SALT_KEY, salt);
    await setSecureItem(PIN_HASH_KEY, hash);

    await saveSecurityConfig({ isSecurityEnabled: true });
    return true;
  } catch (e) {
    console.warn('[securityService] Failed to set passcode:', e);
    return false;
  }
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  if (!pin || pin.length !== 4) return false;

  try {
    const [salt, storedHash] = await Promise.all([
      getSecureItem(PIN_SALT_KEY),
      getSecureItem(PIN_HASH_KEY),
    ]);

    if (!salt || !storedHash) return false;

    const computedHash = await hashPasscode(pin, salt);
    return computedHash === storedHash;
  } catch (e) {
    console.warn('[securityService] Failed to verify passcode:', e);
    return false;
  }
}

export async function removePasscode(currentPin: string): Promise<boolean> {
  const isValid = await verifyPasscode(currentPin);
  if (!isValid) return false;

  try {
    await deleteSecureItem(PIN_SALT_KEY);
    await deleteSecureItem(PIN_HASH_KEY);

    await saveSecurityConfig({
      isSecurityEnabled: false,
      isBiometricsEnabled: false,
    });
    return true;
  } catch (e) {
    console.warn('[securityService] Failed to remove passcode:', e);
    return false;
  }
}

export async function changePasscode(
  currentPin: string,
  newPin: string
): Promise<boolean> {
  const isValid = await verifyPasscode(currentPin);
  if (!isValid) return false;

  return await setPasscode(newPin);
}
