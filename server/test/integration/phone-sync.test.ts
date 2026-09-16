import {
  type PullResponse,
  PullResponse as PullResponseSchema,
  type PushItem,
  PushResponse,
} from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiRequestError, NetworkError } from '../../../app/src/api/errors.ts';
import { PhoneDb } from '../../../app/src/offline/db.ts';
import { createDexieRepository } from '../../../app/src/offline/dexie-repository.ts';
import {
  createSyncEngine,
  type SyncApi,
} from '../../../app/src/offline/sync.ts';
import {
  sessionSteps,
  students,
  teachingSessions,
} from '../../src/db/schema.ts';
import {
  APP_HEADERS,
  createUser,
  loginAs,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);
const fixtures = createFixtures(8080);

beforeEach(() => resetDb(db));

/** The sync routes through Fastify's inject, as the phone's HTTP client would call them. */
function serverApi(
  server: FastifyInstance,
  cookies: Record<string, string>,
): SyncApi {
  async function check(
    response: Awaited<ReturnType<FastifyInstance['inject']>>,
  ) {
    if (response.statusCode >= 400) {
      const body = response.json() as { code: never; message: string };
      throw new ApiRequestError(response.statusCode, body.code, body.message);
    }
    return response.json();
  }
  return {
    async push(items: PushItem[]) {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/push',
        headers: APP_HEADERS,
        cookies,
        payload: { items },
      });
      return PushResponse.parse(await check(response));
    },
    async pull(cursor: string): Promise<PullResponse> {
      const response = await server.inject({
        method: 'GET',
        url: `/api/sync/pull?cursor=${encodeURIComponent(cursor)}`,
        cookies,
      });
      return PullResponseSchema.parse(await check(response));
    },
  };
}

const serverDown: SyncApi = {
  push: async () => {
    throw new NetworkError('server down');
  },
  pull: async () => {
    throw new NetworkError('server down');
  },
};

describe('the phone sync engine against the real sync routes', () => {
  it('sends a student and a session saved while the server was down, once, even when syncing again', async () => {
    const doctor = await createUser(db);
    const cookies = await loginAs(app(), doctor);

    const phone = new PhoneDb('phone-sync-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    const repository = createDexieRepository(phone);
    let current = serverDown;
    const engine = createSyncEngine({
      db: phone,
      api: {
        push: (items) => current.push(items),
        pull: (cursor) => current.pull(cursor),
      },
    });

    const student = fixtures.makeStudentInput({
      level: 'medical_student',
      year: '2nd',
    });
    await repository.saveStudent(student);
    const session = fixtures.makeSession({
      studentId: student.id,
      learnerLevel: 'medical_student',
      learnerYear: '2nd',
    });
    await repository.completeSession(session);

    await engine.syncNow();
    expect(engine.getStatus().state).toBe('offline');
    expect(await phone.outbox.count()).toBe(2);
    expect(await db.select().from(students)).toEqual([]);

    // The server comes back.
    current = serverApi(app(), cookies);
    await engine.syncNow();

    expect(engine.getStatus().state).toBe('idle');
    expect(await phone.outbox.count()).toBe(0);
    expect(await db.select().from(students)).toHaveLength(1);
    const stored = await db.select().from(teachingSessions);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: session.id,
      doctorId: doctor.id,
      studentId: student.id,
    });
    expect(await db.select().from(sessionSteps)).toHaveLength(5);

    await engine.syncNow();
    expect(await db.select().from(students)).toHaveLength(1);
    expect(await db.select().from(teachingSessions)).toHaveLength(1);
    expect(await db.select().from(sessionSteps)).toHaveLength(5);

    // The pull brought the same records back to the phone.
    expect(await phone.sessions.get(session.id)).toEqual(session);
    expect(await phone.getMeta('pullCursor')).toMatch(/^\d+$/);
    engine.stop();
    phone.close();
  });

  it('keeps the phone’s data on a 401 from a switched-off account', async () => {
    const doctor = await createUser(db, { active: false });
    const cookies = await loginAs(app(), doctor);
    const phone = new PhoneDb('phone-sync-401', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    const repository = createDexieRepository(phone);
    const engine = createSyncEngine({
      db: phone,
      api: serverApi(app(), cookies),
    });
    await repository.saveStudent(fixtures.makeStudentInput());

    await engine.syncNow();

    expect(engine.getStatus()).toMatchObject({
      state: 'login_needed',
      loginMessage: 'This account has been switched off. Ask the admin.',
    });
    expect(await phone.outbox.count()).toBe(1);
    engine.stop();
    phone.close();
  });
});
