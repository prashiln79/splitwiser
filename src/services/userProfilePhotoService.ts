import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { networkMonitor } from '../sync/networkMonitor';
import { AppUser } from '../types';
import { compressAvatarPhoto } from '../utils/imageCompressor';
import { updateUserProfile, loadUserProfile } from './auth';

export class UserProfilePhotoService {
  /**
   * Uploads a custom user avatar to Firebase Storage under splitwiser/users/{userId}/profile/avatar_{timestamp}.jpg
   */
  static async uploadAvatarToStorage(
    userId: string,
    imageUri: string,
    base64Data?: string
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    const timestamp = Date.now();
    const storagePath = `splitwiser/users/${userId}/profile/avatar_${timestamp}.jpg`;
    const storageRef = ref(storage, storagePath);

    if (base64Data) {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      await uploadString(storageRef, cleanBase64, 'base64', {
        contentType: 'image/jpeg',
        customMetadata: {
          uploadedBy: userId,
          timestamp: timestamp.toString(),
        },
      });
    } else {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          uploadedBy: userId,
          timestamp: timestamp.toString(),
        },
      });
    }

    const downloadUrl = await getDownloadURL(storageRef);
    return { downloadUrl, storagePath };
  }

  /**
   * Sets and saves a manually uploaded custom profile photo.
   * Compresses the image, uploads to Firebase Storage, sets photoSource: 'custom',
   * and synchronizes the change across all groups and local database.
   */
  static async setCustomProfilePhoto(
    userId: string,
    rawImageUri: string
  ): Promise<AppUser> {
    // 1. Compress image to 400x400 JPEG max to ensure fast loading and low storage footprint
    const compressed = await compressAvatarPhoto(rawImageUri, {
      size: 400,
      quality: 0.75,
      includeBase64: true,
    });

    let effectiveUrl = compressed.uri;

    // 2. Upload to Firebase Storage if online
    if (networkMonitor.isCurrentlyOnline()) {
      try {
        const { downloadUrl } = await this.uploadAvatarToStorage(
          userId,
          compressed.uri,
          compressed.base64
        );
        effectiveUrl = downloadUrl;
      } catch (err: any) {
        console.warn('[UserProfilePhotoService] Storage upload error, falling back:', err?.message);
        // Fall back to clean data URL if small, or local file URI
        if (compressed.base64 && compressed.base64.length < 80000) {
          effectiveUrl = `data:image/jpeg;base64,${compressed.base64}`;
        }
      }
    } else if (compressed.base64 && compressed.base64.length < 80000) {
      effectiveUrl = `data:image/jpeg;base64,${compressed.base64}`;
    }

    // 3. Update central Firestore profile
    await updateUserProfile(userId, {
      customPhotoUrl: effectiveUrl,
      imageUrl: effectiveUrl,
      photoSource: 'custom',
    });

    const refreshed = await loadUserProfile(userId);
    return refreshed!;
  }

  /**
   * Switches the active profile picture back to the Google account picture.
   */
  static async switchToGooglePhoto(
    userId: string,
    googlePhotoUrl: string
  ): Promise<AppUser> {
    await updateUserProfile(userId, {
      imageUrl: googlePhotoUrl,
      photoSource: 'google',
    });

    const refreshed = await loadUserProfile(userId);
    return refreshed!;
  }

  /**
   * Removes the custom profile photo.
   * If a Google account picture exists, falls back to it. Otherwise, reverts to initials fallback.
   */
  static async removeCustomPhoto(
    userId: string,
    googlePhotoUrl?: string | null
  ): Promise<AppUser> {
    if (googlePhotoUrl && googlePhotoUrl.trim()) {
      await updateUserProfile(userId, {
        customPhotoUrl: '',
        imageUrl: googlePhotoUrl.trim(),
        photoSource: 'google',
      });
    } else {
      await updateUserProfile(userId, {
        customPhotoUrl: '',
        imageUrl: '',
        photoSource: 'none',
      });
    }

    const refreshed = await loadUserProfile(userId);
    return refreshed!;
  }
}

