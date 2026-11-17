import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { AppUser } from '../types';
import { syncService } from '../sync/syncService';
import { setDefaultCurrency } from '../utils/currency';
import {
  subscribeToAuthState,
  loadUserProfile,
  syncGoogleProfileOnAuth,
  signInAndCreateProfile,
  signInAsGuest as serviceSignInAsGuest,
  signUpWithEmail as serviceSignUpWithEmail,
  signInWithEmail as serviceSignInWithEmail,
  completeProfileSetup as serviceCompleteProfileSetup,
  markOnboardingCompleted as serviceMarkOnboardingCompleted,
  updateUserProfile,
  linkGoogleCredential,
  signInWithGoogleCredential,
  migrateAnonymousDataToExistingGoogleAccount,
  signOutUser,
  getCachedUserProfile,
  saveCachedUserProfile,
  clearCachedUserProfile,
} from '../services/auth';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  /** Sign in anonymously as a guest */
  signInAsGuest: () => Promise<AppUser>;
  /** Register with email and password */
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<AppUser>;
  /** Sign in with email and password */
  signInWithEmail: (email: string, pass: string) => Promise<AppUser>;
  /** Complete profile setup during onboarding */
  completeProfile: (name: string, avatarUrl?: string, currency?: string) => Promise<void>;
  /** Finalize onboarding flow (Screen 7 skip or Screen 10/11) */
  finishOnboarding: () => Promise<void>;
  /** Call during onboarding to create a session with the given display name (legacy helper) */
  completeOnboarding: (name: string) => Promise<void>;
  /** Update the user's profile (name, imageUrl, preferences) */
  updateProfile: (updates: Partial<AppUser>) => Promise<void>;
  /** Link Google Account to the current anonymous user preserving UID */
  linkGoogleAccount: (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ) => Promise<{ user: AppUser; isSameUid: boolean }>;
  /** Sign in with existing Google account (login on a second device) */
  signInWithGoogle: (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ) => Promise<AppUser>;
  /** Migrate anonymous data to an existing Google account in case of conflict */
  migrateAnonymousDataToGoogle: (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ) => Promise<AppUser>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Reload profile */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    if (user?.uid) {
      const profile = await loadUserProfile(user.uid);
      if (profile) {
        setUser(profile);
        saveCachedUserProfile(profile).catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (user?.currency) {
      setDefaultCurrency(user.currency);
    }
  }, [user?.currency]);

  // Fast path: load cached user profile immediately from AsyncStorage (<50ms startup)
  useEffect(() => {
    let isMounted = true;
    getCachedUserProfile()
      .then((cached) => {
        if (!isMounted) return;
        if (cached && cached.uid) {
          if (cached.currency) setDefaultCurrency(cached.currency);
          setUser(cached);
          setIsLoading(false);
          syncService.initialize(cached.uid);
        }
      })
      .catch(() => {});

    // Safety fallback: ensure splash screen NEVER hangs beyond 2.5s under any network condition
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        // Optimistic setup so UI can render immediately if no cache was available
        setUser((prev) => {
          if (prev && prev.uid === firebaseUser.uid) return prev;
          return {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || undefined,
            imageUrl: firebaseUser.photoURL || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: new Date(),
            isAnonymous: firebaseUser.isAnonymous,
            authProvider: firebaseUser.isAnonymous ? 'anonymous' : 'password',
            hasCompletedProfile: Boolean(firebaseUser.displayName && !firebaseUser.isAnonymous),
            onboardingCompleted: false,
          };
        });

        // Unblock splash screen immediately!
        setIsLoading(false);
        syncService.initialize(firebaseUser.uid);

        // Background sync: verify and refresh profile from cloud without holding splash screen hostage
        try {
          const profile = await syncGoogleProfileOnAuth(firebaseUser);
          if (profile) {
            if (profile.currency) setDefaultCurrency(profile.currency);
            setUser(profile);
            saveCachedUserProfile(profile).catch(() => {});
          }
        } catch (err) {
          console.warn('[AuthContext] Background profile sync notice:', err);
        }
      } else {
        setUser(null);
        clearCachedUserProfile().catch(() => {});
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signInAsGuest = async (): Promise<AppUser> => {
    const profile = await serviceSignInAsGuest();
    setUser(profile);
    return profile;
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string): Promise<AppUser> => {
    const profile = await serviceSignUpWithEmail(email, pass, name);
    setUser(profile);
    return profile;
  };

  const signInWithEmail = async (email: string, pass: string): Promise<AppUser> => {
    const profile = await serviceSignInWithEmail(email, pass);
    setUser(profile);
    return profile;
  };

  const completeProfile = async (
    name: string,
    avatarUrl?: string,
    currency?: string
  ): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    if (currency) setDefaultCurrency(currency);
    const updated = await serviceCompleteProfileSetup(user.uid, { name, avatarUrl, currency });
    setUser(updated);
  };

  const finishOnboarding = async (): Promise<void> => {
    if (!user) return;
    await serviceMarkOnboardingCompleted(user.uid);
    setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
  };

  const completeOnboarding = async (name: string): Promise<void> => {
    const profile = await signInAndCreateProfile(name);
    setUser(profile);
  };

  const updateProfile = async (
    updates: Partial<AppUser>
  ): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    if (updates.currency) setDefaultCurrency(updates.currency);
    await updateUserProfile(user.uid, updates);
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const linkGoogleAccount = async (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ): Promise<{ user: AppUser; isSameUid: boolean }> => {
    const result = await linkGoogleCredential(
      idToken,
      accessToken,
      photoUrl,
      displayName,
      email
    );
    setUser(result.user);
    return result;
  };

  const signInWithGoogle = async (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ): Promise<AppUser> => {
    const profile = await signInWithGoogleCredential(
      idToken,
      accessToken,
      photoUrl,
      displayName,
      email
    );
    setUser(profile);
    return profile;
  };

  const migrateAnonymousDataToGoogle = async (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ): Promise<AppUser> => {
    if (!user) throw new Error('No active user to migrate.');
    const profile = await migrateAnonymousDataToExistingGoogleAccount(
      user.uid,
      idToken,
      accessToken,
      photoUrl,
      displayName,
      email
    );
    setUser(profile);
    return profile;
  };

  const signOut = async (): Promise<void> => {
    await signOutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInAsGuest,
        signUpWithEmail,
        signInWithEmail,
        completeProfile,
        finishOnboarding,
        completeOnboarding,
        updateProfile,
        linkGoogleAccount,
        signInWithGoogle,
        migrateAnonymousDataToGoogle,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
