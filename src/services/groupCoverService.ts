import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { networkMonitor } from '../sync/networkMonitor';
import { updateGroup } from './groups';
import { GroupCoverPhoto } from '../types';

export class GroupCoverService {
  /**
   * Uploads a custom cover photo to Firebase Storage under splitwiser/groups/{groupId}/cover_{timestamp}.jpg
   * Gracefully falls back to optimized data URL or local URI if offline or storage upload fails.
   */
  static async uploadCustomCoverPhoto(
    groupId: string,
    imageUri: string,
    base64Data: string | null | undefined,
    userId: string
  ): Promise<GroupCoverPhoto> {
    const timestamp = Date.now();
    const storagePath = `splitwiser/groups/${groupId}/cover_${timestamp}.jpg`;

    // 1. If online, upload to Firebase Storage
    if (networkMonitor.isCurrentlyOnline()) {
      try {
        const storageRef = ref(storage, storagePath);

        if (base64Data) {
          const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
          await uploadString(storageRef, cleanBase64, 'base64', {
            contentType: 'image/jpeg',
            customMetadata: {
              uploadedBy: userId,
              groupId,
              timestamp: timestamp.toString(),
            },
          });
        } else if (imageUri) {
          // If no base64 string provided, upload directly from imageUri via blob
          const response = await fetch(imageUri);
          const blob = await response.blob();
          await uploadBytes(storageRef, blob, {
            contentType: 'image/jpeg',
            customMetadata: {
              uploadedBy: userId,
              groupId,
              timestamp: timestamp.toString(),
            },
          });
        }

        const downloadUrl = await getDownloadURL(storageRef);

        return {
          type: 'custom',
          imageUrl: downloadUrl,
          storagePath,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        };
      } catch (err: any) {
        console.warn('[GroupCoverService] Firebase Storage upload error, falling back:', err?.message);
      }
    }

    // 2. Offline or fallback:
    // SAFETY CHECK: Ensure we never put an oversized base64 string (>300KB) into Firestore,
    // which would throw "Transaction / document exceeds 1MB limit".
    let fallbackUrl = imageUri;
    if (base64Data && base64Data.length < 350000) {
      fallbackUrl = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
    }

    return {
      type: 'custom',
      imageUrl: fallbackUrl,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
  }

  /**
   * Deletes an existing custom cover photo from Firebase Storage if safe to do so.
   */
  static async deleteOldCoverPhoto(storagePath?: string): Promise<void> {
    if (!storagePath || !networkMonitor.isCurrentlyOnline()) return;
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e: any) {
      // Ignored if file doesn't exist
      console.warn('[GroupCoverService] deleteOldCoverPhoto skipped:', e?.message);
    }
  }

  /**
   * Applies and saves the new cover photo to Firestore and local SQLite.
   */
  static async saveGroupCoverPhoto(
    groupId: string,
    newCoverPhoto: GroupCoverPhoto | null,
    previousStoragePath?: string
  ): Promise<void> {
    // 1. If replacing a custom cover with another image or removing it, clean up previous storage file
    if (previousStoragePath && previousStoragePath !== newCoverPhoto?.storagePath) {
      this.deleteOldCoverPhoto(previousStoragePath).catch(() => {});
    }

    // 2. Document size guard: ensure no giant base64 strings exceed Firestore 1MB doc ceiling
    let sanitizedCoverPhoto = newCoverPhoto;
    if (newCoverPhoto?.imageUrl?.startsWith('data:image/') && newCoverPhoto.imageUrl.length > 400000) {
      console.warn('[GroupCoverService] Cover photo data URL exceeds 400KB, sanitizing before Firestore update');
      sanitizedCoverPhoto = {
        ...newCoverPhoto,
        imageUrl: '',
      };
    }

    // 3. Persist to Firestore and SQLite
    await updateGroup(groupId, {
      coverPhoto: sanitizedCoverPhoto || undefined,
      bannerUrl: sanitizedCoverPhoto?.imageUrl || undefined,
    });
  }
}

