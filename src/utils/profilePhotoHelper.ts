import { AppUser, ProfilePhotoSource } from '../types';

export interface ProfilePictureResolution {
  displayUrl: string | null;
  source: ProfilePhotoSource;
}

/**
 * Validates whether a profile image URL is non-empty and well-formed.
 */
export function isValidPhotoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|data:image\/|file:\/\/|content:\/\/)/i.test(trimmed);
}

/**
 * Resolves the effective profile picture according to Splitwise priority:
 * 1. Manually uploaded custom picture (highest priority)
 * 2. Google account picture (fallback when custom picture is absent or when user switched to Google)
 * 3. Initials fallback (when no valid image is set or source is 'none')
 */
export function resolveProfilePicture(user?: Partial<AppUser> | null): ProfilePictureResolution {
  if (!user) {
    return { displayUrl: null, source: 'none' };
  }

  const customPhoto = isValidPhotoUrl(user.customPhotoUrl) ? user.customPhotoUrl!.trim() : null;
  const googlePhoto = isValidPhotoUrl(user.googlePhotoUrl) ? user.googlePhotoUrl!.trim() : null;
  const explicitSource = user.photoSource;

  // 1. Explicit user selection
  if (explicitSource === 'none') {
    return { displayUrl: null, source: 'none' };
  }

  if (explicitSource === 'google') {
    if (googlePhoto) {
      return { displayUrl: googlePhoto, source: 'google' };
    }
    // If Google photo is missing but custom exists, fall back to custom
    if (customPhoto) {
      return { displayUrl: customPhoto, source: 'custom' };
    }
    return { displayUrl: null, source: 'none' };
  }

  if (explicitSource === 'custom') {
    if (customPhoto) {
      return { displayUrl: customPhoto, source: 'custom' };
    }
    // If custom was selected but is missing, fall back to Google photo
    if (googlePhoto) {
      return { displayUrl: googlePhoto, source: 'google' };
    }
    return { displayUrl: null, source: 'none' };
  }

  // 2. Default Priority Order (when photoSource is unset or legacy):
  // Priority 1: Custom picture
  if (customPhoto) {
    return { displayUrl: customPhoto, source: 'custom' };
  }

  // Priority 2: Google account picture
  if (googlePhoto) {
    return { displayUrl: googlePhoto, source: 'google' };
  }

  // Priority 2.5: Legacy imageUrl if valid and not a giant local string
  if (isValidPhotoUrl(user.imageUrl)) {
    const raw = user.imageUrl!.trim();
    if (raw.includes('googleusercontent.com')) {
      return { displayUrl: raw, source: 'google' };
    }
    return { displayUrl: raw, source: 'custom' };
  }

  // Priority 3: Initials fallback
  return { displayUrl: null, source: 'none' };
}

/**
 * Calculates updated profile fields when Google account data is refreshed.
 * CRITICAL RULE: NEVER overwrite a manually uploaded custom picture!
 */
export function calculateGoogleSyncUpdates(
  currentProfile: Partial<AppUser> | null,
  newGooglePhotoUrl?: string | null,
  newDisplayName?: string | null,
  newEmail?: string | null
): {
  hasChanges: boolean;
  updates: Partial<AppUser>;
} {
  const updates: Partial<AppUser> = {};
  let hasChanges = false;

  const validNewGoogle = isValidPhotoUrl(newGooglePhotoUrl) ? newGooglePhotoUrl!.trim() : null;
  const currentGoogle = currentProfile?.googlePhotoUrl || null;
  const currentCustom = currentProfile?.customPhotoUrl || null;
  const currentSource = currentProfile?.photoSource;

  // 1. Update Google Photo URL in document if changed
  if (validNewGoogle && validNewGoogle !== currentGoogle) {
    updates.googlePhotoUrl = validNewGoogle;
    hasChanges = true;
  }

  // 2. Resolve effective image URL
  // If user has a custom picture active, PRESERVE it!
  const currentResolution = resolveProfilePicture(currentProfile);

  if (currentResolution.source === 'custom' && currentCustom) {
    // Keep custom photo active
    updates.customPhotoUrl = currentCustom;
    updates.photoSource = 'custom';
    updates.imageUrl = currentCustom;
  } else if (currentSource === 'none') {
    // User explicitly removed picture
    updates.photoSource = 'none';
    updates.imageUrl = undefined;
  } else if (validNewGoogle) {
    // Use or update Google photo
    if (currentProfile?.imageUrl !== validNewGoogle || currentSource !== 'google') {
      updates.imageUrl = validNewGoogle;
      updates.photoSource = 'google';
      hasChanges = true;
    }
  }

  // 3. Update Name if current is empty or anonymous default
  if (newDisplayName && (!currentProfile?.name || currentProfile.isAnonymous)) {
    updates.name = newDisplayName;
    hasChanges = true;
  }

  // 4. Update Email
  if (newEmail && newEmail !== currentProfile?.email) {
    updates.email = newEmail;
    hasChanges = true;
  }

  return { hasChanges, updates };
}

