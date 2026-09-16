import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);

beforeEach(() => resetDb(db));

const routes = [
  { method: 'POST' as const, url: '/api/sync/push', payload: { items: [] } },
  { method: 'GET' as const, url: '/api/sync/pull?cursor=' },
];

describe.each(routes)('$method $url: who may call', (route) => {
  function call(cookies: Record<string, string> = {}) {
    return app().inject({
      method: route.method,
      url: route.url,
      cookies,
      ...(route.method === 'POST'
        ? { headers: APP_HEADERS, payload: route.payload }
        : {}),
    });
  }

  it('refuses a visitor with no login: 401', async () => {
    const response = await call();
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'not_logged_in' });
  });

  it('refuses a doctor who must still change their password: 403', async () => {
    const doctor = await createUser(db, { mustChangePassword: true });
    const response = await call(await loginAs(app(), doctor));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'password_change_required' });
  });

  it('refuses an admin who is not a doctor: 403', async () => {
    const admin = await createUser(db, { isDoctor: false, isAdmin: true });
    const response = await call(await loginAs(app(), admin));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('refuses the cookie of a doctor since switched off: 401', async () => {
    const doctor = await createUser(db, { active: false });
    const response = await call(await loginAs(app(), doctor));
    expect(response.statusCode).toBe(401);
  });
});
