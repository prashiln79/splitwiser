import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HAPTICS_STORAGE_KEY = '@splitwiser_haptics_enabled';

class HapticsService {
  private enabled: boolean = true;
  private initialized: boolean = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
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
      this.notifyListeners();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async setEnabled(value: boolean): Promise<void> {
    this.enabled = value;
    this.notifyListeners();
    try {
      await AsyncStorage.setItem(HAPTICS_STORAGE_KEY, value ? 'true' : 'false');
    } catch (e) {
      console.warn('[HapticsService] Failed to persist haptics preference:', e);
    }

    // Trigger subtle confirmation buzz when turning ON
    if (value && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    Haptics.impactAsync(style).catch(() => {});
  }

  public notification(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success): void {
    if (!this.enabled || Platform.OS === 'web') return;
    Haptics.notificationAsync(type).catch(() => {});
  }

  public selection(): void {
    if (!this.enabled || Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  }
}

export const hapticsService = new HapticsService();

