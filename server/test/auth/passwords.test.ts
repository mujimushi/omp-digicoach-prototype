import { TEMPORARY_PASSWORD_WORDS } from '@omp/shared';
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
    'kettle',
    'coach123',
    'password1234567',
    'KORMA and naan on tuesdays',
    'x'.repeat(10) + 'yz789',
  ])('accepts %j with no composition rules', (password) => {
    expect(checkPasswordRules(password, 'dr.sana')).toBeNull();
  });

  it.each([
    ['5 characters', 'ketle', /at least 6/],
    ['129 characters', 'ab'.repeat(64) + 'c', /at most 128/],
    ['one character repeated', 'aaaaaaaaaaaaaaaa', /two different/],
    ['two characters repeated', 'ababab', /two different/],
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
  it('makes one lower-case word and four digits, such as river4827', () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[a-z]{3,6}\d{4}$/);
      expect(TEMPORARY_PASSWORD_WORDS).toContain(password.slice(0, -4));
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
