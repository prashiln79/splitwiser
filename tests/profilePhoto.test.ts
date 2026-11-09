import assert from 'assert';
import {
  resolveProfilePicture,
  calculateGoogleSyncUpdates,
  isValidPhotoUrl,
} from '../src/utils/profilePhotoHelper';
import { AppUser, ProfilePhotoSource } from '../src/types';

console.log('--- STARTING USER PROFILE PHOTO & GOOGLE SYNC UNIT TESTS ---');

// 1. Google Login with a Profile Picture (Initial Login)
{
  const incomingGooglePhoto = 'https://lh3.googleusercontent.com/a/photo_123';
  const { hasChanges, updates } = calculateGoogleSyncUpdates(null, incomingGooglePhoto);

  assert.strictEqual(hasChanges, true, 'First login should report changes');
  assert.strictEqual(updates.photoSource, 'google', 'First login should set source to google');
  assert.strictEqual(updates.googlePhotoUrl, incomingGooglePhoto, 'Google photo URL should be saved');
  assert.strictEqual(updates.imageUrl, incomingGooglePhoto, 'Active imageUrl should match Google photo');
  console.log('✅ [PASS] 1. Initial Google login with profile photo sets googlePhotoUrl and active imageUrl');
}

// 2. Google Login without a Profile Picture
{
  const { hasChanges, updates } = calculateGoogleSyncUpdates(null, null);

  assert.strictEqual(hasChanges, false, 'No updates needed when no info provided');
  assert.strictEqual(updates.googlePhotoUrl, undefined, 'Google photo URL should be undefined');
  assert.strictEqual(updates.imageUrl, undefined, 'Active imageUrl should be undefined');
  
  const resolved = resolveProfilePicture(null);
  assert.strictEqual(resolved.displayUrl, null, 'Fallback to null displayUrl for initials rendering');
  assert.strictEqual(resolved.source, 'none', 'Source defaults to none');
  console.log('✅ [PASS] 2. Google login without picture defaults to initials fallback');
}

// 3. Manual Custom Upload overrides Google Picture
{
  const initialGoogleUser: Partial<AppUser> = {
    googlePhotoUrl: 'https://lh3.googleusercontent.com/a/google_original',
    customPhotoUrl: undefined,
    photoSource: 'google',
    imageUrl: 'https://lh3.googleusercontent.com/a/google_original',
  };

  const customPhotoUrl = 'https://firebasestorage.googleapis.com/v0/b/splitwiser/users/uid1/profile/avatar_123.jpg';
  const resolved = resolveProfilePicture({
    customPhotoUrl,
    googlePhotoUrl: initialGoogleUser.googlePhotoUrl,
    photoSource: 'custom',
  });

  assert.strictEqual(resolved.displayUrl, customPhotoUrl, 'Custom photo must have highest priority');
  assert.strictEqual(resolved.source, 'custom', 'Source must be custom');
  console.log('✅ [PASS] 3. Manual custom upload overrides Google photo');
}

// 4. Subsequent Google Login does NOT overwrite manually uploaded picture
{
  const userWithCustomPhoto: Partial<AppUser> = {
    googlePhotoUrl: 'https://lh3.googleusercontent.com/a/old_google_photo',
    customPhotoUrl: 'https://firebasestorage.googleapis.com/v0/b/splitwiser/users/uid1/profile/custom_avatar.jpg',
    photoSource: 'custom',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/splitwiser/users/uid1/profile/custom_avatar.jpg',
  };

  const incomingGooglePhoto = 'https://lh3.googleusercontent.com/a/new_google_photo_from_login';
  const { updates } = calculateGoogleSyncUpdates(userWithCustomPhoto, incomingGooglePhoto);

  // googlePhotoUrl is kept up-to-date in background...
  assert.strictEqual(updates.googlePhotoUrl, incomingGooglePhoto, 'googlePhotoUrl should be updated');
  // BUT photoSource and active imageUrl must remain custom!
  assert.strictEqual(updates.photoSource, 'custom', 'photoSource must remain custom');
  assert.strictEqual(updates.imageUrl, userWithCustomPhoto.customPhotoUrl, 'active imageUrl must remain custom photo');

  // Verify resolution still produces custom photo
  const resolved = resolveProfilePicture({
    ...userWithCustomPhoto,
    ...updates,
  });
  assert.strictEqual(resolved.displayUrl, userWithCustomPhoto.customPhotoUrl, 'Active picture remains custom photo');
  assert.strictEqual(resolved.source, 'custom', 'Active source remains custom');
  console.log('✅ [PASS] 4. Subsequent Google login preserves manual custom picture');
}

// 5. Google Picture Updated Externally (Sync when user is using Google avatar)
{
  const userUsingGooglePhoto: Partial<AppUser> = {
    googlePhotoUrl: 'https://lh3.googleusercontent.com/a/old_google_photo',
    customPhotoUrl: undefined,
    photoSource: 'google',
    imageUrl: 'https://lh3.googleusercontent.com/a/old_google_photo',
  };

  const newGooglePhoto = 'https://lh3.googleusercontent.com/a/updated_google_photo';
  const { hasChanges, updates } = calculateGoogleSyncUpdates(userUsingGooglePhoto, newGooglePhoto);

  assert.strictEqual(hasChanges, true, 'External Google photo change should report changes');
  assert.strictEqual(updates.googlePhotoUrl, newGooglePhoto, 'googlePhotoUrl should be updated to new photo');
  assert.strictEqual(updates.imageUrl, newGooglePhoto, 'Active imageUrl should reflect updated Google photo');
  assert.strictEqual(updates.photoSource, 'google', 'Source remains google');
  console.log('✅ [PASS] 5. External Google picture update syncs when photoSource is google');
}

// 6. Switch back to Google Picture
{
  const userWithBothPhotos: Partial<AppUser> = {
    googlePhotoUrl: 'https://lh3.googleusercontent.com/a/user_google_photo',
    customPhotoUrl: 'https://firebasestorage.googleapis.com/v0/b/splitwiser/users/uid1/profile/avatar.jpg',
    photoSource: 'custom',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/splitwiser/users/uid1/profile/avatar.jpg',
  };

  // User selects "Use Google Picture"
  const switchedSource: ProfilePhotoSource = 'google';
  const resolved = resolveProfilePicture({
    customPhotoUrl: userWithBothPhotos.customPhotoUrl,
    googlePhotoUrl: userWithBothPhotos.googlePhotoUrl,
    photoSource: switchedSource,
  });

  assert.strictEqual(resolved.displayUrl, userWithBothPhotos.googlePhotoUrl, 'Should resolve to Google photo URL');
  assert.strictEqual(resolved.source, 'google', 'Source is google');
  console.log('✅ [PASS] 6. Switch back to Google picture resolves cleanly without deleting custom URL');
}

// 7. Remove Custom Picture with Google Account Photo available -> falls back to Google
{
  const googlePhoto = 'https://lh3.googleusercontent.com/a/google_fallback';
  const newSource: ProfilePhotoSource = 'google';
  const resolved = resolveProfilePicture({
    customPhotoUrl: undefined,
    googlePhotoUrl: googlePhoto,
    photoSource: newSource,
  });

  assert.strictEqual(resolved.displayUrl, googlePhoto, 'Must fall back to Google picture');
  assert.strictEqual(resolved.source, 'google', 'Source is google');
  console.log('✅ [PASS] 7. Removing custom picture falls back to Google picture');
}

// 8. Remove Custom Picture without Google Account Photo -> falls back to Initials
{
  const newSource: ProfilePhotoSource = 'none';
  const resolved = resolveProfilePicture({
    customPhotoUrl: undefined,
    googlePhotoUrl: undefined,
    photoSource: newSource,
  });

  assert.strictEqual(resolved.displayUrl, null, 'Must fall back to null displayUrl for initials rendering');
  assert.strictEqual(resolved.source, 'none', 'Source is none');
  console.log('✅ [PASS] 8. Removing picture without Google photo falls back to initials');
}

// 9. User without Google Authentication (e.g. Email/Password or Phone only)
{
  const emailUser: Partial<AppUser> = {
    authProvider: 'email',
    googlePhotoUrl: undefined,
    customPhotoUrl: undefined,
    photoSource: 'none',
  };

  const resolvedInitial = resolveProfilePicture(emailUser);
  assert.strictEqual(resolvedInitial.displayUrl, null, 'Email user starts with initials');
  assert.strictEqual(resolvedInitial.source, 'none', 'Initial source is none');

  // Email user uploads custom photo
  const uploadedUrl = 'https://firebasestorage.googleapis.com/custom_avatar.jpg';
  const resolvedAfterUpload = resolveProfilePicture({
    customPhotoUrl: uploadedUrl,
    photoSource: 'custom',
  });
  assert.strictEqual(resolvedAfterUpload.displayUrl, uploadedUrl, 'Email user uses custom uploaded photo');
  assert.strictEqual(resolvedAfterUpload.source, 'custom', 'Source is custom');
  console.log('✅ [PASS] 9. User without Google authentication manages custom avatars independently');
}

// 10. URL Validation & Broken/Invalid Fallback
{
  assert.strictEqual(isValidPhotoUrl('https://example.com/avatar.jpg'), true, 'Valid HTTPS URL');
  assert.strictEqual(isValidPhotoUrl('http://example.com/avatar.jpg'), true, 'Valid HTTP URL');
  assert.strictEqual(isValidPhotoUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true, 'Valid data URI');
  assert.strictEqual(isValidPhotoUrl(''), false, 'Empty string is invalid');
  assert.strictEqual(isValidPhotoUrl('   '), false, 'Whitespace is invalid');
  assert.strictEqual(isValidPhotoUrl(undefined), false, 'Undefined is invalid');
  assert.strictEqual(isValidPhotoUrl(null), false, 'Null is invalid');
  assert.strictEqual(isValidPhotoUrl('invalid-path-not-url'), false, 'Invalid format string');

  // Broken or empty URLs fallback cleanly
  const fallback = resolveProfilePicture({
    customPhotoUrl: '',
    googlePhotoUrl: '   ',
    photoSource: 'custom',
  });
  assert.strictEqual(fallback.displayUrl, null, 'Invalid URLs safely fall back to null (initials)');
  assert.strictEqual(fallback.source, 'none', 'Falls back to none source');
  console.log('✅ [PASS] 10. URL validation accurately detects broken/invalid photo URLs');
}

console.log('--- ALL 10 PROFILE PHOTO TEST SUITES PASSED ---');
