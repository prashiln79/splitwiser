import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HAPTICS_STORAGE_KEY = '@splitwiser_haptics_enabled';

// Store raw unpatched native functions so hapticsService can invoke raw haptics when enabling
const rawImpactAsync = Haptics.impactAsync;
const rawNotificationAsync = Haptics.notificationAsync;
const rawSelectionAsync = Haptics.selectionAsync;

class HapticsService {
  private enabled: boolean = true;
  private initialized: boolean = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    this.patchGlobalHaptics();
    this.init();
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(HAPTICS_STORAGE_KEY);
      if (stored !== null) {
        this.enabled = stored === 'true';
      } else {
        this.enabled = true; // Default to ON
      }
    } catch {
      this.enabled = true;
    } finally {
      this.initialized = true;
      this.patchGlobalHaptics();
      this.notifyListeners();
    }
  }

  private patchGlobalHaptics(): void {
    try {
      // 1. Patch the expo-haptics JS export object
      (Haptics as any).impactAsync = async (style = Haptics.ImpactFeedbackStyle.Medium) => {
        if (!this.enabled || Platform.OS === 'web') return;
        return rawImpactAsync?.(style);
      };
      (Haptics as any).notificationAsync = async (type = Haptics.NotificationFeedbackType.Success) => {
        if (!this.enabled || Platform.OS === 'web') return;
        return rawNotificationAsync?.(type);
      };
      (Haptics as any).selectionAsync = async () => {
        if (!this.enabled || Platform.OS === 'web') return;
        return rawSelectionAsync?.();
      };

      // 2. Patch TurboModule / NativeModule if available
      const nativeExpo = (globalThis as any).expo?.modules?.ExpoHaptics;
      if (nativeExpo && !nativeExpo.__splitwiserPatched) {
        nativeExpo.__splitwiserPatched = true;
        const nativeImpact = nativeExpo.impactAsync?.bind(nativeExpo);
        if (nativeImpact) {
          nativeExpo.impactAsync = async (...args: any[]) => {
            if (!this.enabled || Platform.OS === 'web') return;
            return nativeImpact(...args);
          };
        }
        const nativeNotif = nativeExpo.notificationAsync?.bind(nativeExpo);
        if (nativeNotif) {
          nativeExpo.notificationAsync = async (...args: any[]) => {
            if (!this.enabled || Platform.OS === 'web') return;
            return nativeNotif(...args);
          };
        }
        const nativeSel = nativeExpo.selectionAsync?.bind(nativeExpo);
        if (nativeSel) {
          nativeExpo.selectionAsync = async (...args: any[]) => {
            if (!this.enabled || Platform.OS === 'web') return;
            return nativeSel(...args);
          };
        }
      }
    } catch (e) {
      // Non-blocking in environments where exports are frozen
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(value: boolean): void {
    if (this.enabled === value) return;
    this.enabled = value;
    this.patchGlobalHaptics();
    this.notifyListeners();

    // Persist to storage asynchronously
    AsyncStorage.setItem(HAPTICS_STORAGE_KEY, value ? 'true' : 'false').catch((e) => {
      console.warn('[HapticsService] Failed to persist haptics preference:', e);
    });

    // Trigger subtle confirmation buzz when turning ON
    if (value && Platform.OS !== 'web') {
      rawImpactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.enabled);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.enabled);
      } catch {}
    });
  }

  public impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
    if (!this.enabled || Platform.OS === 'web') return;
    rawImpactAsync?.(style).catch(() => {});
  }

  public notification(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success): void {
    if (!this.enabled || Platform.OS === 'web') return;
    rawNotificationAsync?.(type).catch(() => {});
  }

  public selection(): void {
    if (!this.enabled || Platform.OS === 'web') return;
    rawSelectionAsync?.().catch(() => {});
  }
}

export const hapticsService = new HapticsService();

