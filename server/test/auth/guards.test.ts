import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { loginSessions } from '../../src/db/schema.ts';
import { requireAdmin, requireDoctor } from '../../src/plugins/auth.ts';
import { SESSION_RULES } from '../../src/services/auth/sessions.ts';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  TEST_PASSWORD,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
let clock = new Date('2026-09-17T08:00:00.000Z');

async function probeRoutes(api: FastifyInstance) {
  api.get('/probe/doctor', { onRequest: requireDoctor }, async () => ({
    ok: true,
  }));
  api.get('/probe/admin', { onRequest: requireAdmin }, async () => ({
    ok: true,
  }));
  api.post('/probe/change', async () => ({ ok: true }));
}

const app = useTestApp(db, () => ({
  now: () => clock,
  extraApiRoutes: probeRoutes,
}));

beforeEach(async () => {
  await resetDb(db);
  clock = new Date('2026-09-17T08:00:00.000Z');
});

async function get(url: string, cookies: Record<string, string>) {
  return app().inject({ method: 'GET', url, cookies });
}

describe('change-request guard', () => {
  function post(headers: Record<string, string>) {
    return app().inject({
      method: 'POST',
      url: '/api/probe/change',
      headers,
      payload: JSON.stringify({}),
    });
  }

  it('lets a change through with both headers', async () => {
    expect((await post({ ...APP_HEADERS })).statusCode).toBe(200);
  });

  it('allows the app’s own origin', async () => {
    const response = await post({
      ...APP_HEADERS,
      host: 'omp.example.org',
      origin: 'http://omp.example.org',
    });
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['without X-OMP-Client', { 'content-type': 'application/json' }],
    [
      'with Content-Type text/plain',
      { 'content-type': 'text/plain', 'x-omp-client': 'app' },
    ],
    ['with another X-OMP-Client', { ...APP_HEADERS, 'x-omp-client': 'curl' }],
    [
      'with a foreign Origin',
      { ...APP_HEADERS, origin: 'https://evil.example' },
    ],
    ['with Origin null', { ...APP_HEADERS, origin: 'null' }],
  ])('refuses a change %s with 403', async (_, headers) => {
    const response = await post(headers as Record<string, string>);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('guards the login route too', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'x', password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('requireDoctor and requireAdmin', () => {
  it('return 403 password_change_required while a change is pending', async () => {
    const doctor = await createUser(db, { mustChangePassword: true });
    const admin = await createUser(db, {
      isAdmin: true,
      mustChangePassword: true,
    });

    for (const [user, url] of [
      [doctor, '/api/probe/doctor'],
      [admin, '/api/probe/admin'],
    ] as const) {
      const response = await get(url, await loginAs(app(), user, clock));
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'password_change_required',
      });
    }
  });

  it('refuse a doctor on an admin route and an admin-only user on a doctor route', async () => {
    const doctor = await createUser(db);
    const admin = await createUser(db, { isDoctor: false, isAdmin: true });

    const doctorOnAdmin = await get(
      '/api/probe/admin',
      await loginAs(app(), doctor, clock),
    );
    expect(doctorOnAdmin.statusCode).toBe(403);
    expect(doctorOnAdmin.json()).toMatchObject({ code: 'forbidden' });

    const adminOnDoctor = await get(
      '/api/probe/doctor',
      await loginAs(app(), admin, clock),
    );
    expect(adminOnDoctor.statusCode).toBe(403);
  });

  it('let the right user through', async () => {
    const doctor = await createUser(db);
    const admin = await createUser(db, { isAdmin: true });
    expect(
      (await get('/api/probe/doctor', await loginAs(app(), doctor, clock)))
        .statusCode,
    ).toBe(200);
    expect(
      (await get('/api/probe/admin', await loginAs(app(), admin, clock)))
        .statusCode,
    ).toBe(200);
  });

  it('give a switched-off user 401, clear the cookie and delete their logins', async () => {
    const doctor = await createUser(db, { active: false });
    const cookies = await loginAs(app(), doctor, clock);

    const response = await get('/api/probe/doctor', cookies);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'not_logged_in' });
    expect(response.json().message).toContain('switched off');
    expect(String(response.headers['set-cookie'])).toMatch(/omp_session=;/);
    expect(await db.select().from(loginSessions)).toEqual([]);
  });
});

describe('login expiry', () => {
  async function ageSession(changes: { lastSeenAt?: Date; createdAt?: Date }) {
    await db.update(loginSessions).set(changes);
  }

  const DAY_MS = 86_400_000;

  it('keeps a doctor logged in while used within 400 days, and ends it after 401 unused days', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor, clock);

    await ageSession({ lastSeenAt: new Date(clock.getTime() - 399 * DAY_MS) });
    expect((await get('/api/me', cookies)).statusCode).toBe(200);

    await ageSession({ lastSeenAt: new Date(clock.getTime() - 401 * DAY_MS) });
    expect((await get('/api/me', cookies)).statusCode).toBe(401);
    expect(await db.select().from(loginSessions)).toEqual([]);
  });

  it('keeps a doctor logged in two years after login, when the phone is used', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor, clock);
    clock = new Date(clock.getTime() + 730 * DAY_MS);
    await ageSession({ lastSeenAt: new Date(clock.getTime() - 2 * DAY_MS) });
    // The login's end moved forward with each use; here, as if used two days ago.
    await db
      .update(loginSessions)
      .set({ expiresAt: new Date(clock.getTime() + 398 * DAY_MS) });
    expect((await get('/api/me', cookies)).statusCode).toBe(200);
  });

  it('moves a doctor login’s end forward and sends the cookie again, at most once a minute', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor, clock);

    clock = new Date(clock.getTime() + 30_000);
    const soon = await get('/api/me', cookies);
    expect(soon.headers['set-cookie']).toBeUndefined();

    clock = new Date(clock.getTime() + 5 * DAY_MS);
    const later = await get('/api/me', cookies);
    expect(String(later.headers['set-cookie'])).toMatch(
      new RegExp(`^omp_session=${cookies.omp_session};.*Max-Age=34560000`),
    );
    const [row] = await db.select().from(loginSessions);
    expect(row?.expiresAt.getTime()).toBe(clock.getTime() + 400 * DAY_MS);
  });

  it('still clears the cookie at logout when the login moved forward in the same request', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor, clock);
    clock = new Date(clock.getTime() + 2 * DAY_MS);
    const response = await app().inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: APP_HEADERS,
      cookies,
      payload: {},
    });
    expect(response.statusCode).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/^omp_session=;/);
    expect(await db.select().from(loginSessions)).toEqual([]);
  });

  it('refuses an admin-only login unused for 31 minutes', async () => {
    const admin = await createUser(db, { isAdmin: true, isDoctor: false });
    const cookies = await loginAs(app(), admin, clock);

    await ageSession({ lastSeenAt: new Date(clock.getTime() - 29 * 60_000) });
    expect((await get('/api/me', cookies)).statusCode).toBe(200);

    await ageSession({ lastSeenAt: new Date(clock.getTime() - 31 * 60_000) });
    expect((await get('/api/me', cookies)).statusCode).toBe(401);
  });

  it('refuses an admin-only login older than 8 hours even when used recently', async () => {
    const admin = await createUser(db, { isAdmin: true, isDoctor: false });
    const cookies = await loginAs(app(), admin, clock);
    await ageSession({
      createdAt: new Date(clock.getTime() - SESSION_RULES.admin.maxMs - 1000),
      lastSeenAt: new Date(clock.getTime() - 60_000),
    });
    expect((await get('/api/me', cookies)).statusCode).toBe(401);
  });

  it('refreshes last use at most once a minute', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor, clock);

    clock = new Date(clock.getTime() + 30_000);
    await get('/api/me', cookies);
    let [row] = await db.select().from(loginSessions);
    expect(row?.lastSeenAt.getTime()).toBe(clock.getTime() - 30_000);

    clock = new Date(clock.getTime() + 60_000);
    await get('/api/me', cookies);
    [row] = await db.select().from(loginSessions);
    expect(row?.lastSeenAt.getTime()).toBe(clock.getTime());
  });
});
