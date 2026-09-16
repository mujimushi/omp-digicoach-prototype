import type { PullResponse, PushItem, PushResult } from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, NetworkError } from '../api/errors.ts';
import { freshPhoneDb } from '../test/phone-db.ts';
import { createDexieRepository } from './dexie-repository.ts';
import { createSyncEngine, RETRY_DELAYS_MS, type SyncApi } from './sync.ts';

const fixtures = createFixtures(9090);

afterEach(() => {
  vi.useRealTimers();
});

/** One turn of Node's immediate queue, which fake timers leave alone here. */
const immediate = () =>
  new Promise<void>((resolve) =>
    (
      globalThis as unknown as { setImmediate: (run: () => void) => void }
    ).setImmediate(resolve),
  );

const emptyPull = (cursor = '1'): PullResponse => ({
  cursor,
  students: [],
  studentAliases: [],
  sessions: [],
  pearls: [],
});

type Answer = (items: PushItem[]) => PushResult[];

function fakeApi(
  answer: Answer = (items) =>
    items.map((i) => ({ opId: i.opId, status: 'applied' })),
) {
  const pushes: PushItem[][] = [];
  const pulls: string[] = [];
  const api: SyncApi = {
    push: vi.fn(async (items) => {
      pushes.push(items);
      return { results: answer(items) };
    }),
    pull: vi.fn(async (cursor) => {
      pulls.push(cursor);
      return emptyPull();
    }),
  };
  return { api, pushes, pulls };
}

async function setup(api: SyncApi) {
  const db = freshPhoneDb();
  const repository = createDexieRepository(db);
  const engine = createSyncEngine({ db, api });
  return { db, repository, engine };
}

describe('sync engine: push', () => {
  it('pushes items saved as A, B, C in that order', async () => {
    const { api, pushes } = fakeApi();
    const { repository, engine } = await setup(api);
    const a = fixtures.makeStudentInput({ name: 'A Student' });
    const b = fixtures.makeStudentInput({ name: 'B Student' });
    const c = fixtures.makeStudentInput({ name: 'C Student' });
    await repository.saveStudent(a);
    await repository.saveStudent(b);
    await repository.saveStudent(c);

    await engine.syncNow();

    expect(
      pushes.flat().map((item) => (item.payload as { id: string }).id),
    ).toEqual([a.id, b.id, c.id]);
  });

  it('sends at most 50 items per request', async () => {
    const { api, pushes } = fakeApi();
    const { repository, engine, db } = await setup(api);
    for (let i = 0; i < 120; i += 1)
      await repository.saveStudent(fixtures.makeStudentInput());
    await engine.syncNow();
    expect(pushes.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(await db.outbox.count()).toBe(0);
  });

  it('removes applied and duplicate items, keeps unknown_student with one more attempt, and moves refusals to needs attention', async () => {
    const statuses: Omit<PushResult, 'opId'>[] = [
      { status: 'applied' },
      { status: 'duplicate' },
      { status: 'rejected', code: 'unknown_student' },
      { status: 'rejected', code: 'validation_failed' },
    ];
    const { api } = fakeApi((items) =>
      items.map(
        (item, i) => ({ opId: item.opId, ...statuses[i] }) as PushResult,
      ),
    );
    const { repository, engine, db } = await setup(api);
    const inputs = Array.from({ length: 4 }, () => fixtures.makeStudentInput());
    for (const input of inputs) await repository.saveStudent(input);
    const [, , kept, refused] = await db.outbox.toArray();

    await engine.syncNow();

    const remaining = await db.outbox.toArray();
    expect(remaining.map((i) => i.opId)).toEqual([kept?.opId]);
    expect(remaining[0]?.attempts).toBe(1);
    expect(await repository.listNeedsAttention()).toMatchObject([
      {
        opId: refused?.opId,
        code: 'validation_failed',
        type: 'student.upsert',
        summary: `Student ${inputs[3]?.name}`,
      },
    ]);
  });

  it('replaces a mapped student ID in students, sessions, the draft and outbox payloads', async () => {
    const existingId = fixtures.uuid();
    let first = true;
    const { api } = fakeApi((items) =>
      items.map((item) => {
        if (first && item.type === 'student.upsert') {
          first = false;
          return {
            opId: item.opId,
            status: 'applied',
            mappedStudentId: existingId,
          };
        }
        // Everything after the first item stays in the outbox.
        return { opId: item.opId, status: 'rejected', code: 'unknown_student' };
      }),
    );
    const { repository, engine, db } = await setup(api);
    const local = fixtures.makeStudentInput({ level: 'resident', year: null });
    await repository.saveStudent(local);
    const session = fixtures.makeSession({
      studentId: local.id,
      learnerLevel: 'resident',
      learnerYear: null,
    });
    await repository.completeSession(session);
    await repository.saveStudent({ ...local, name: 'Corrected Name' });
    await db.drafts.put({
      key: 'current',
      draft: { ...(await draftFor(local.id)) },
    });

    await engine.syncNow();

    expect(await db.students.get(local.id)).toBeUndefined();
    expect(await db.students.get(existingId)).toMatchObject({
      name: 'Corrected Name',
    });
    expect(await db.sessions.get(session.id)).toMatchObject({
      studentId: existingId,
    });
    expect((await db.drafts.get('current'))?.draft.studentId).toBe(existingId);
    const payloads = (await db.outbox.toArray()).map(
      (i) => i.payload as { id?: string; studentId?: string },
    );
    expect(payloads.map((p) => p.studentId ?? p.id)).toEqual([
      existingId,
      existingId,
    ]);
    expect(await db.studentAliases.get(local.id)).toEqual({
      aliasId: local.id,
      studentId: existingId,
    });
  });

  it('keeps every item after a network error and retries after 5 s, 15 s, 60 s, then every 5 minutes', async () => {
    // IndexedDB's test double schedules with setImmediate, so only setTimeout is faked.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const api: SyncApi = {
      push: vi.fn(async () => {
        throw new NetworkError('offline');
      }),
      pull: vi.fn(async () => emptyPull()),
    };
    const { repository, engine, db } = await setup(api);
    await repository.saveStudent(fixtures.makeStudentInput());

    await engine.syncNow();
    expect(engine.getStatus().state).toBe('offline');
    expect(await db.outbox.count()).toBe(1);
    expect(api.push).toHaveBeenCalledTimes(1);

    const expectCallsAfter = async (ms: number, calls: number) => {
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(api.push).toHaveBeenCalledTimes(calls - 1);
      await vi.advanceTimersByTimeAsync(1);
      // Let the retry's IndexedDB work finish without moving the fake clock.
      for (
        let i = 0;
        i < 50 && vi.mocked(api.push).mock.calls.length < calls;
        i += 1
      ) {
        await immediate();
      }
      expect(api.push).toHaveBeenCalledTimes(calls);
      for (let i = 0; i < 20; i += 1) await immediate();
    };
    await expectCallsAfter(RETRY_DELAYS_MS[0], 2);
    await expectCallsAfter(RETRY_DELAYS_MS[1], 3);
    await expectCallsAfter(RETRY_DELAYS_MS[2], 4);
    await expectCallsAfter(RETRY_DELAYS_MS[3], 5);
    await expectCallsAfter(RETRY_DELAYS_MS[3], 6);
    expect(await db.outbox.count()).toBe(1);
    engine.stop();
  });

  it('treats a 5xx like a network error', async () => {
    const api: SyncApi = {
      push: vi.fn(async () => {
        throw new ApiRequestError(502, 'internal_error', 'Bad gateway');
      }),
      pull: vi.fn(async () => emptyPull()),
    };
    const { repository, engine, db } = await setup(api);
    await repository.saveStudent(fixtures.makeStudentInput());
    await engine.syncNow();
    expect(engine.getStatus().state).toBe('offline');
    expect(await db.outbox.count()).toBe(1);
    engine.stop();
  });

  it('sends one request when syncNow is called twice at once', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: SyncApi = {
      push: vi.fn(async (items: PushItem[]) => {
        await gate;
        return {
          results: items.map((i) => ({
            opId: i.opId,
            status: 'applied' as const,
          })),
        };
      }),
      pull: vi.fn(async () => emptyPull()),
    };
    const { repository, engine } = await setup(api);
    await repository.saveStudent(fixtures.makeStudentInput());

    const first = engine.syncNow();
    const second = engine.syncNow();
    expect(second).toBe(first);
    release();
    await Promise.all([first, second]);
    expect(api.push).toHaveBeenCalledTimes(1);
    expect(api.pull).toHaveBeenCalledTimes(1);
  });

  it('on a 401 sets login_needed, keeps the outbox, and stops syncing until login', async () => {
    const api: SyncApi = {
      push: vi.fn(async () => {
        throw new ApiRequestError(
          401,
          'not_logged_in',
          'This account has been switched off. Ask the admin.',
        );
      }),
      pull: vi.fn(async () => emptyPull()),
    };
    const { repository, engine, db } = await setup(api);
    await repository.saveStudent(fixtures.makeStudentInput());

    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({
      state: 'login_needed',
      loginMessage: 'This account has been switched off. Ask the admin.',
    });
    expect(await db.outbox.count()).toBe(1);

    await engine.syncNow();
    expect(api.push).toHaveBeenCalledTimes(1);

    engine.clearLoginNeeded();
    await engine.syncNow();
    expect(api.push).toHaveBeenCalledTimes(2);
  });

  it('asks for a password change on 403 password_change_required', async () => {
    const onPasswordChangeRequired = vi.fn();
    const db = freshPhoneDb();
    const engine = createSyncEngine({
      db,
      api: {
        push: vi.fn(),
        pull: vi.fn(async () => {
          throw new ApiRequestError(
            403,
            'password_change_required',
            'Choose a new password first.',
          );
        }),
      },
      onPasswordChangeRequired,
    });
    await engine.syncNow();
    expect(onPasswordChangeRequired).toHaveBeenCalledTimes(1);
  });
});

describe('sync engine: pull', () => {
  it('saves the cursor and sends it next time', async () => {
    const cursors: string[] = [];
    const api: SyncApi = {
      push: vi.fn(),
      pull: vi.fn(async (cursor) => {
        cursors.push(cursor);
        return emptyPull(String(cursors.length * 10));
      }),
    };
    const { engine, db } = await setup(api);
    await engine.syncNow();
    await engine.syncNow();
    expect(cursors).toEqual(['', '10']);
    expect(await db.getMeta('pullCursor')).toBe('20');
    expect(engine.getStatus().lastSyncAt).not.toBeNull();
  });

  it('updates existing students, applies aliases and removes deleted pearls', async () => {
    const student = fixtures.makeStudent({ name: 'Old Name' });
    const localCopy = fixtures.makeStudent({ name: 'Added Here Too' });
    const pearl = fixtures.makePearl();
    const pulled: PullResponse = {
      cursor: '5',
      students: [{ ...student, name: 'New Name' }],
      studentAliases: [{ aliasId: localCopy.id, studentId: student.id }],
      sessions: [],
      pearls: [{ ...pearl, deleted: true }],
    };
    const { engine, db } = await setup({
      push: vi.fn(),
      pull: vi.fn(async () => pulled),
    });
    await db.students.bulkPut([student, localCopy]);
    await db.pearls.put(pearl);

    await engine.syncNow();

    expect(await db.students.get(student.id)).toMatchObject({
      name: 'New Name',
    });
    expect(await db.students.get(localCopy.id)).toBeUndefined();
    expect(await db.studentAliases.get(localCopy.id)).toEqual({
      aliasId: localCopy.id,
      studentId: student.id,
    });
    expect(await db.pearls.get(pearl.id)).toBeUndefined();
  });

  it('keeps a student the doctor changed that is still waiting to send', async () => {
    const student = fixtures.makeStudent({ name: 'Server Name' });
    const api: SyncApi = {
      push: vi.fn(async (items: PushItem[]) => ({
        results: items.map((i) => ({
          opId: i.opId,
          status: 'rejected' as const,
          code: 'unknown_student' as const,
        })),
      })),
      pull: vi.fn(async () => ({ ...emptyPull(), students: [student] })),
    };
    const { engine, db, repository } = await setup(api);
    await repository.saveStudent({
      id: student.id,
      name: 'Phone Name',
      pmdcNumber: student.pmdcNumber,
      level: student.level,
      year: student.year,
    });
    await engine.syncNow();
    expect(await db.students.get(student.id)).toMatchObject({
      name: 'Phone Name',
    });
  });

  it('starts again from an empty cursor when the server refuses it', async () => {
    const cursors: string[] = [];
    const api: SyncApi = {
      push: vi.fn(),
      pull: vi.fn(async (cursor) => {
        cursors.push(cursor);
        if (cursor === 'stale')
          throw new ApiRequestError(400, 'bad_cursor', 'Unknown');
        return emptyPull('3');
      }),
    };
    const { engine, db } = await setup(api);
    await db.setMeta('pullCursor', 'stale');
    await engine.syncNow();
    expect(cursors).toEqual(['stale', '']);
    expect(await db.getMeta('pullCursor')).toBe('3');
  });
});

async function draftFor(studentId: string) {
  return {
    id: fixtures.uuid(),
    studentId,
    department: 'medicine' as const,
    caseType: 'long_case' as const,
    learnerLevel: 'resident' as const,
    learnerYear: null,
    timer: {
      startedAtMs: 1,
      runningSinceMs: 1,
      activeMs: 0,
      pausedMs: 0,
      pausedSinceMs: null,
      stepActiveMs: [0, 0, 0, 0, 0] as [number, number, number, number, number],
      currentStep: 1 as const,
      finishedAtMs: null,
    },
    stage: 'steps' as const,
    ratings: [null, null, null, null, null] as [null, null, null, null, null],
    step1: { learnerAnswer: '' },
    step2: { mode: 'quick' as const },
    step3: {
      points: ['', '', '', '', ''] as [string, string, string, string, string],
    },
    step4: { starters: ['', '', ''] as [string, string, string], tags: [] },
    step5: {
      starters: ['', '', ''] as [string, string, string],
      actionPlan: '',
    },
    log: { diagnosis: '', learnerGaveDiagnosis: null, usefulness: null },
    savedAtMs: 1,
  };
}
