import { KNOWN_USERS } from '@omp/shared/fixtures';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAttempts, loginSessions, users } from '../../src/db/schema.ts';
import { clearFailures } from '../../src/services/auth/attempts.ts';
import { passwordHasher } from '../../src/services/auth/passwords.ts';
import {
  APP_HEADERS,
  buildTestApp,
  createUser,
  TEST_PASSWORD,
  testConfig,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
let clock = new Date('2026-09-17T08:00:00.000Z');
const app = useTestApp(db, () => ({ now: () => clock }));

beforeEach(async () => {
  await resetDb(db);
  clock = new Date('2026-09-17T08:00:00.000Z');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function login(username: string, password: string, ip = '10.0.0.1') {
  return app().inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: APP_HEADERS,
    payload: { username, password },
    remoteAddress: ip,
  });
}

describe('POST /api/auth/login', () => {
  it('returns the user and a login cookie with the expected flags', async () => {
    const user = await createUser(db, { username: 'dr.sana' });

    const response = await login('Dr.Sana', TEST_PASSWORD);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: user.id,
      name: user.name,
      username: 'dr.sana',
      department: user.department,
      designation: user.designation,
      isDoctor: true,
      isAdmin: false,
      active: true,
      mustChangePassword: false,
      tourCompletedAt: null,
    });
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/^omp_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
    expect(cookie).not.toContain('Domain');
  });

  it('stores only the SHA-256 of the token and records the login time', async () => {
    const user = await createUser(db);
    const response = await login(user.username, TEST_PASSWORD);
    const token = response.cookies[0]?.value ?? '';

    const rows = await db.select().from(loginSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.id).not.toContain(token);
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored?.lastLoginAt).toEqual(clock);
  });

  it('gives the same 401 body for a wrong password, an unknown username and a switched-off account', async () => {
    await createUser(db, { username: 'dr.real' });
    await createUser(db, { username: 'dr.off', active: false });

    const responses = await Promise.all([
      login('dr.real', 'not the right password'),
      login('dr.nobody', TEST_PASSWORD),
      login('dr.off', TEST_PASSWORD),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        code: 'invalid_credentials',
        message: 'Wrong username or password',
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('verifies one password against the dummy hash for an unknown username', async () => {
    const verify = vi.spyOn(passwordHasher, 'verify');

    const response = await login('dr.nobody', 'some password or other');

    expect(response.statusCode).toBe(401);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0]?.[0]).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
    expect(verify.mock.calls[0]?.[1]).toBe('some password or other');
  });

  it('refuses a malformed body with validation_failed', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: APP_HEADERS,
      payload: { username: 'dr.sana' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
  });

  describe('failed logins', () => {
    it('six failures lock the username; each further failure doubles the lock', async () => {
      await createUser(db, { username: 'dr.lock' });

      for (let i = 1; i <= 5; i += 1) {
        expect((await login('dr.lock', 'wrong password')).statusCode).toBe(401);
      }
      let [row] = await db.select().from(loginAttempts);
      expect(row?.lockedUntil).toBeNull();

      expect((await login('dr.lock', 'wrong password')).statusCode).toBe(401);
      [row] = await db.select().from(loginAttempts);
      expect(row?.failures).toBe(6);
      expect(row?.lockedUntil?.getTime()).toBe(clock.getTime() + 1000);

      // Locked: even the right password is refused.
      const locked = await login('dr.lock', TEST_PASSWORD);
      expect(locked.statusCode).toBe(429);
      expect(locked.json()).toMatchObject({ code: 'too_many_attempts' });

      clock = new Date(clock.getTime() + 1001);
      expect((await login('dr.lock', 'wrong password')).statusCode).toBe(401);
      [row] = await db.select().from(loginAttempts);
      expect(row?.lockedUntil?.getTime()).toBe(clock.getTime() + 2000);

      clock = new Date(clock.getTime() + 2001);
      expect((await login('dr.lock', 'wrong password')).statusCode).toBe(401);
      [row] = await db.select().from(loginAttempts);
      expect(row?.lockedUntil?.getTime()).toBe(clock.getTime() + 4000);
    });

    it('locks at most 15 minutes', async () => {
      await db
        .insert(loginAttempts)
        .values({ usernameLower: 'dr.many', failures: 40 });
      expect((await login('dr.many', 'wrong password')).statusCode).toBe(401);
      const [row] = await db.select().from(loginAttempts);
      expect(row?.lockedUntil?.getTime()).toBe(
        clock.getTime() + 15 * 60 * 1000,
      );
    });

    it('tracks unknown usernames too, so a lock reveals nothing', async () => {
      for (let i = 1; i <= 6; i += 1) await login('dr.ghost', 'wrong password');
      expect((await login('dr.ghost', 'wrong password')).statusCode).toBe(429);
    });

    it('a successful login after the lock ends clears the failures', async () => {
      await createUser(db, { username: 'dr.back' });
      for (let i = 1; i <= 6; i += 1) await login('dr.back', 'wrong password');

      clock = new Date(clock.getTime() + 1001);
      expect((await login('dr.back', TEST_PASSWORD)).statusCode).toBe(200);
      expect(await db.select().from(loginAttempts)).toEqual([]);
    });

    it('an admin password reset clears the failures', async () => {
      await createUser(db, { username: 'dr.reset' });
      for (let i = 1; i <= 6; i += 1) await login('dr.reset', 'wrong password');

      // The admin reset route (phase 4D) calls this.
      await clearFailures(db, 'dr.reset');

      expect((await login('dr.reset', TEST_PASSWORD)).statusCode).toBe(200);
    });
  });

  it('limits each IP address to 20 login attempts in 15 minutes', async () => {
    await createUser(db, { username: 'dr.ip' });
    for (let i = 0; i < 20; i += 1) {
      const response = await login(`someone${i}`, 'wrong password', '10.9.9.9');
      expect(response.statusCode).toBe(401);
    }
    const blocked = await login('dr.ip', TEST_PASSWORD, '10.9.9.9');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ code: 'too_many_attempts' });

    // Another address is unaffected.
    expect((await login('dr.ip', TEST_PASSWORD, '10.1.1.1')).statusCode).toBe(
      200,
    );
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the login, so the old cookie then gets 401', async () => {
    const user = await createUser(db);
    const loggedIn = await login(user.username, TEST_PASSWORD);
    const cookies = { omp_session: loggedIn.cookies[0]?.value ?? '' };

    const logout = await app().inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: APP_HEADERS,
      payload: {},
      cookies,
    });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toMatch(/omp_session=;/);
    expect(await db.select().from(loginSessions)).toEqual([]);

    const me = await app().inject({ method: 'GET', url: '/api/me', cookies });
    expect(me.statusCode).toBe(401);
  });
});

describe('the login cookie in production', () => {
  it('is __Host-omp_session with Secure, HttpOnly and SameSite=Strict', async () => {
    const production = await buildTestApp(db, {
      config: testConfig({ NODE_ENV: 'production' }),
    });
    try {
      await createUser(db, { username: KNOWN_USERS.doctor.username });
      const response = await production.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: APP_HEADERS,
        payload: {
          username: KNOWN_USERS.doctor.username,
          password: TEST_PASSWORD,
        },
      });
      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toMatch(/^__Host-omp_session=/);
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Domain');
    } finally {
      await production.close();
    }
  });
});
