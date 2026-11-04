import { useEffect, useMemo } from 'react';
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

export function useGoogleAuth(
  onSuccess?: (tokens: GoogleAuthTokens) => void,
  onError?: (error: any) => void
) {
  // If a dedicated Android OAuth Client ID is provided, use the native Android scheme.
  // Otherwise, when using the Web OAuth Client ID, we MUST use the HTTPS Expo Auth Proxy URI
  // (https://auth.expo.io/@prashiln79/splitwiser) because Google strictly blocks custom schemes
  // (com.prashiln79.splitwiser:/...) on Web Client IDs with Error 400: invalid_request.
  const redirectUri = useMemo(() => {
    if (googleAuthConfig.androidClientId) {
      return AuthSession.makeRedirectUri({
        scheme: 'splitwiser',
        native: 'com.prashiln79.splitwiser:/oauthredirect',
      });
    }
    return 'https://auth.expo.io/@prashiln79/splitwiser';
  }, []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleAuthConfig.webClientId,
    androidClientId: googleAuthConfig.androidClientId || googleAuthConfig.webClientId,
    iosClientId: googleAuthConfig.iosClientId || googleAuthConfig.webClientId,
    webClientId: googleAuthConfig.webClientId,
    redirectUri,
  });

  useEffect(() => {
    if (request?.redirectUri) {
      console.log('👉 [Google Auth Request] Active redirectUri:', request.redirectUri);
      console.log('👉 [Google Auth Request] Full Auth URL:', request.url);
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.params?.id_token || response.authentication?.idToken;
      const accessToken =
        response.params?.access_token || response.authentication?.accessToken;

      if (idToken) {
        if (onSuccess) onSuccess({ idToken, accessToken });
      } else {
        if (onError) onError(new Error('No ID Token returned from Google.'));
      }
    } else if (response?.type === 'error') {
      if (onError) onError(response.error);
    }
  }, [response]);

  return {
    request,
    promptAsync,
    isReady: !!request,
  };
}

