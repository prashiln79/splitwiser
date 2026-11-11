import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  BiometricType,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  detectBiometrics,
  promptBiometricAuth,
  getSecurityConfig,
  saveSecurityConfig,
  setPasscode as serviceSetPasscode,
  verifyPasscode as serviceVerifyPasscode,
  removePasscode as serviceRemovePasscode,
  changePasscode as serviceChangePasscode,
} from '../services/securityService';

export interface SecurityContextType {
  isSecurityEnabled: boolean;
  isBiometricsEnabled: boolean;
  biometricType: BiometricType;
  hasBiometricHardware: boolean;
  isBiometricEnrolled: boolean;
  autoLockTimeout: number;
  isAppLocked: boolean;
  isInitialized: boolean;
  unlockApp: () => void;
  lockApp: () => void;
  setPasscode: (pin: string) => Promise<boolean>;
  verifyPasscode: (pin: string) => Promise<boolean>;
  removePasscode: (currentPin: string) => Promise<boolean>;
  changePasscode: (currentPin: string, newPin: string) => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
  setAutoLockTimeout: (seconds: number) => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_SECURITY_CONFIG);
  const [hasBiometricHardware, setHasBiometricHardware] = useState<boolean>(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const lastActiveTimestampRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

  // Initialize Security on startup
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [bio, loadedConfig] = await Promise.all([
          detectBiometrics(),
          getSecurityConfig(),
        ]);

        if (!isMounted) return;

        setHasBiometricHardware(bio.hasHardware);
        setIsBiometricEnrolled(bio.isEnrolled);
        setBiometricType(bio.biometricType);
        setConfig(loadedConfig);

        // If security is enabled, lock app on cold start
        if (loadedConfig.isSecurityEnabled) {
          setIsAppLocked(true);
        }
      } catch (e) {
        console.warn('[SecurityContext] Initialization notice:', e);
      } finally {
        if (isMounted) setIsInitialized(true);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to AppState lifecycle (background -> active auto-lock check)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextAppState;

      if (prev === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background
        lastActiveTimestampRef.current = Date.now();
      } else if (prev.match(/inactive|background/) && nextAppState === 'active') {
        // App returned to foreground
        if (config.isSecurityEnabled) {
          const elapsedSec = (Date.now() - lastActiveTimestampRef.current) / 1000;
          if (config.autoLockTimeout === 0 || elapsedSec >= config.autoLockTimeout) {
            setIsAppLocked(true);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [config.isSecurityEnabled, config.autoLockTimeout]);

  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
    lastActiveTimestampRef.current = Date.now();
  }, []);

  const lockApp = useCallback(() => {
    if (config.isSecurityEnabled) {
      setIsAppLocked(true);
    }
  }, [config.isSecurityEnabled]);

  const handleSetPasscode = useCallback(async (pin: string): Promise<boolean> => {
    const success = await serviceSetPasscode(pin);
    if (success) {
      const updated = await saveSecurityConfig({ isSecurityEnabled: true });
      setConfig(updated);
      setIsAppLocked(false);
    }
    return success;
  }, []);

  const handleVerifyPasscode = useCallback(async (pin: string): Promise<boolean> => {
    return await serviceVerifyPasscode(pin);
  }, []);

  const handleRemovePasscode = useCallback(async (currentPin: string): Promise<boolean> => {
    const success = await serviceRemovePasscode(currentPin);
    if (success) {
      setConfig({
        isSecurityEnabled: false,
        isBiometricsEnabled: false,
        autoLockTimeout: 0,
      });
      setIsAppLocked(false);
    }
    return success;
  }, []);

  const handleChangePasscode = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    return await serviceChangePasscode(currentPin, newPin);
  }, []);

  const handleSetBiometricsEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      // Must successfully authenticate before enabling
      const success = await promptBiometricAuth('Verify your identity to enable biometrics');
      if (!success) return false;
    }

    const updated = await saveSecurityConfig({ isBiometricsEnabled: enabled });
    setConfig(updated);
    return true;
  }, []);

  const handleSetAutoLockTimeout = useCallback(async (seconds: number): Promise<void> => {
    const updated = await saveSecurityConfig({ autoLockTimeout: seconds });
    setConfig(updated);
  }, []);

  const handleAuthenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!config.isBiometricsEnabled) return false;
    const success = await promptBiometricAuth('Unlock Splitwiser');
    if (success) {
      unlockApp();
    }
    return success;
  }, [config.isBiometricsEnabled, unlockApp]);

  const value: SecurityContextType = {
    isSecurityEnabled: config.isSecurityEnabled,
    isBiometricsEnabled: config.isBiometricsEnabled,
    biometricType,
    hasBiometricHardware,
    isBiometricEnrolled,
    autoLockTimeout: config.autoLockTimeout,
    isAppLocked,
    isInitialized,
    unlockApp,
    lockApp,
    setPasscode: handleSetPasscode,
    verifyPasscode: handleVerifyPasscode,
    removePasscode: handleRemovePasscode,
    changePasscode: handleChangePasscode,
    setBiometricsEnabled: handleSetBiometricsEnabled,
    setAutoLockTimeout: handleSetAutoLockTimeout,
    authenticateWithBiometrics: handleAuthenticateWithBiometrics,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
