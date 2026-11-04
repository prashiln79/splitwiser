import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { AppUser } from '../types';
import {
  subscribeToAuthState,
  loadUserProfile,
  signInAndCreateProfile,
  updateUserProfile,
} from '../services/auth';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  /** Call during onboarding to create a session with the given display name */
  completeOnboarding: (name: string) => Promise<void>;
  /** Update the user's profile (name, imageUrl) */
  updateProfile: (updates: Partial<Pick<AppUser, 'name' | 'imageUrl'>>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in – load their Firestore profile
        try {
          const profile = await loadUserProfile(firebaseUser.uid);
          setUser(profile);
        } catch (err) {
          console.error('[AuthContext] Failed to load user profile:', err);
          setUser(null);
        }
      } else {
        // No Firebase session
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

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
    updates: Partial<Pick<AppUser, 'name' | 'imageUrl'>>
  ): Promise<void> => {
    if (!user) throw new Error('No authenticated user');
    await updateUserProfile(user.uid, updates);
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, completeOnboarding, updateProfile }}
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
