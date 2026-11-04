import { useEffect, useMemo, useCallback, useRef } from 'react';
import { Platform, Linking, TurboModuleRegistry, NativeModules } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import { googleAuthConfig } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthTokens {
  idToken: string;
  accessToken?: string;
}

// Safely check if native RNGoogleSignin is present in the binary (false in Expo Go)
function isRNGoogleSigninAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const hasTurbo =
      typeof TurboModuleRegistry?.get === 'function' &&
      TurboModuleRegistry.get('RNGoogleSignin') != null;
    const hasLegacy = NativeModules && NativeModules.RNGoogleSignin != null;
    return Boolean(hasTurbo || hasLegacy);
  } catch {
    return false;
  }
}

// Lazy loader so importing this file NEVER throws in Expo Go or web
function getNativeGoogleSigninModule() {
  if (!isRNGoogleSigninAvailable()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-google-signin/google-signin');
    return {
      GoogleSignin: mod.GoogleSignin,
      isSuccessResponse: mod.isSuccessResponse,
      isCancelledResponse: mod.isCancelledResponse,
      statusCodes: mod.statusCodes,
    };
  } catch (err) {
    console.warn('[useGoogleAuth] Could not initialize native GoogleSignin:', err);
    return null;
  }
}

// Configure once if native module is present
let isConfigured = false;
function ensureGoogleSigninConfigured() {
  if (isConfigured) return;
  const mod = getNativeGoogleSigninModule();
  if (mod?.GoogleSignin) {
    try {
      mod.GoogleSignin.configure({
        webClientId: googleAuthConfig.webClientId,
        scopes: ['profile', 'email'],
        offlineAccess: false,
      });
      isConfigured = true;
    } catch (e) {
      console.warn('[GoogleSignin] configure warning:', e);
    }
  }
}

export function useGoogleAuth(
  onSuccess?: (tokens: GoogleAuthTokens) => void,
  onError?: (error: any) => void
) {
  const nativeAvailable = isRNGoogleSigninAvailable();

  const isExpoGo =
    !nativeAvailable ||
    Boolean(Constants.expoConfig?.hostUri) ||
    Boolean(Constants.expoGoConfig) ||
    Constants.appOwnership === AppOwnership.Expo ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  // Configure native Google Sign In on mount if running in a native build
  useEffect(() => {
    if (nativeAvailable) {
      ensureGoogleSigninConfigured();
    }
  }, [nativeAvailable]);

  // Pre-warm the browser on Android for fallback auth-session
  useEffect(() => {
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, []);

  // Listen for deep link redirects so WebBrowser automatically closes
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      if (
        event.url.includes('oauthredirect') ||
        event.url.startsWith('com.prashiln79.splitwiser:') ||
        event.url.startsWith('splitwiser:')
      ) {
        WebBrowser.dismissBrowser().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // In Expo Go, we must use the Web Client ID and the Expo Auth Proxy URL
  const activeClientId = isExpoGo
    ? googleAuthConfig.webClientId
    : (googleAuthConfig.androidClientId || googleAuthConfig.webClientId);

  const redirectUri = useMemo(() => {
    if (isExpoGo) {
      return 'https://auth.expo.io/@prashiln79/splitwiser';
    }
    return AuthSession.makeRedirectUri({
      scheme: 'com.prashiln79.splitwiser',
      native: 'com.prashiln79.splitwiser:/oauthredirect',
    });
  }, [isExpoGo]);

  const [request, response, authSessionPromptAsync] = Google.useIdTokenAuthRequest({
    clientId: activeClientId,
    androidClientId: isExpoGo ? undefined : googleAuthConfig.androidClientId,
    webClientId: googleAuthConfig.webClientId,
    redirectUri,
  });

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  // Handle expo-auth-session response fallback
  useEffect(() => {
    if (response?.type === 'success') {
      WebBrowser.dismissBrowser().catch(() => {});
      const idToken =
        response.params?.id_token || response.authentication?.idToken;
      const accessToken =
        response.params?.access_token || response.authentication?.accessToken;

      if (idToken) {
        if (onSuccessRef.current) onSuccessRef.current({ idToken, accessToken });
      } else {
        if (onErrorRef.current) onErrorRef.current(new Error('No ID Token returned from Google.'));
      }
    } else if (response?.type === 'error') {
      WebBrowser.dismissBrowser().catch(() => {});
      if (onErrorRef.current) onErrorRef.current(response.error);
    }
  }, [response]);

  // Native Android & iOS prompt using Google Play Services bottom sheet
  const promptAsync = useCallback(async (): Promise<{ type: 'success' | 'cancel' | 'error' | 'dismiss'; error?: any }> => {
    const mod = getNativeGoogleSigninModule();

    // 1. If native GoogleSignin is available (standalone APK / dev client)
    if (mod && Platform.OS !== 'web') {
      try {
        ensureGoogleSigninConfigured();
        await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await mod.GoogleSignin.signIn();

        if (mod.isSuccessResponse(res)) {
          const idToken = res.data.idToken;
          if (idToken) {
            if (onSuccessRef.current) {
              onSuccessRef.current({ idToken, accessToken: undefined });
            }
            return { type: 'success' };
          } else {
            const err = new Error('No ID Token returned by Google Play Services.');
            if (onErrorRef.current) onErrorRef.current(err);
            return { type: 'error', error: err };
          }
        } else if (mod.isCancelledResponse(res)) {
          return { type: 'cancel' };
        } else {
          return { type: 'cancel' };
        }
      } catch (nativeError: any) {
        console.warn('Native Google Sign-In caught error:', nativeError);
        const { statusCodes } = mod;
        if (
          nativeError.code === statusCodes?.SIGN_IN_CANCELLED ||
          nativeError.message?.includes('cancelled') ||
          nativeError.code === '13'
        ) {
          return { type: 'cancel' };
        }
        if (nativeError.code === statusCodes?.IN_PROGRESS) {
          return { type: 'cancel' };
        }

        // If something failed on native, fall through to authSessionPromptAsync
        console.log('Falling back to expo-auth-session prompt...');
      }
    }

    // 2. Fallback to expo-auth-session (Expo Go, web, or when native module is missing)
    try {
      const res = await authSessionPromptAsync();
      return res as any;
    } catch (e: any) {
      if (onErrorRef.current) onErrorRef.current(e);
      return { type: 'error', error: e };
    }
  }, [authSessionPromptAsync]);

  return {
    request,
    promptAsync,
    isReady: true,
  };
}
