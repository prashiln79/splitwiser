import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { networkMonitor } from '../sync/networkMonitor';
import { updateGroup } from './groups';
import { GroupCoverPhoto } from '../types';

export class GroupCoverService {
  /**
   * Uploads a custom cover photo to Firebase Storage under splitwiser/groups/{groupId}/cover_{timestamp}.jpg
   * Gracefully falls back to optimized data URL if offline or storage upload fails.
   */
  static async uploadCustomCoverPhoto(
    groupId: string,
    imageUri: string,
    base64Data: string | null | undefined,
    userId: string
  ): Promise<GroupCoverPhoto> {
    const timestamp = Date.now();
    const storagePath = `splitwiser/groups/${groupId}/cover_${timestamp}.jpg`;

    // 1. If online and base64 is available, upload to Firebase Storage
    if (networkMonitor.isCurrentlyOnline() && base64Data) {
      try {
        const storageRef = ref(storage, storagePath);
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

        await uploadString(storageRef, cleanBase64, 'base64', {
          contentType: 'image/jpeg',
          customMetadata: {
            uploadedBy: userId,
            groupId,
            timestamp: timestamp.toString(),
          },
        });

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

    // 2. Offline or fallback: use local base64 or URI
    const fallbackUrl = base64Data
      ? (base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`)
      : imageUri;

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

    // 2. Persist to Firestore and SQLite
    await updateGroup(groupId, {
      coverPhoto: newCoverPhoto || undefined,
      bannerUrl: newCoverPhoto?.imageUrl || undefined,
    });
  }
}

