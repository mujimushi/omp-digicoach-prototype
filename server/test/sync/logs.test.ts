import { Writable } from 'node:stream';
import { createFixtures } from '@omp/shared/fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, createUser, loginAs } from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';
import { push } from '../helpers/sync.ts';

const db = useTestDatabase();
const fixtures = createFixtures(6060);

beforeEach(() => resetDb(db));

describe('push logging', () => {
  let lines: string[];
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
  });

  it('logs opId, type and status for each item, and never a student’s name', async () => {
    lines = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const app = await buildTestApp(db, { logger: { level: 'info', stream } });
    close = () => app.close();

    const doctor = await createUser(db);
    const cookies = await loginAs(app, doctor);
    const studentsToSend = Array.from({ length: 5 }, () =>
      fixtures.makeStudentInput({ level: 'resident', year: null }),
    );
    const items = studentsToSend.map((payload) => ({
      opId: fixtures.uuid(),
      type: 'student.upsert',
      payload,
    }));

    await push(app, cookies, items);

    const log = lines.join('');
    for (const student of studentsToSend) {
      expect(log).not.toContain(student.name);
      if (student.pmdcNumber) expect(log).not.toContain(student.pmdcNumber);
    }
    for (const { opId } of items) {
      expect(log).toContain(opId);
    }
    expect(log).toContain('"type":"student.upsert"');
    expect(log).toContain('"status":"applied"');
    expect(log).not.toContain(cookies.omp_session);
  });
});
