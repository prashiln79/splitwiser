// ─── Security Types & Constants ───────────────────────────────────────────────
export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface SecurityConfig {
  isSecurityEnabled: boolean;
  isBiometricsEnabled: boolean;
  autoLockTimeout: number; // 0 = immediately, 60 = 1 min, 300 = 5 min, 900 = 15 min
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  isSecurityEnabled: false,
  isBiometricsEnabled: false,
  autoLockTimeout: 0,
};

export const AUTO_LOCK_TIMEOUT_OPTIONS = [
  { label: 'Immediately', seconds: 0 },
  { label: 'After 1 minute', seconds: 60 },
  { label: 'After 5 minutes', seconds: 300 },
  { label: 'After 15 minutes', seconds: 900 },
];

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 30;

// ─── Salt Generation ──────────────────────────────────────────────────────────
export function generateSalt(): string {
  try {
    const Crypto = require('expo-crypto');
    if (Crypto && typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {}

  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto && typeof nodeCrypto.randomUUID === 'function') {
      return nodeCrypto.randomUUID();
    }
  } catch {}

  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// ─── Cryptographic Passcode Hashing ───────────────────────────────────────────
export async function hashPasscode(pin: string, salt: string): Promise<string> {
  const payload = `splitwiser_salt_${salt}_pin_${pin}`;

  try {
    const Crypto = require('expo-crypto');
    if (Crypto && typeof Crypto.digestStringAsync === 'function') {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        payload
      );
    }
  } catch {}

  // Fallback for node test runners
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(payload).digest('hex');
  } catch {
    throw new Error('No cryptographic SHA-256 implementation available');
  }
}

// ─── Validation & Lockout Helpers ─────────────────────────────────────────────
export function isValidPinFormat(pin: string): boolean {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export function isLockoutTriggered(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function getRemainingAttempts(failedAttempts: number): number {
  return Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
}
