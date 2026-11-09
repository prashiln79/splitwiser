import { manipulateAsync, SaveFormat, Action } from 'expo-image-manipulator';

export interface CompressedImageResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
}

/**
 * Resizes and compresses a group cover photo (typically 16:9 aspect ratio).
 * Keeps maximum dimension bounded to 1280px wide and applies 0.7 JPEG compression,
 * reducing multi-megabyte camera/gallery images down to ~60KB - 120KB.
 */
export async function compressCoverPhoto(
  uri: string,
  options?: { includeBase64?: boolean; maxWidth?: number; quality?: number }
): Promise<CompressedImageResult> {
  const maxWidth = options?.maxWidth ?? 1280;
  const quality = options?.quality ?? 0.72;
  const includeBase64 = options?.includeBase64 ?? true;

  try {
    const actions: Action[] = [{ resize: { width: maxWidth } }];

    const result = await manipulateAsync(uri, actions, {
      compress: quality,
      format: SaveFormat.JPEG,
      base64: includeBase64,
    });

    return {
      uri: result.uri,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.warn('[imageCompressor] Failed to compress cover photo, falling back to original:', error);
    return {
      uri,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Resizes and compresses an avatar / group icon (1:1 aspect ratio).
 * Keeps dimension bounded to 400x400 max, producing ~25KB - 50KB files.
 */
export async function compressAvatarPhoto(
  uri: string,
  options?: { includeBase64?: boolean; size?: number; quality?: number }
): Promise<CompressedImageResult> {
  const size = options?.size ?? 400;
  const quality = options?.quality ?? 0.75;
  const includeBase64 = options?.includeBase64 ?? true;

  try {
    const actions: Action[] = [{ resize: { width: size, height: size } }];

    const result = await manipulateAsync(uri, actions, {
      compress: quality,
      format: SaveFormat.JPEG,
      base64: includeBase64,
    });

    return {
      uri: result.uri,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.warn('[imageCompressor] Failed to compress avatar photo, falling back to original:', error);
    return {
      uri,
      width: 0,
      height: 0,
    };
  }
}

