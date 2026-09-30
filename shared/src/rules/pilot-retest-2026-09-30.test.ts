// Pilot re-test of 30 September 2026, check 3.1: the temporary-password generator.
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeTemporaryPassword } from './temporary-password.ts';

describe('pilot re-test 3.1: temporary passwords', () => {
  it('1,000 generated passwords all match ^[a-z]+[0-9]{4}$', () => {
    // The same call the server makes (server/src/services/auth/passwords.ts).
    const passwords = Array.from({ length: 1000 }, () =>
      makeTemporaryPassword((n) => randomInt(n)),
    );
    for (const password of passwords)
      expect(password).toMatch(/^[a-z]+[0-9]{4}$/);
    // Not a requirement, but a sign the generator isn't stuck: most are different.
    expect(new Set(passwords).size).toBeGreaterThan(900);
  });
});
