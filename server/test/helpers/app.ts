import type { PublicUser } from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach } from 'vitest';
import { type BuildAppOptions, buildApp } from '../../src/app.ts';
import { type Config, loadConfig } from '../../src/config.ts';
import type { Db } from '../../src/db/client.ts';
import { users } from '../../src/db/schema.ts';
import { hashPassword } from '../../src/services/auth/passwords.ts';
import {
  createLoginSession,
  type UserRow,
} from '../../src/services/auth/sessions.ts';
import { toPublicUser } from '../../src/services/auth/users.ts';
import { TEST_DATABASE_URL } from './database-url.ts';

export const TEST_PASSWORD = 'correct horse battery staple';

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: '3000',
    NODE_ENV: 'test',
    ...env,
  });
}

/** Headers every change request needs. */
export const APP_HEADERS = {
  'content-type': 'application/json',
  'x-omp-client': 'app',
} as const;

/** Builds the app on the test database. The caller closes it. */
export async function buildTestApp(
  db: Db,
  options: Partial<BuildAppOptions> = {},
): Promise<FastifyInstance> {
  const app = await buildApp({
    config: testConfig(),
    db,
    logger: false,
    ...options,
  });
  await app.ready();
  return app;
}

/**
 * A fresh app for each test in the file, closed afterwards. Call at the top of the file; the
 * returned function gives the current test's app.
 */
export function useTestApp(
  db: Db,
  options: () => Partial<BuildAppOptions> = () => ({}),
): () => FastifyInstance {
  let app: FastifyInstance | undefined;
  beforeEach(async () => {
    app = await buildTestApp(db, options());
  });
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  return () => {
    if (!app) throw new Error('useTestApp: no app outside a test');
    return app;
  };
}

let knownHash: Promise<string> | undefined;
const fixtures = createFixtures(404);

export type TestUser = PublicUser & { row: UserRow; password: string };

/** Inserts a user whose password is `TEST_PASSWORD`. Doctors by default. */
export async function createUser(
  db: Db,
  overrides: Partial<{
    name: string;
    username: string;
    isDoctor: boolean;
    isAdmin: boolean;
    mustChangePassword: boolean;
    active: boolean;
  }> = {},
): Promise<TestUser> {
  knownHash ??= hashPassword(TEST_PASSWORD);
  const doctor = fixtures.makeDoctor();
  const [row] = await db
    .insert(users)
    .values({
      ...doctor,
      mustChangePassword: false,
      tourCompletedAt: null,
      // Doctors and admins are separate accounts.
      ...(overrides.isAdmin ? { isDoctor: false } : {}),
      ...overrides,
      passwordHash: await knownHash,
    })
    .returning();
  if (!row) throw new Error('user not created');
  return { ...toPublicUser(row), row, password: TEST_PASSWORD };
}

/** Logs a user in without the login route, and returns cookies for `inject`. */
export async function loginAs(
  app: FastifyInstance,
  user: { id: string; isDoctor: boolean },
  now: Date = new Date(),
): Promise<Record<string, string>> {
  const { token } = await createLoginSession(app.db, user, now);
  return { [app.config.cookie.name]: token };
}
