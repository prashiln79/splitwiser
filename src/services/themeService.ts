import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppearanceMode } from '../theme/themeStorage';

/**
 * Synchronizes the user's appearance mode preference to their Firestore profile.
 */
export async function syncThemeToFirestore(
  uid: string,
  mode: AppearanceMode
): Promise<void> {
  if (!uid) return;

  try {
    const userRef = doc(db, 'splitwiser', 'data', 'users', uid);
    await updateDoc(userRef, {
      appearance: mode,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.warn('[themeService] Failed to sync appearance mode to Firestore:', error);
  }
}

/**
 * Fetches the user's appearance mode preference from Firestore.
 */
export async function fetchThemeFromFirestore(
  uid: string
): Promise<AppearanceMode | null> {
  if (!uid) return null;

  try {
    const userRef = doc(db, 'splitwiser', 'data', 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const appearance = data?.appearance;
      if (appearance === 'light' || appearance === 'dark' || appearance === 'system') {
        return appearance;
      }
    }
  } catch (error) {
    console.warn('[themeService] Failed to fetch appearance mode from Firestore:', error);
  }

  return null;
}

