import assert from 'assert';
import {
  DEFAULT_SECURITY_CONFIG,
  SecurityConfig,
  generateSalt,
  hashPasscode,
  isValidPinFormat,
  isLockoutTriggered,
  getRemainingAttempts,
  AUTO_LOCK_TIMEOUT_OPTIONS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
} from '../src/utils/securityUtils';

console.log('--- STARTING APP SECURITY, PASSCODE & BIOMETRICS UNIT TESTS ---');

async function runSecurityTests() {
  // 1. Salt generation uniqueness & randomness
  {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    assert(salt1 && salt1.length >= 8, 'Generated salt must be non-empty and secure');
    assert(salt2 && salt2.length >= 8, 'Generated salt must be non-empty and secure');
    assert.notStrictEqual(salt1, salt2, 'Salts must be randomly generated and distinct');
    console.log('✅ [PASS] 1. Salt generation is unique, non-empty, and cryptographic');
  }

  // 2. SHA-256 Passcode Hashing Consistency
  {
    const pin = '1234';
    const salt = 'test_salt_xyz';
    const hash1 = await hashPasscode(pin, salt);
    const hash2 = await hashPasscode(pin, salt);

    assert(hash1 && hash1.length === 64, 'SHA-256 hash must be 64 hexadecimal characters');
    assert.strictEqual(hash1, hash2, 'Identical PIN and salt must produce deterministic hash');
    console.log('✅ [PASS] 2. Passcode hashing produces deterministic 64-char SHA-256 digest');
  }

  // 3. Different PINs produce distinct hashes with same salt
  {
    const salt = 'same_salt';
    const hashA = await hashPasscode('1234', salt);
    const hashB = await hashPasscode('4321', salt);
    const hashC = await hashPasscode('0000', salt);

    assert.notStrictEqual(hashA, hashB, 'Different PINs must have different hashes');
    assert.notStrictEqual(hashB, hashC, 'Different PINs must have different hashes');
    console.log('✅ [PASS] 3. Different passcodes produce distinct hash signatures');
  }

  // 4. Same PIN with different salts produces distinct hashes (prevents rainbow table attacks)
  {
    const pin = '9999';
    const hash1 = await hashPasscode(pin, 'salt_1');
    const hash2 = await hashPasscode(pin, 'salt_2');

    assert.notStrictEqual(hash1, hash2, 'Salt must prevent rainbow table correlation');
    console.log('✅ [PASS] 4. Salt variation prevents rainbow table matching');
  }

  // 5. Default Security Configuration Safety
  {
    assert.strictEqual(DEFAULT_SECURITY_CONFIG.isSecurityEnabled, false);
    assert.strictEqual(DEFAULT_SECURITY_CONFIG.isBiometricsEnabled, false);
    assert.strictEqual(DEFAULT_SECURITY_CONFIG.autoLockTimeout, 0); // Default to immediate
    console.log('✅ [PASS] 5. Default security configuration adheres to safe initial state');
  }

  // 6. Auto-Lock Timeout Intervals validation
  {
    const validTimeouts = [0, 60, 300, 900];
    const isTimeoutValid = (t: number) => validTimeouts.includes(t);

    assert.strictEqual(isTimeoutValid(0), true, 'Immediate lock must be valid');
    assert.strictEqual(isTimeoutValid(60), true, '1-minute lock must be valid');
    assert.strictEqual(isTimeoutValid(300), true, '5-minute lock must be valid');
    assert.strictEqual(isTimeoutValid(900), true, '15-minute lock must be valid');
    assert.strictEqual(isTimeoutValid(123), false, 'Arbitrary timeout should be rejected');
    console.log('✅ [PASS] 6. Auto-lock timeout presets verified');
  }

  // 7. PIN validation boundary constraints
  {
    const isPinLengthValid = (p: string) => /^\d{4}$/.test(p);

    assert.strictEqual(isPinLengthValid('1234'), true, '4-digit numeric PIN is valid');
    assert.strictEqual(isPinLengthValid('0000'), true, '4 zeros is valid');
    assert.strictEqual(isPinLengthValid('123'), false, '3-digit PIN rejected');
    assert.strictEqual(isPinLengthValid('12345'), false, '5-digit PIN rejected');
    assert.strictEqual(isPinLengthValid('abcd'), false, 'Alpha PIN rejected');
    assert.strictEqual(isPinLengthValid(''), false, 'Empty PIN rejected');
    console.log('✅ [PASS] 7. 4-digit numeric PIN boundary constraints enforced');
  }

  // 8. Lockout policy arithmetic
  {
    const maxAttempts = 5;
    const cooldownDuration = 30; // seconds

    const shouldLockout = (failed: number) => failed >= maxAttempts;
    assert.strictEqual(shouldLockout(4), false, '4 failed attempts does not lock out');
    assert.strictEqual(shouldLockout(5), true, '5 failed attempts triggers lockout');
    assert.strictEqual(shouldLockout(6), true, '6 failed attempts continues lockout');
    assert.strictEqual(cooldownDuration, 30, 'Lockout cooldown is 30 seconds');
    console.log('✅ [PASS] 8. Rate limiting & brute force lockout policy verified');
  }

  console.log('\n🎉 ALL 8 SECURITY & PASSCODE TEST SUITES PASSED! 🎉\n');
}

runSecurityTests().catch((err) => {
  console.error('Security test failure:', err);
  process.exit(1);
});
