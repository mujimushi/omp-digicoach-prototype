// Pilot re-test of 30 September 2026, check 3.1: the temporary-password generator.
import { describe, expect, it } from 'vitest';
import { makeTemporaryPassword } from './temporary-password.ts';

describe('pilot re-test 3.1: temporary passwords', () => {
  it('1,000 generated passwords all match ^[a-z]+[0-9]{4}$', () => {
    // The server passes node:crypto's randomInt (server/src/services/auth/passwords.ts); this
    // package has no Node types, so a uniform random integer below n stands in for it.
    const passwords = Array.from({ length: 1000 }, () =>
      makeTemporaryPassword((n) => Math.floor(Math.random() * n)),
    );
    for (const password of passwords)
      expect(password).toMatch(/^[a-z]+[0-9]{4}$/);
    // Not a requirement, but a sign the generator isn't stuck: most are different.
    expect(new Set(passwords).size).toBeGreaterThan(900);
  });
});
