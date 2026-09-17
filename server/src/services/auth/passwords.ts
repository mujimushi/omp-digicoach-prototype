import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hash, verify } from '@node-rs/argon2';
import { LIMITS } from '@omp/shared';

/** OWASP's recommended Argon2id settings. Argon2id is the library's default algorithm. */
const ARGON2_SETTINGS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

/**
 * Hashing goes through this object so tests can spy on `verify`, for example to prove a login
 * with an unknown username still runs one verification.
 */
export const passwordHasher = {
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_SETTINGS);
  },
  async verify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  },
};

export function hashPassword(password: string): Promise<string> {
  return passwordHasher.hash(password);
}

export function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  return passwordHasher.verify(storedHash, password);
}

let dummyHash: Promise<string> | undefined;

/** A real hash with the same settings, verified when a username doesn't exist, so timing reveals nothing. */
export function getDummyHash(): Promise<string> {
  dummyHash ??= passwordHasher.hash('no such user, but take the same time');
  return dummyHash;
}

// The 10,000 most common passwords, from SecLists (MIT licence):
// github.com/danielmiessler/SecLists, Passwords/Common-Credentials/10k-most-common.txt.
// The path resolves to the source file from both src/ and dist/.
const COMMON_PASSWORDS_FILE = new URL(
  '../../../src/services/auth/common-passwords.txt',
  import.meta.url,
);

let commonPasswords: Set<string> | undefined;

function loadCommonPasswords(): Set<string> {
  commonPasswords ??= new Set(
    readFileSync(COMMON_PASSWORDS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean),
  );
  return commonPasswords;
}

function isCommon(password: string): boolean {
  const list = loadCommonPasswords();
  const lower = password.toLowerCase();
  const candidates = [
    lower,
    lower.replace(/\s+/g, ''),
    // "password1234567" is "password" with digits added.
    lower.replace(/[^\p{L}]+$/u, ''),
    lower.replace(/^[^\p{L}]+/u, ''),
  ];
  return candidates.some(
    (candidate) => candidate !== '' && list.has(candidate),
  );
}

/**
 * Rules for a new password: 6 to 128 characters, not a common password, not the app's name and not
 * the username. No composition rules. NIST SP 800-63B-4 asks for 15 characters; Sadia chose 6 on
 * 2026-09-17. Returns the problem, or null.
 */
export function checkPasswordRules(
  password: string,
  username: string,
): string | null {
  const length = [...password].length;
  if (length < LIMITS.passwordMin) {
    return `Use at least ${LIMITS.passwordMin} characters. A phrase of several words works well.`;
  }
  if (length > LIMITS.passwordMax) {
    return `Use at most ${LIMITS.passwordMax} characters.`;
  }
  const squashed = password.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (new Set(squashed).size <= 2 || isCommon(password)) {
    return 'That password is too common. Choose a phrase only you would use.';
  }
  if (squashed.includes('digicoach')) {
    return 'Don’t use the app’s name in your password.';
  }
  const user = username.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (user.length >= 3 && squashed.includes(user)) {
    return 'Don’t use your username in your password.';
  }
  return null;
}

/** Lower-case letters and digits without look-alikes such as 0, o, 1, l and i. */
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Four groups of four readable characters, such as k7mq-3xrp-9dwt-2hvf. */
export function generateTemporaryPassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join(
      '',
    );
  return [group(), group(), group(), group()].join('-');
}
