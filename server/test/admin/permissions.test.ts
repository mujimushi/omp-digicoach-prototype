import type { RouteOptions } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadReportData } from '../helpers/admin-data.ts';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const registered = new Set<string>();
const app = useTestApp(db, () => ({
  onRoute: (route: RouteOptions) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method !== 'HEAD' && route.url.startsWith('/api/admin'))
        registered.add(`${method} ${route.url}`);
    }
  },
}));

let data: Awaited<ReturnType<typeof loadReportData>>;

beforeEach(async () => {
  await resetDb(db);
  data = await loadReportData(db);
});

type Case = { payload?: unknown; expect: number; url?: () => string };

/** Every admin route needs an entry here. The admin's request must succeed. */
const CASES: Record<string, Case> = {
  'GET /api/admin/overview': { expect: 200 },
  'GET /api/admin/doctors': { expect: 200 },
  'POST /api/admin/doctors': {
    expect: 200,
    payload: {
      name: 'Dr. New',
      username: 'dr.new',
      department: 'medicine',
      designation: 'consultant',
    },
  },
  'GET /api/admin/doctors/:id': {
    expect: 200,
    url: () => `/api/admin/doctors/${data.doctorA.id}`,
  },
  'PATCH /api/admin/doctors/:id': {
    expect: 200,
    url: () => `/api/admin/doctors/${data.doctorA.id}`,
    payload: { name: 'Dr. A Renamed' },
  },
  'POST /api/admin/doctors/:id/reset-password': {
    expect: 200,
    url: () => `/api/admin/doctors/${data.doctorB.id}/reset-password`,
    payload: {},
  },
  'GET /api/admin/students': { expect: 200 },
  'GET /api/admin/students/:id': {
    expect: 200,
    url: () => `/api/admin/students/${data.s1.id}`,
  },
  'PATCH /api/admin/students/:id': {
    expect: 200,
    url: () => `/api/admin/students/${data.s2.id}`,
    payload: { name: 'Student Two Corrected' },
  },
  'GET /api/admin/sessions': { expect: 200 },
  'GET /api/admin/sessions/:id': {
    expect: 200,
    url: () => `/api/admin/sessions/${data.sessions.lastWeek.id}`,
  },
  'DELETE /api/admin/sessions/:id': {
    expect: 204,
    url: () => `/api/admin/sessions/${data.sessions.lastMonth.id}`,
    payload: {},
  },
  'GET /api/admin/export/sessions.csv': { expect: 200 },
};

function request(key: string, cookies: Record<string, string>) {
  const entry = CASES[key];
  if (!entry) throw new Error(`No permission case for ${key}`);
  const [method, template] = key.split(' ') as [
    'GET' | 'POST' | 'PATCH' | 'DELETE',
    string,
  ];
  return app().inject({
    method,
    url: entry.url?.() ?? template,
    cookies,
    ...(method === 'GET'
      ? {}
      : { headers: APP_HEADERS, payload: entry.payload ?? {} }),
  });
}

describe('admin route permissions', () => {
  it('has a permission case for every registered admin route', () => {
    expect(registered.size).toBeGreaterThan(0);
    expect([...registered].filter((key) => !CASES[key])).toEqual([]);
  });

  describe.each(Object.keys(CASES))('%s', (key) => {
    it('answers 401 without a login', async () => {
      const response = await request(key, {});
      expect(response.statusCode).toBe(401);
    });

    it('answers 403 to a doctor', async () => {
      const response = await request(key, await loginAs(app(), data.doctorA));
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'forbidden' });
    });

    it('answers 403 password_change_required to an admin who must change their password', async () => {
      const pending = await createUser(db, {
        isAdmin: true,
        isDoctor: false,
        mustChangePassword: true,
      });
      const response = await request(key, await loginAs(app(), pending));
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'password_change_required',
      });
    });

    it('answers the admin', async () => {
      const response = await request(key, await loginAs(app(), data.admin));
      expect(response.statusCode).toBe(CASES[key]?.expect);
    });
  });
});
