import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkCallback = (isConnected: boolean) => void;

class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<NetworkCallback> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    NetInfo.fetch().then((state) => {
      this.updateState(state);
    });

    NetInfo.addEventListener((state) => {
      this.updateState(state);
    });
  }

  private updateState(state: NetInfoState) {
    const connected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.isConnected);
      } catch (e) {
        console.error('[NetworkMonitor] listener error:', e);
      }
    }
  }

  public isCurrentlyOnline(): boolean {
    return this.isConnected;
  }

  public async checkOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    const connected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    this.isConnected = connected;
    return connected;
  }

  public subscribe(callback: NetworkCallback): () => void {
    this.listeners.add(callback);
    // Call immediately with current state
    callback(this.isConnected);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const networkMonitor = new NetworkMonitor();

