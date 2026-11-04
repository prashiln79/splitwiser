import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
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
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleAuthConfig.webClientId,
    androidClientId: googleAuthConfig.androidClientId || googleAuthConfig.webClientId,
    iosClientId: googleAuthConfig.iosClientId || googleAuthConfig.webClientId,
    webClientId: googleAuthConfig.webClientId,
  });

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

