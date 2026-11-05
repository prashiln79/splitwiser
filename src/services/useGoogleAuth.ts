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
      console.warn('[useGoogleAuth] GoogleSignin configure warning:', e);
    }
  }
}

/**
 * Safely sign out from native Google Sign-In so that subsequent sign-ins
 * always present the account chooser dialog.
 */
export async function signOutNativeGoogle(): Promise<void> {
  const mod = getNativeGoogleSigninModule();
  if (mod?.GoogleSignin) {
    try {
      await mod.GoogleSignin.signOut();
    } catch {
      // Ignored if already signed out or unavailable
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

  // Pre-warm the browser ONLY for fallback environments (Expo Go / Web)
  useEffect(() => {
    if (!isExpoGo && Platform.OS !== 'web') return;
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, [isExpoGo]);

  // Listen for deep link redirects ONLY for fallback environments
  useEffect(() => {
    if (!isExpoGo && Platform.OS !== 'web') return;
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
  }, [isExpoGo]);

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

  // Handle expo-auth-session response fallback (only active for Expo Go / Web)
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

  // Main Google Sign-In prompt
  const promptAsync = useCallback(async (): Promise<{ type: 'success' | 'cancel' | 'error' | 'dismiss'; error?: any }> => {
    const mod = getNativeGoogleSigninModule();

    // 1. Native Android & iOS flow using Google Play Services bottom sheet
    if (mod && !isExpoGo && Platform.OS !== 'web') {
      try {
        ensureGoogleSigninConfigured();
        await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Clear previous native sign-in session to always show the Google account picker
        await mod.GoogleSignin.signOut().catch(() => {});

        const res = await mod.GoogleSignin.signIn();

        if (mod.isSuccessResponse(res)) {
          let idToken = res.data?.idToken;
          let accessToken: string | undefined = undefined;

          // If idToken is not in the top-level response, retrieve via getTokens()
          if (!idToken && typeof mod.GoogleSignin.getTokens === 'function') {
            try {
              const tokens = await mod.GoogleSignin.getTokens();
              idToken = tokens.idToken;
              accessToken = tokens.accessToken;
            } catch (tokenErr) {
              console.warn('[useGoogleAuth] getTokens() error:', tokenErr);
            }
          }

          if (idToken) {
            if (onSuccessRef.current) {
              onSuccessRef.current({ idToken, accessToken });
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
        console.warn('[useGoogleAuth] Native Google Sign-In error:', nativeError);
        const { statusCodes } = mod;

        // User cancelled account selection
        const isCancelled =
          nativeError.code === statusCodes?.SIGN_IN_CANCELLED ||
          nativeError.code === '12501' ||
          nativeError.code === 'SIGN_IN_CANCELLED' ||
          String(nativeError.code) === '12501' ||
          nativeError.message?.toLowerCase().includes('cancel');

        if (isCancelled) {
          return { type: 'cancel' };
        }

        // Sign-in already in progress
        if (
          nativeError.code === statusCodes?.IN_PROGRESS ||
          nativeError.code === 'ASYNC_OP_IN_PROGRESS'
        ) {
          return { type: 'cancel' };
        }

        // Format friendly actionable message for known status codes
        let friendlyMessage = nativeError.message || 'Google Sign-In failed.';
        const errorCode = String(nativeError.code || '');

        if (
          errorCode === '10' ||
          errorCode === 'DEVELOPER_ERROR' ||
          nativeError.message?.includes('DEVELOPER_ERROR') ||
          nativeError.message?.includes(': 10')
        ) {
          friendlyMessage =
            'Google Sign-In configuration error (DEVELOPER_ERROR 10). The app signing certificate (SHA-1) is not registered in Firebase Console. If running a production Play Store build, add the Google Play App Signing key SHA-1 to Firebase.';
        } else if (
          nativeError.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE ||
          errorCode === 'PLAY_SERVICES_NOT_AVAILABLE'
        ) {
          friendlyMessage = 'Google Play Services is not available or needs to be updated on this device.';
        } else if (errorCode === '7' || errorCode === 'NETWORK_ERROR') {
          friendlyMessage = 'Network error connecting to Google. Please check your connection and try again.';
        }

        const error = new Error(friendlyMessage);
        (error as any).code = nativeError.code;
        (error as any).originalError = nativeError;

        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
        // CRITICAL: In native builds, never fall through to Chrome / authSessionPromptAsync!
        return { type: 'error', error };
      }
    }

    // 2. Fallback to expo-auth-session ONLY for Expo Go or Web
    try {
      const res = await authSessionPromptAsync();
      return res as any;
    } catch (e: any) {
      if (onErrorRef.current) onErrorRef.current(e);
      return { type: 'error', error: e };
    }
  }, [authSessionPromptAsync, isExpoGo]);

  return {
    request,
    promptAsync,
    isReady: true,
  };
}
