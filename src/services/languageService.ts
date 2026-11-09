import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SupportedLocale, SUPPORTED_LOCALES } from '../i18n/locales';

/**
 * Synchronizes the user's manual language selection with Firestore.
 * Does not overwrite if locale is null or user is unauthenticated.
 */
export async function syncLanguageToFirestore(
  uid: string,
  locale: SupportedLocale | null
): Promise<void> {
  if (!uid || !locale) return;

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      language: locale,
      updatedAt: new Date(),
    });
  } catch (error) {
    // If offline or permission fails, silently log warning; local persistence is primary
    console.warn('[languageService] Failed to sync language preference to Firestore:', error);
  }
}

/**
 * Fetches the user's language preference from Firestore.
 */
export async function fetchLanguageFromFirestore(
  uid: string
): Promise<SupportedLocale | null> {
  if (!uid) return null;

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const lang = data?.language;
      if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
        return lang as SupportedLocale;
      }
    }
  } catch (error) {
    console.warn('[languageService] Failed to fetch language preference from Firestore:', error);
  }

  return null;
}
