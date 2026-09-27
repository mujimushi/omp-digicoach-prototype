import { beforeEach, describe, expect, it } from 'vitest';
import { createAdmin } from '../../src/cli/create-admin.ts';
import { auditLog, users } from '../../src/db/schema.ts';
import { verifyPassword } from '../../src/services/auth/passwords.ts';
import { APP_HEADERS, useTestApp } from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);

beforeEach(() => resetDb(db));

describe('create-admin', () => {
  it('makes an admin who must change the temporary password', async () => {
    const { user, temporaryPassword } = await createAdmin(db, {
      name: 'Prof. Admin',
      username: 'Prof.Admin',
    });

    expect(user).toMatchObject({
      username: 'prof.admin',
      isAdmin: true,
      isDoctor: false,
      mustChangePassword: true,
      active: true,
    });
    expect(temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

    const [row] = await db.select().from(users);
    expect(
      await verifyPassword(row?.passwordHash ?? '', temporaryPassword),
    ).toBe(true);
    const audit = await db.select().from(auditLog);
    expect(audit).toMatchObject([{ entityId: user.id, actorId: null }]);

    const login = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: APP_HEADERS,
      payload: { username: 'prof.admin', password: temporaryPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ mustChangePassword: true });
  });

  it('refuses a taken username in any letter case', async () => {
    const args = {
      name: 'Prof. Admin',
      username: 'prof.admin',
    };
    await createAdmin(db, args);
    await expect(
      createAdmin(db, { ...args, username: 'PROF.ADMIN' }),
    ).rejects.toThrow(/taken/);
  });
});
