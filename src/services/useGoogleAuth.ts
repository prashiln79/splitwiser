import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';
import { googleAuthConfig } from '../config/firebase';

export interface GoogleAuthTokens {
  idToken: string;
  accessToken?: string;
}

export type GoogleSignInResult =
  | { type: 'success'; tokens: GoogleAuthTokens }
  | { type: 'cancel' }
  | { type: 'error'; error: Error };

let isConfigured = false;

/**
 * Configure Google Sign-In with Web Client ID for Google Play Services token exchange.
 */
export function configureGoogleSignIn(): void {
  if (isConfigured || Platform.OS === 'web') return;
  try {
    GoogleSignin.configure({
      webClientId: googleAuthConfig.webClientId,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });
    isConfigured = true;
  } catch (err) {
    console.warn('[GoogleSignIn] Configuration error:', err);
  }
}

// Pre-configure on module load
if (Platform.OS !== 'web') {
  configureGoogleSignIn();
}

/**
 * Sign out from native Google Sign-In to ensure the account chooser is presented next time.
 */
export async function signOutNativeGoogle(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (err) {
    // Non-fatal if already signed out
    console.warn('[GoogleSignIn] signOutNativeGoogle notice:', err);
  }
}

/**
 * Initiates native Android Google Play Services Sign-In bottom sheet.
 * Never opens Chrome, Custom Tabs, or a browser window.
 */
export async function signInWithNativeGoogle(): Promise<GoogleSignInResult> {
  if (Platform.OS === 'web') {
    return {
      type: 'error',
      error: new Error('Google Sign-In is only available on native Android/iOS.'),
    };
  }
  try {
    configureGoogleSignIn();

    // 1. Ensure Google Play Services are available
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 2. Clear previous sign-in session so the account chooser dialog is always shown
    await GoogleSignin.signOut().catch(() => {});

    // 3. Initiate native Google Play Services bottom-sheet prompt
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      return { type: 'cancel' };
    }

    if (isSuccessResponse(response)) {
      let idToken = response.data?.idToken;
      let accessToken: string | undefined = undefined;

      // Some Android devices/play services versions return idToken via getTokens()
      if (!idToken) {
        try {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken;
          accessToken = tokens.accessToken;
        } catch (tokenErr) {
          console.warn('[GoogleSignIn] getTokens error:', tokenErr);
        }
      }

      if (!idToken) {
        throw new Error(
          'Google Sign-In succeeded, but no ID token was returned. Please verify that the Web Client ID is correctly configured.'
        );
      }

      return {
        type: 'success',
        tokens: {
          idToken,
          accessToken,
        },
      };
    }

    return { type: 'cancel' };
  } catch (err: any) {
    // 1. User cancellation
    const isCancelled =
      err?.code === statusCodes.SIGN_IN_CANCELLED ||
      err?.code === '12501' ||
      err?.code === 'SIGN_IN_CANCELLED' ||
      String(err?.code) === '12501' ||
      err?.message?.toLowerCase().includes('cancel');

    if (isCancelled) {
      return { type: 'cancel' };
    }

    // 2. Sign-in already in progress
    if (
      err?.code === statusCodes.IN_PROGRESS ||
      err?.code === 'ASYNC_OP_IN_PROGRESS' ||
      err?.code === '12502'
    ) {
      return { type: 'cancel' };
    }

    // 3. Actionable error messages
    let friendlyMessage = err?.message || 'Google Sign-In failed.';
    const errorCode = String(err?.code || '');

    if (
      errorCode === '10' ||
      errorCode === 'DEVELOPER_ERROR' ||
      err?.message?.includes('DEVELOPER_ERROR') ||
      err?.message?.includes(': 10')
    ) {
      friendlyMessage =
        'Google Sign-In configuration error (DEVELOPER_ERROR 10). The app signing certificate (SHA-1) is not registered in Firebase Console. Add your production or debug SHA-1 key to Firebase project settings.';
    } else if (
      err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE ||
      errorCode === 'PLAY_SERVICES_NOT_AVAILABLE'
    ) {
      friendlyMessage =
        'Google Play Services is not available or needs to be updated on this device.';
    } else if (errorCode === '7' || errorCode === 'NETWORK_ERROR') {
      friendlyMessage =
        'Network error connecting to Google Play Services. Please check your internet connection.';
    }

    const formattedError = new Error(friendlyMessage);
    (formattedError as any).code = err?.code;
    (formattedError as any).originalError = err;

    return { type: 'error', error: formattedError };
  }
}

/**
 * Hook interface for screens and modals to trigger native Google Sign-In.
 */
export function useGoogleAuth(
  onSuccess?: (tokens: GoogleAuthTokens) => void,
  onError?: (error: any) => void
) {
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const promptAsync = useCallback(async (): Promise<{
    type: 'success' | 'cancel' | 'error';
    error?: any;
  }> => {
    const result = await signInWithNativeGoogle();

    if (result.type === 'success') {
      if (onSuccessRef.current) {
        onSuccessRef.current(result.tokens);
      }
      return { type: 'success' };
    }

    if (result.type === 'cancel') {
      return { type: 'cancel' };
    }

    if (result.type === 'error') {
      if (onErrorRef.current) {
        onErrorRef.current(result.error);
      }
      return { type: 'error', error: result.error };
    }

    return { type: 'cancel' };
  }, []);

  return {
    promptAsync,
    isReady: true,
  };
}
