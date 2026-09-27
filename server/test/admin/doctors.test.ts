import { ONE_ROLE } from '@omp/shared';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditLog, loginAttempts, users } from '../../src/db/schema.ts';
import { verifyPassword } from '../../src/services/auth/passwords.ts';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  TEST_PASSWORD,
  type TestUser,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);
let admin: TestUser;
let adminCookies: Record<string, string>;

beforeEach(async () => {
  await resetDb(db);
  admin = await createUser(db, {
    name: 'Admin',
    username: 'admin.one',
    isAdmin: true,
    isDoctor: false,
  });
  adminCookies = await loginAs(app(), admin);
});

function adminCall(
  method: 'POST' | 'PATCH' | 'GET',
  url: string,
  payload?: unknown,
) {
  return app().inject({
    method,
    url,
    cookies: adminCookies,
    ...(method === 'GET'
      ? {}
      : { headers: APP_HEADERS, payload: payload ?? {} }),
  });
}

function login(username: string, password: string) {
  return app().inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: APP_HEADERS,
    payload: { username, password },
  });
}

const newDoctor = {
  name: 'Dr. Zara Shah',
  username: 'dr.zara',
  department: 'pediatrics',
  designation: 'registrar',
};

describe('create doctor', () => {
  it('stores a hash that verifies with the temporary password, requires a change, and writes audit_log', async () => {
    const response = await adminCall('POST', '/api/admin/doctors', newDoctor);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.doctor).toMatchObject({
      ...newDoctor,
      isDoctor: true,
      isAdmin: false,
      mustChangePassword: true,
      active: true,
    });
    expect(body.temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'dr.zara'));
    expect(
      await verifyPassword(row?.passwordHash ?? '', body.temporaryPassword),
    ).toBe(true);
    expect(response.body).not.toContain(row?.passwordHash ?? 'never');

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'doctor.create'));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe(admin.id);
    expect(JSON.stringify(audit[0])).not.toContain(body.temporaryPassword);

    const firstLogin = await login('dr.zara', body.temporaryPassword);
    expect(firstLogin.json()).toMatchObject({ mustChangePassword: true });
  });

  it('uses a password the admin typed, if it meets the rules', async () => {
    const typed = 'the ward round starts at eight';
    const response = await adminCall('POST', '/api/admin/doctors', {
      ...newDoctor,
      temporaryPassword: typed,
    });
    expect(response.json().temporaryPassword).toBe(typed);
    const weak = await adminCall('POST', '/api/admin/doctors', {
      ...newDoctor,
      username: 'dr.weak',
      temporaryPassword: 'dr.weak 2026',
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json()).toMatchObject({ code: 'weak_password' });
  });

  it('refuses a username that differs only in letter case: 409', async () => {
    await adminCall('POST', '/api/admin/doctors', newDoctor);
    const again = await adminCall('POST', '/api/admin/doctors', {
      ...newDoctor,
      username: 'DR.ZARA',
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: 'username_taken' });
  });

  it('refuses a doctor without a department', async () => {
    const response = await adminCall('POST', '/api/admin/doctors', {
      ...newDoctor,
      department: null,
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses an account that is both doctor and admin: 400', async () => {
    const response = await adminCall('POST', '/api/admin/doctors', {
      ...newDoctor,
      isDoctor: true,
      isAdmin: true,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(response.json().message).toContain(ONE_ROLE);
  });

  it('adds an admin who doesn’t teach', async () => {
    const response = await adminCall('POST', '/api/admin/doctors', {
      name: 'Admin Two',
      username: 'admin.two',
      department: null,
      designation: null,
      isDoctor: false,
      isAdmin: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().doctor).toMatchObject({
      isDoctor: false,
      isAdmin: true,
    });
  });
});

describe('reset password', () => {
  it('ends the doctor’s logins; the new temporary password works and must be changed; locks clear', async () => {
    const doctor = await createUser(db, { username: 'dr.reset' });
    const oldCookies = await loginAs(app(), doctor);
    await db.insert(loginAttempts).values({
      usernameLower: 'dr.reset',
      failures: 9,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    const response = await adminCall(
      'POST',
      `/api/admin/doctors/${doctor.id}/reset-password`,
    );
    expect(response.statusCode).toBe(200);
    const { temporaryPassword } = response.json();

    expect(
      (
        await app().inject({
          method: 'GET',
          url: '/api/me',
          cookies: oldCookies,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      await db
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.usernameLower, 'dr.reset')),
    ).toEqual([]);
    expect((await login('dr.reset', TEST_PASSWORD)).statusCode).toBe(401);
    const fresh = await login('dr.reset', temporaryPassword);
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json()).toMatchObject({ mustChangePassword: true });
    const audit = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'doctor.reset_password'),
          eq(auditLog.entityId, doctor.id),
        ),
      );
    expect(audit).toHaveLength(1);
  });

  it('answers 404 for an unknown doctor', async () => {
    const response = await adminCall(
      'POST',
      '/api/admin/doctors/00000000-0000-4000-8000-00000000abcd/reset-password',
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('switching a doctor off', () => {
  it('gives their cookie 401 and makes login fail', async () => {
    const doctor = await createUser(db, { username: 'dr.off' });
    const cookies = await loginAs(app(), doctor);

    const response = await adminCall(
      'PATCH',
      `/api/admin/doctors/${doctor.id}`,
      { active: false },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ active: false });

    expect(
      (await app().inject({ method: 'GET', url: '/api/me', cookies }))
        .statusCode,
    ).toBe(401);
    expect((await login('dr.off', TEST_PASSWORD)).statusCode).toBe(401);

    const back = await adminCall('PATCH', `/api/admin/doctors/${doctor.id}`, {
      active: true,
    });
    expect(back.json()).toMatchObject({ active: true });
    expect((await login('dr.off', TEST_PASSWORD)).statusCode).toBe(200);
  });

  it('tells the switched-off doctor’s phone why, and the old login never works again', async () => {
    const doctor = await createUser(db, { username: 'dr.lost.phone' });
    const cookies = await loginAs(app(), doctor);
    await adminCall('PATCH', `/api/admin/doctors/${doctor.id}`, {
      active: false,
    });
    // Switched on again before the phone makes a request.
    await adminCall('PATCH', `/api/admin/doctors/${doctor.id}`, {
      active: true,
    });

    const first = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies,
    });
    expect(first.statusCode).toBe(401);
    expect(first.json().message).toContain('switched off');

    const second = await app().inject({
      method: 'GET',
      url: '/api/me',
      cookies,
    });
    expect(second.statusCode).toBe(401);
    expect(second.json().message).toBe('Please log in.');
  });

  it('refuses switching off one’s own account, or removing one’s own admin flag: 409', async () => {
    for (const payload of [{ active: false }, { isAdmin: false }]) {
      const response = await adminCall(
        'PATCH',
        `/api/admin/doctors/${admin.id}`,
        payload,
      );
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: 'cannot_change_own_admin',
      });
    }
  });

  it('records the change in audit_log with before and after', async () => {
    const doctor = await createUser(db, { username: 'dr.audit' });
    await adminCall('PATCH', `/api/admin/doctors/${doctor.id}`, {
      active: false,
      designation: 'professor',
    });
    const [row] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'doctor.update'));
    expect(row).toMatchObject({
      actorId: admin.id,
      before: { active: true },
      after: { active: false, designation: 'professor' },
    });
  });
});

describe('update doctor', () => {
  it('refuses a username another user has: 409', async () => {
    const a = await createUser(db, { username: 'dr.first' });
    await createUser(db, { username: 'dr.second' });
    const response = await adminCall('PATCH', `/api/admin/doctors/${a.id}`, {
      username: 'Dr.Second',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'username_taken' });
  });

  it('refuses giving a doctor the admin role as well: 400', async () => {
    const doctor = await createUser(db, { username: 'dr.both' });
    const response = await adminCall(
      'PATCH',
      `/api/admin/doctors/${doctor.id}`,
      { isAdmin: true },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation_failed',
      message: ONE_ROLE,
    });
  });

  it('turns a doctor into an admin when both flags change together', async () => {
    const doctor = await createUser(db, { username: 'dr.promoted' });
    const response = await adminCall(
      'PATCH',
      `/api/admin/doctors/${doctor.id}`,
      { isDoctor: false, isAdmin: true },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ isDoctor: false, isAdmin: true });
  });

  it('answers 404 for an unknown doctor', async () => {
    const response = await adminCall(
      'PATCH',
      '/api/admin/doctors/00000000-0000-4000-8000-00000000abcd',
      { name: 'Nobody' },
    );
    expect(response.statusCode).toBe(404);
  });

  it('lists every user with activity and shows one doctor’s detail', async () => {
    const doctor = await createUser(db, { username: 'dr.listed' });
    const list = await adminCall('GET', '/api/admin/doctors');
    expect(
      list.json().map((row: { username: string }) => row.username),
    ).toContain('dr.listed');
    const detail = await adminCall('GET', `/api/admin/doctors/${doctor.id}`);
    expect(detail.json()).toMatchObject({
      activity: { username: 'dr.listed', sessionsTotal: 0 },
      sessions: [],
      students: [],
    });
    const missing = await adminCall(
      'GET',
      '/api/admin/doctors/00000000-0000-4000-8000-00000000abcd',
    );
    expect(missing.statusCode).toBe(404);
  });
});
