import type { RouteOptions } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_HEADERS, createUser, loginAs, useTestApp } from './helpers/app.ts';
import { resetDb, useTestDatabase } from './helpers/db.ts';

// Who may call each route, as listed in docs/plan/api.md. A route added without an entry here fails
// the first test. The admin routes' full checks are in admin/permissions.test.ts.
type Access = 'anyone' | 'logged in' | 'doctor' | 'admin' | 'logout';

const ID = '00000000-0000-4000-8000-000000000999';

const ROUTES: Record<string, Access> = {
  'POST /api/auth/login': 'anyone',
  // api.md lists no error for logout: without a login it still answers 204 and clears the cookie.
  'POST /api/auth/logout': 'logout',
  'GET /api/me': 'logged in',
  'POST /api/me/password': 'logged in',
  'POST /api/me/tour': 'logged in',
  'GET /api/health': 'anyone',
  'POST /api/sync/push': 'doctor',
  'GET /api/sync/pull': 'doctor',
  'GET /api/admin/overview': 'admin',
  'GET /api/admin/doctors': 'admin',
  'POST /api/admin/doctors': 'admin',
  'GET /api/admin/doctors/:id': 'admin',
  'PATCH /api/admin/doctors/:id': 'admin',
  'POST /api/admin/doctors/:id/reset-password': 'admin',
  'GET /api/admin/students': 'admin',
  'GET /api/admin/students/:id': 'admin',
  'PATCH /api/admin/students/:id': 'admin',
  'GET /api/admin/sessions': 'admin',
  'GET /api/admin/sessions/:id': 'admin',
  'DELETE /api/admin/sessions/:id': 'admin',
  'GET /api/admin/export/sessions.csv': 'admin',
};

const db = useTestDatabase();
const registered = new Set<string>();
const app = useTestApp(db, () => ({
  onRoute: (route: RouteOptions) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method !== 'HEAD' && route.url.startsWith('/api/'))
        registered.add(`${method} ${route.url}`);
    }
  },
}));

beforeEach(async () => {
  await resetDb(db);
});

function request(key: string, cookies: Record<string, string> = {}) {
  const [method, template] = key.split(' ') as [
    'GET' | 'POST' | 'PATCH' | 'DELETE',
    string,
  ];
  return app().inject({
    method,
    url: template.replace(':id', ID),
    cookies,
    ...(method === 'GET' ? {} : { headers: APP_HEADERS, payload: {} }),
  });
}

describe('every API route', () => {
  it('matches the list in api.md', () => {
    expect([...registered].sort()).toEqual(Object.keys(ROUTES).sort());
  });

  describe.each(Object.entries(ROUTES))('%s (%s)', (key, access) => {
    if (access === 'logout') {
      it('answers 204 and clears the cookie without a login', async () => {
        const response = await request(key);
        expect(response.statusCode).toBe(204);
        expect(String(response.headers['set-cookie'])).toContain(
          'omp_session=;',
        );
      });
      return;
    }

    if (access === 'anyone') {
      it('answers without a login', async () => {
        const response = await request(key);
        expect([401, 403]).not.toContain(response.statusCode);
      });
      return;
    }

    it('answers 401 without a login', async () => {
      const response = await request(key);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'not_logged_in' });
    });

    if (access === 'doctor') {
      it('answers 403 to an admin who is not a doctor', async () => {
        const admin = await createUser(db, { isAdmin: true, isDoctor: false });
        const response = await request(key, await loginAs(app(), admin));
        expect(response.statusCode).toBe(403);
        expect(response.json()).toMatchObject({ code: 'forbidden' });
      });
    }

    if (access === 'admin') {
      it('answers 403 to a doctor', async () => {
        const doctor = await createUser(db);
        const response = await request(key, await loginAs(app(), doctor));
        expect(response.statusCode).toBe(403);
        expect(response.json()).toMatchObject({ code: 'forbidden' });
      });
    }
  });
});
