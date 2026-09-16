import { describe, expect, it } from 'vitest';
import { lockDurationMs } from '../../src/services/auth/attempts.ts';
import {
  checkPasswordRules,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '../../src/services/auth/passwords.ts';

describe('checkPasswordRules', () => {
  it.each([
    'a quiet river at dawn',
    'fifteen letters',
    'KORMA and naan on tuesdays',
    'x'.repeat(10) + 'yz789',
  ])('accepts %j with no composition rules', (password) => {
    expect(checkPasswordRules(password, 'dr.sana')).toBeNull();
  });

  it.each([
    ['14 characters', 'abcdefghijklmn', /at least 15/],
    ['129 characters', 'ab'.repeat(64) + 'c', /at most 128/],
    ['a common password', 'baseball1234567', /too common/],
    ['a common password with digits added', 'password1234567', /too common/],
    ['one character repeated', 'aaaaaaaaaaaaaaaa', /too common/],
    ['the app name', 'OMP DigiCoach 2026!', /app’s name/],
    ['the username', 'dr.sana is my login', /username/],
  ])('refuses %s', (_, password, message) => {
    expect(checkPasswordRules(password, 'dr.sana')).toMatch(message);
  });

  it('counts characters, not bytes', () => {
    expect(checkPasswordRules('سلام دنیا خوش آمدید', 'dr.sana')).toBeNull();
  });
});

describe('generateTemporaryPassword', () => {
  it('makes four groups of four readable characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){3}$/);
      expect(password).not.toMatch(/[01ilo]/);
    }
  });

  it('meets the password rules', () => {
    expect(
      checkPasswordRules(generateTemporaryPassword(), 'dr.new'),
    ).toBeNull();
  });
});

describe('hashing', () => {
  it('uses Argon2id with OWASP settings and verifies', async () => {
    const stored = await hashPassword('a quiet river at dawn');
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(stored, 'a quiet river at dawn')).toBe(true);
    expect(await verifyPassword(stored, 'a quiet river at dusk')).toBe(false);
    expect(await verifyPassword('not a hash', 'x')).toBe(false);
  });
});

describe('lockDurationMs', () => {
  it('is 0 up to 5 failures, then doubles from 1 second to 15 minutes', () => {
    expect([1, 5].map(lockDurationMs)).toEqual([0, 0]);
    expect([6, 7, 8, 9].map(lockDurationMs)).toEqual([1000, 2000, 4000, 8000]);
    expect(lockDurationMs(15)).toBe(512_000);
    expect(lockDurationMs(16)).toBe(900_000);
    expect(lockDurationMs(100)).toBe(900_000);
  });
});
