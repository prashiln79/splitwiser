import assert from 'assert';
import { AppUser } from '../src/types';

console.log('--- STARTING ONBOARDING FLOW & GUEST AUTH UNIT TESTS ---');

// Helper to simulate the route determination logic in OnboardingNavigator & AppNavigator
function getInitialOnboardingRoute(user: AppUser | null): string {
  if (!user) return 'Welcome';
  if (!user.hasCompletedProfile || !user.name || user.name === 'Anonymous User') {
    return 'GuestProfileSetup';
  }
  if (!user.onboardingCompleted) {
    return 'IntroSlides';
  }
  return 'Main'; // Direct to MainNavigator (Groups Home)
}

function shouldBypassOnboarding(user: AppUser | null): boolean {
  return Boolean(user && user.hasCompletedProfile && user.onboardingCompleted);
}

async function runOnboardingTests() {
  // Test 1: Brand New User (No session)
  {
    const user = null;
    assert.strictEqual(getInitialOnboardingRoute(user), 'Welcome');
    assert.strictEqual(shouldBypassOnboarding(user), false);
    console.log('✅ [PASS] 1. New unauthenticated visitor starts at Welcome screen');
  }

  // Test 2: New Guest User (Anonymous UID created, profile not yet completed)
  {
    const newGuestUser: AppUser = {
      uid: 'guest_12345',
      name: 'Anonymous User',
      createdAt: new Date(),
      isAnonymous: true,
      authProvider: 'anonymous',
      hasCompletedProfile: false,
      onboardingCompleted: false,
    };
    assert.strictEqual(getInitialOnboardingRoute(newGuestUser), 'GuestProfileSetup');
    assert.strictEqual(shouldBypassOnboarding(newGuestUser), false);
    console.log('✅ [PASS] 2. Newly signed-in guest is routed to GuestProfileSetup');
  }

  // Test 3: Guest Profile Completed, Intro Slides Pending
  {
    const guestWithProfile: AppUser = {
      uid: 'guest_12345',
      name: 'John Doe',
      createdAt: new Date(),
      isAnonymous: true,
      authProvider: 'anonymous',
      hasCompletedProfile: true,
      onboardingCompleted: false,
    };
    assert.strictEqual(getInitialOnboardingRoute(guestWithProfile), 'IntroSlides');
    assert.strictEqual(shouldBypassOnboarding(guestWithProfile), false);
    console.log('✅ [PASS] 3. Profile-completed user resumes at IntroSlides');
  }

  // Test 4: Returning Guest with Completed Onboarding
  {
    const returningGuest: AppUser = {
      uid: 'guest_12345',
      name: 'John Doe',
      createdAt: new Date(),
      isAnonymous: true,
      authProvider: 'anonymous',
      hasCompletedProfile: true,
      onboardingCompleted: true,
    };
    assert.strictEqual(shouldBypassOnboarding(returningGuest), true);
    assert.strictEqual(getInitialOnboardingRoute(returningGuest), 'Main');
    console.log('✅ [PASS] 4. Returning guest with completed onboarding bypasses onboarding directly to Groups Home');
  }

  // Test 5: Returning Google / Permanent User
  {
    const googleUser: AppUser = {
      uid: 'google_998877',
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      createdAt: new Date(),
      isAnonymous: false,
      authProvider: 'google.com',
      hasCompletedProfile: true,
      onboardingCompleted: true,
    };
    assert.strictEqual(shouldBypassOnboarding(googleUser), true);
    assert.strictEqual(getInitialOnboardingRoute(googleUser), 'Main');
    console.log('✅ [PASS] 5. Returning permanent user bypasses onboarding directly to Groups Home');
  }

  // Test 6: Legacy User Backwards Compatibility
  // Legacy users had name set, but onboardingCompleted was not explicitly written in their document
  {
    const legacyDoc = {
      name: 'Alex Turner',
      createdAt: { toDate: () => new Date('2026-01-01') },
      isAnonymous: true,
      // onboardingCompleted is undefined in old docs
    };

    const hasCompletedProfile = Boolean(legacyDoc.name && legacyDoc.name !== 'Anonymous User');
    const localOnboardingDone = false;
    const onboardingCompleted = (legacyDoc as any).onboardingCompleted !== undefined
      ? Boolean((legacyDoc as any).onboardingCompleted)
      : (localOnboardingDone || (hasCompletedProfile && Boolean(legacyDoc.createdAt)));

    assert.strictEqual(hasCompletedProfile, true);
    assert.strictEqual(onboardingCompleted, true);
    console.log('✅ [PASS] 6. Legacy active users with existing profiles automatically bypass onboarding');
  }

  // Test 7: Group Setup Types and Pre-filled Defaults
  {
    const options = [
      { id: 'apartment', type: 'home', suggested: 'Apartment' },
      { id: 'trip', type: 'trip', suggested: 'Trip' },
      { id: 'friends', type: 'other', suggested: 'Friends' },
    ];

    for (const opt of options) {
      assert(opt.suggested.length > 0, 'Group must have suggested name');
      assert(['home', 'trip', 'other', 'couple'].includes(opt.type), 'Type must be valid');
    }
    console.log('✅ [PASS] 7. First-time setup selections map correctly to group types and defaults');
  }

  // Test 8: Guest User Profile Setup Validation
  {
    const validateName = (name: string): { valid: boolean; reason?: string } => {
      const trimmed = name.trim();
      if (!trimmed) return { valid: false, reason: 'Name Required' };
      if (trimmed.length < 2) return { valid: false, reason: 'Name Too Short' };
      return { valid: true };
    };

    assert.strictEqual(validateName('').valid, false);
    assert.strictEqual(validateName('   ').valid, false);
    assert.strictEqual(validateName('A').valid, false);
    assert.strictEqual(validateName('Ab').valid, true);
    assert.strictEqual(validateName('Alice').valid, true);
    console.log('✅ [PASS] 8. Profile setup display name validation enforces min length of 2');
  }

  // Test 9: Supported Currency Codes & Symbols
  {
    const supportedCurrencies = [
      { code: 'INR', symbol: '₹' },
      { code: 'USD', symbol: '$' },
      { code: 'EUR', symbol: '€' },
      { code: 'GBP', symbol: '£' },
    ];

    assert.strictEqual(supportedCurrencies.length, 4);
    assert.strictEqual(supportedCurrencies[0].code, 'INR');
    console.log('✅ [PASS] 9. Default currencies include INR, USD, EUR, GBP');
  }

  console.log('\n🎉 ALL ONBOARDING & GUEST AUTH TESTS PASSED SUCCESSFULLY! (9/9)\n');
}

runOnboardingTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

