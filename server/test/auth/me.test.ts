import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { loginSessions, users } from '../../src/db/schema.ts';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  TEST_PASSWORD,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);

beforeEach(() => resetDb(db));

describe('GET /api/me', () => {
  it('returns 401 without a cookie', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'not_logged_in',
      message: 'Please log in.',
    });
  });

  it('returns 401 for a made-up cookie', async () => {
    const response = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies: { omp_session: 'not-a-real-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns the user with a cookie, even one who must change their password', async () => {
    const user = await createUser(db, { mustChangePassword: true });
    const response = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies: await loginAs(app(), user),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: user.id,
      mustChangePassword: true,
    });
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('argon2');
  });
});

describe('POST /api/me/password', () => {
  async function change(
    cookies: Record<string, string>,
    currentPassword: string,
    newPassword: string,
  ) {
    return app().inject({
      method: 'POST',
      url: '/api/me/password',
      headers: APP_HEADERS,
      cookies,
      payload: { currentPassword, newPassword },
    });
  }

  it('returns 401 without a login', async () => {
    const response = await change({}, TEST_PASSWORD, 'a quiet river at dawn');
    expect(response.statusCode).toBe(401);
  });

  it('refuses a wrong current password with 401', async () => {
    const user = await createUser(db);
    const response = await change(
      await loginAs(app(), user),
      'not my password',
      'a quiet river at dawn',
    );
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'wrong_current_password' });
  });

  it.each([
    ['5 characters', 'ketle'],
    ['one character repeated', 'aaaaaaaa'],
    ['the username with digits added', 'dr.weakling12345'],
    ['the app name', 'my digicoach password'],
  ])('refuses %s as weak_password', async (_, newPassword) => {
    const user = await createUser(db, { username: 'dr.weakling' });
    const response = await change(
      await loginAs(app(), user),
      TEST_PASSWORD,
      newPassword,
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'weak_password' });
  });

  it('succeeds: new cookie, other logins ended, change no longer required', async () => {
    const user = await createUser(db, { mustChangePassword: true });
    const phone = await loginAs(app(), user);
    const laptop = await loginAs(app(), user);

    const response = await change(
      phone,
      TEST_PASSWORD,
      'a quiet river at dawn',
    );

    expect(response.statusCode).toBe(204);
    const newCookie = response.cookies.find((c) => c.name === 'omp_session');
    expect(newCookie?.value).toBeTruthy();
    expect(newCookie?.value).not.toBe(phone.omp_session);
    expect(newCookie?.httpOnly).toBe(true);

    const sessions = await db
      .select()
      .from(loginSessions)
      .where(eq(loginSessions.userId, user.id));
    expect(sessions).toHaveLength(1);

    for (const old of [phone, laptop]) {
      const me = await app().inject({
        method: 'GET',
        url: '/api/me',
        cookies: old,
      });
      expect(me.statusCode).toBe(401);
    }
    const me = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies: { omp_session: newCookie?.value ?? '' },
    });
    expect(me.json()).toMatchObject({ mustChangePassword: false });

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row?.mustChangePassword).toBe(false);

    const relogin = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: APP_HEADERS,
      payload: { username: user.username, password: 'a quiet river at dawn' },
    });
    expect(relogin.statusCode).toBe(200);
  });
});

describe('POST /api/me/tour', () => {
  async function markTour(cookies: Record<string, string>) {
    return app().inject({
      method: 'POST',
      url: '/api/me/tour',
      headers: APP_HEADERS,
      cookies,
      payload: {},
    });
  }

  it('returns 401 without a login', async () => {
    const response = await markTour({});
    expect(response.statusCode).toBe(401);
  });

  it('starts as null on /api/me, then keeps the first time it was set', async () => {
    const user = await createUser(db);
    const cookies = await loginAs(app(), user);
    const before = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies,
    });
    expect(before.json()).toMatchObject({ tourCompletedAt: null });

    expect((await markTour(cookies)).statusCode).toBe(204);
    const [first] = await db.select().from(users).where(eq(users.id, user.id));
    expect(first?.tourCompletedAt).toBeInstanceOf(Date);

    expect((await markTour(cookies)).statusCode).toBe(204);
    const [second] = await db.select().from(users).where(eq(users.id, user.id));
    expect(second?.tourCompletedAt).toEqual(first?.tourCompletedAt);

    const after = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies,
    });
    expect(after.json()).toMatchObject({
      tourCompletedAt: first?.tourCompletedAt?.toISOString(),
    });
  });
});
