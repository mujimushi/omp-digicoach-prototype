import { hash, verify } from '@node-rs/argon2';

/** OWASP's recommended Argon2id settings. Argon2id is the library's default algorithm. */
const ARGON2_SETTINGS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_SETTINGS);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
