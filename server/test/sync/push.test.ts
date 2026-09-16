import { createFixtures } from '@omp/shared/fixtures';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  auditLog,
  pearls,
  processedOps,
  sessionSteps,
  studentAliases,
  students,
  teachingSessions,
} from '../../src/db/schema.ts';
import {
  createUser,
  loginAs,
  type TestUser,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';
import { push, type RawItem } from '../helpers/sync.ts';

const db = useTestDatabase();
const app = useTestApp(db);
const fixtures = createFixtures(4040);

let doctor: TestUser;
let other: TestUser;
let cookies: Record<string, string>;
let otherCookies: Record<string, string>;

beforeEach(async () => {
  await resetDb(db);
  doctor = await createUser(db, { username: 'dr.one' });
  other = await createUser(db, { username: 'dr.two' });
  cookies = await loginAs(app(), doctor);
  otherCookies = await loginAs(app(), other);
});

const op = () => fixtures.uuid();
const studentItem = (payload: object, opId = op()): RawItem => ({
  opId,
  type: 'student.upsert',
  payload,
});
const sessionItem = (payload: object, opId = op()): RawItem => ({
  opId,
  type: 'session.create',
  payload,
});

function newStudent(overrides = {}) {
  return fixtures.makeStudentInput({
    level: 'medical_student',
    year: '3rd',
    ...overrides,
  });
}

function sessionFor(studentId: string, overrides = {}) {
  return fixtures.makeSession({
    studentId,
    learnerLevel: 'medical_student',
    learnerYear: '3rd',
    ...overrides,
  });
}

describe('push: students', () => {
  it('applies a new student with the caller as creator and a change number', async () => {
    const input = newStudent({
      name: '  Ahmed   Khan ',
      pmdcNumber: ' 12345-p ',
    });
    const { response, body } = await push(app(), cookies, [studentItem(input)]);

    expect(response.statusCode).toBe(200);
    expect(body.results).toEqual([
      { opId: expect.any(String), status: 'applied' },
    ]);
    const [row] = await db.select().from(students);
    expect(row).toMatchObject({
      id: input.id,
      name: 'Ahmed Khan',
      pmdcNumber: '12345-P',
      createdBy: doctor.id,
      updatedBy: doctor.id,
    });
    expect(row?.changeSeq).toBeGreaterThan(0);
  });

  it('answers the same opId again with duplicate and the same result, storing one row', async () => {
    const item = studentItem(newStudent());
    const first = await push(app(), cookies, [item]);
    const second = await push(app(), cookies, [item]);

    expect(first.body.results[0]?.status).toBe('applied');
    expect(second.body.results).toEqual([
      { ...first.body.results[0], status: 'duplicate' },
    ]);
    expect(await db.select().from(students)).toHaveLength(1);
    expect(await db.select().from(processedOps)).toHaveLength(1);
  });

  it('records a correction by a second doctor in audit_log', async () => {
    const input = newStudent({ name: 'Fatima Rizvi' });
    await push(app(), cookies, [studentItem(input)]);

    const { body } = await push(app(), otherCookies, [
      studentItem({ ...input, name: 'Fatima Rizvi Shah' }),
    ]);

    expect(body.results[0]?.status).toBe('applied');
    const [row] = await db.select().from(students);
    expect(row).toMatchObject({
      name: 'Fatima Rizvi Shah',
      updatedBy: other.id,
      createdBy: doctor.id,
    });
    const audit = await db.select().from(auditLog);
    expect(audit).toMatchObject([
      {
        actorId: other.id,
        action: 'student.update',
        entityType: 'student',
        entityId: input.id,
        before: { name: 'Fatima Rizvi' },
        after: { name: 'Fatima Rizvi Shah' },
      },
    ]);
  });

  it('answers an upsert with a new opId but no changes with duplicate, and writes no audit', async () => {
    const input = newStudent();
    await push(app(), cookies, [studentItem(input)]);
    const { body } = await push(app(), cookies, [studentItem(input)]);

    expect(body.results[0]?.status).toBe('duplicate');
    expect(await db.select().from(auditLog)).toEqual([]);
  });

  it('maps a new student with an existing PMDC number to that student, and stores sessions against it', async () => {
    const first = newStudent({ pmdcNumber: '77777-P' });
    await push(app(), cookies, [studentItem(first)]);

    const second = newStudent({
      name: 'Same Person Typed Again',
      pmdcNumber: '77777-p',
    });
    const session = sessionFor(second.id);
    const { body } = await push(app(), otherCookies, [
      studentItem(second),
      sessionItem(session),
    ]);

    expect(body.results.map((r) => r.status)).toEqual(['applied', 'applied']);
    expect(body.results[0]?.mappedStudentId).toBe(first.id);
    expect(await db.select().from(students)).toHaveLength(1);
    expect(await db.select().from(studentAliases)).toMatchObject([
      { aliasId: second.id, studentId: first.id },
    ]);
    const [stored] = await db.select().from(teachingSessions);
    expect(stored?.studentId).toBe(first.id);
    expect(stored?.doctorId).toBe(other.id);
  });

  it('refuses to give a student another student’s PMDC number: pmdc_taken', async () => {
    const a = newStudent({ pmdcNumber: '11111-P' });
    const b = newStudent({ pmdcNumber: '22222-P' });
    await push(app(), cookies, [studentItem(a), studentItem(b)]);

    const { body } = await push(app(), cookies, [
      studentItem({ ...b, pmdcNumber: '11111-P' }),
    ]);

    expect(body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'pmdc_taken',
    });
    const [row] = await db.select().from(students).where(eq(students.id, b.id));
    expect(row?.pmdcNumber).toBe('22222-P');
  });

  it('refuses a student payload that fails its schema, and stores the refusal', async () => {
    const item = studentItem({
      ...newStudent(),
      level: 'resident',
      year: '2nd',
    });
    const { body } = await push(app(), cookies, [item]);
    expect(body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'validation_failed',
    });

    const again = await push(app(), cookies, [item]);
    expect(again.body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'validation_failed',
    });
  });

  it('updates through an alias ID and reports the real student', async () => {
    const first = newStudent({ pmdcNumber: '33333-P' });
    const copy = newStudent({ pmdcNumber: '33333-P' });
    await push(app(), cookies, [studentItem(first)]);
    await push(app(), otherCookies, [studentItem(copy)]);

    const { body } = await push(app(), otherCookies, [
      studentItem({
        ...copy,
        name: 'Corrected Through Alias',
        pmdcNumber: '33333-P',
      }),
    ]);
    expect(body.results[0]).toMatchObject({
      status: 'applied',
      mappedStudentId: first.id,
    });
    const [row] = await db.select().from(students);
    expect(row?.name).toBe('Corrected Through Alias');
  });
});

describe('push: sessions', () => {
  it('refuses a session for an unknown student, then applies it once the student arrives first', async () => {
    const student = newStudent();
    const session = sessionFor(student.id);
    const item = sessionItem(session);

    const early = await push(app(), cookies, [item]);
    expect(early.body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'unknown_student',
    });
    expect(await db.select().from(processedOps)).toEqual([]);

    const later = await push(app(), cookies, [studentItem(student), item]);
    expect(later.body.results.map((r) => r.status)).toEqual([
      'applied',
      'applied',
    ]);
    expect(await db.select().from(sessionSteps)).toHaveLength(5);
  });

  it('refuses a session with four steps, a rating of 6 or wrong extra time, while the rest of the batch applies', async () => {
    const student = newStudent();
    const good = sessionFor(student.id);
    const fourSteps = {
      ...sessionFor(student.id),
      steps: good.steps.slice(0, 4),
    };
    const badRating = sessionFor(student.id);
    badRating.steps[2] = { ...badRating.steps[2], rating: 6 } as never;
    const wrongOvertime = {
      ...sessionFor(student.id, { teachingSeconds: 90 }),
      overtimeSeconds: 10,
    };

    const { body } = await push(app(), cookies, [
      studentItem(student),
      sessionItem(fourSteps),
      sessionItem(badRating),
      sessionItem(wrongOvertime),
      sessionItem(good),
    ]);

    expect(body.results.map((r) => [r.status, r.code])).toEqual([
      ['applied', undefined],
      ['rejected', 'validation_failed'],
      ['rejected', 'validation_failed'],
      ['rejected', 'validation_failed'],
      ['applied', undefined],
    ]);
    expect((await db.select().from(teachingSessions)).map((s) => s.id)).toEqual(
      [good.id],
    );
  });

  it('answers the same session with a new opId with duplicate, keeping five step rows', async () => {
    const student = newStudent();
    const session = sessionFor(student.id);
    await push(app(), cookies, [studentItem(student), sessionItem(session)]);

    const { body } = await push(app(), cookies, [sessionItem(session)]);

    expect(body.results[0]?.status).toBe('duplicate');
    expect(await db.select().from(teachingSessions)).toHaveLength(1);
    expect(await db.select().from(sessionSteps)).toHaveLength(5);
  });

  it('refuses a session ID another doctor already used: forbidden', async () => {
    const student = newStudent();
    const session = sessionFor(student.id);
    await push(app(), cookies, [studentItem(student), sessionItem(session)]);

    const { body } = await push(app(), otherCookies, [sessionItem(session)]);

    expect(body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'forbidden',
    });
    const [row] = await db.select().from(teachingSessions);
    expect(row?.doctorId).toBe(doctor.id);
  });

  it('refuses a doctorId in the payload, because the schema is strict', async () => {
    const student = newStudent();
    const session = { ...sessionFor(student.id), doctorId: other.id };
    const { body } = await push(app(), cookies, [
      studentItem(student),
      sessionItem(session),
    ]);
    expect(body.results[1]).toMatchObject({
      status: 'rejected',
      code: 'validation_failed',
    });
    expect(await db.select().from(teachingSessions)).toEqual([]);
  });

  it('stores the session under the caller, with its steps and the learner’s level on the day', async () => {
    const student = newStudent();
    const session = sessionFor(student.id, { teachingSeconds: 75 });
    await push(app(), cookies, [studentItem(student), sessionItem(session)]);

    const [row] = await db.select().from(teachingSessions);
    expect(row).toMatchObject({
      doctorId: doctor.id,
      learnerLevel: 'medical_student',
      learnerYear: '3rd',
      teachingSeconds: 75,
      overtimeSeconds: 15,
    });
    const steps = await db.select().from(sessionSteps);
    expect(steps.map((s) => s.rating).sort()).toEqual(
      session.steps.map((s) => s.rating).sort(),
    );
  });
});

describe('push: batches', () => {
  const item = () => studentItem(newStudent());

  it('refuses 51 items with 400', async () => {
    const { response } = await push(
      app(),
      cookies,
      Array.from({ length: 51 }, item),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
  });

  it('refuses a batch that is not an array, or an item without opId or type, with 400', async () => {
    for (const payload of [
      { items: item() },
      { items: [{ type: 'student.upsert', payload: {} }] },
      { items: [{ opId: op(), payload: {} }] },
    ]) {
      const response = await app().inject({
        method: 'POST',
        url: '/api/sync/push',
        headers: { 'content-type': 'application/json', 'x-omp-client': 'app' },
        cookies,
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it('refuses an unknown item type as that item only', async () => {
    const { body } = await push(app(), cookies, [
      { opId: op(), type: 'student.delete', payload: {} },
      item(),
    ]);
    expect(body.results.map((r) => r.status)).toEqual(['rejected', 'applied']);
  });

  it('answers in the order received', async () => {
    const items = Array.from({ length: 10 }, item);
    const { body } = await push(app(), cookies, items);
    expect(body.results.map((r) => r.opId)).toEqual(items.map((i) => i.opId));
  });

  it('refuses another user’s opId without revealing its result', async () => {
    const shared = item();
    await push(app(), cookies, [shared]);
    const { body } = await push(app(), otherCookies, [
      { ...shared, payload: newStudent() },
    ]);
    expect(body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'forbidden',
    });
  });

  it('stores one session when the same batch arrives twice at once', async () => {
    const student = newStudent();
    await push(app(), cookies, [studentItem(student)]);
    const items = [sessionItem(sessionFor(student.id))];
    const [a, b] = await Promise.all([
      push(app(), cookies, items),
      push(app(), cookies, items),
    ]);
    expect(
      [a.body.results[0]?.status, b.body.results[0]?.status].sort(),
    ).toEqual(['applied', 'duplicate']);
    expect(await db.select().from(teachingSessions)).toHaveLength(1);
  });
});

describe('push: pearls', () => {
  const pearlItem = (type: string, payload: object, opId = op()): RawItem => ({
    opId,
    type,
    payload,
  });

  it('stores a new pearl for the caller, and edits keep the use count', async () => {
    const pearl = fixtures.makePearl({ diagnosis: 'Pneumonia', timesUsed: 9 });
    await push(app(), cookies, [pearlItem('pearl.upsert', pearl)]);
    let [row] = await db.select().from(pearls);
    expect(row).toMatchObject({
      doctorId: doctor.id,
      diagnosis: 'Pneumonia',
      timesUsed: 0,
    });

    await push(app(), cookies, [pearlItem('pearl.use', { id: pearl.id })]);
    await push(app(), cookies, [
      pearlItem('pearl.upsert', {
        ...pearl,
        diagnosis: 'Community acquired pneumonia',
      }),
    ]);
    [row] = await db.select().from(pearls);
    expect(row).toMatchObject({
      diagnosis: 'Community acquired pneumonia',
      timesUsed: 1,
    });
  });

  it('refuses another doctor updating, deleting or using the pearl: forbidden', async () => {
    const pearl = fixtures.makePearl();
    await push(app(), cookies, [pearlItem('pearl.upsert', pearl)]);

    const { body } = await push(app(), otherCookies, [
      pearlItem('pearl.upsert', { ...pearl, diagnosis: 'Taken over' }),
      pearlItem('pearl.delete', { id: pearl.id }),
      pearlItem('pearl.use', { id: pearl.id }),
    ]);

    expect(body.results.map((r) => r.code)).toEqual([
      'forbidden',
      'forbidden',
      'forbidden',
    ]);
    const [row] = await db.select().from(pearls);
    expect(row).toMatchObject({
      doctorId: doctor.id,
      diagnosis: pearl.diagnosis,
      timesUsed: 0,
      deletedAt: null,
    });
  });

  it('counts pearl.use sent twice with the same opId once', async () => {
    const pearl = fixtures.makePearl();
    await push(app(), cookies, [pearlItem('pearl.upsert', pearl)]);
    const use = pearlItem('pearl.use', { id: pearl.id });

    await push(app(), cookies, [use]);
    const again = await push(app(), cookies, [use]);

    expect(again.body.results[0]?.status).toBe('duplicate');
    const [row] = await db.select().from(pearls);
    expect(row?.timesUsed).toBe(1);
  });

  it('marks a deleted pearl and keeps the row', async () => {
    const pearl = fixtures.makePearl();
    await push(app(), cookies, [
      pearlItem('pearl.upsert', pearl),
      pearlItem('pearl.delete', { id: pearl.id }),
    ]);
    const [row] = await db.select().from(pearls);
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('treats delete and use of an unknown pearl as nothing to do', async () => {
    const { body } = await push(app(), cookies, [
      pearlItem('pearl.delete', { id: op() }),
      pearlItem('pearl.use', { id: op() }),
    ]);
    expect(body.results.map((r) => r.status)).toEqual([
      'duplicate',
      'duplicate',
    ]);
  });
});

describe('push: the same item committed by another request meanwhile', () => {
  it('retries and answers duplicate with the stored result', async () => {
    const { pushItems } = await import('../../src/services/sync/push.ts');
    const student = newStudent();
    const item = studentItem(student);

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let recorded!: () => void;
    const opRecorded = new Promise<void>((resolve) => {
      recorded = resolve;
    });

    // Another request has recorded this opId but hasn't committed yet.
    const other = db.transaction(async (tx) => {
      await tx.insert(processedOps).values({
        opId: item.opId,
        userId: doctor.id,
        type: item.type,
        result: { status: 'applied' },
      });
      recorded();
      await held;
    });
    await opRecorded;

    const silent = { info: () => undefined } as never;
    const pushing = pushItems(db, doctor.id, [item], new Date(), silent);
    // Give the push time to reach the uncommitted row and wait on it.
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await other;

    expect(await pushing).toEqual([{ opId: item.opId, status: 'duplicate' }]);
    expect(await db.select().from(processedOps)).toHaveLength(1);
  });
});
