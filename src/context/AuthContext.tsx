import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { AppUser } from '../types';
import { syncService } from '../sync/syncService';
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
      if (profile) setUser(profile);
    }
  };

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await syncGoogleProfileOnAuth(firebaseUser);
          setUser(profile);
          syncService.initialize(firebaseUser.uid);
        } catch (err) {
          console.error('[AuthContext] Failed to load user profile:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInAsGuest = async (): Promise<AppUser> => {
    setIsLoading(true);
    try {
      const profile = await serviceSignInAsGuest();
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string): Promise<AppUser> => {
    setIsLoading(true);
    try {
      const profile = await serviceSignUpWithEmail(email, pass, name);
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<AppUser> => {
    setIsLoading(true);
    try {
      const profile = await serviceSignInWithEmail(email, pass);
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const completeProfile = async (
    name: string,
    avatarUrl?: string,
    currency?: string
  ): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    setIsLoading(true);
    try {
      const updated = await serviceCompleteProfileSetup(user.uid, { name, avatarUrl, currency });
      setUser(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const finishOnboarding = async (): Promise<void> => {
    if (!user) return;
    await serviceMarkOnboardingCompleted(user.uid);
    setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
  };

  const completeOnboarding = async (name: string): Promise<void> => {
    setIsLoading(true);
    try {
      const profile = await signInAndCreateProfile(name);
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (
    updates: Partial<AppUser>
  ): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
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
    setIsLoading(true);
    try {
      const profile = await signInWithGoogleCredential(
        idToken,
        accessToken,
        photoUrl,
        displayName,
        email
      );
      setUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const migrateAnonymousDataToGoogle = async (
    idToken: string,
    accessToken?: string,
    photoUrl?: string | null,
    displayName?: string | null,
    email?: string | null
  ): Promise<AppUser> => {
    if (!user) throw new Error('No active user to migrate.');
    setIsLoading(true);
    try {
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
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signOutUser();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
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
