import { CSV_COLUMNS } from '@omp/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { removeTestRecords } from '../../src/cli/remove-test-records.ts';
import { insertStudentRecord } from '../../src/db/records.ts';
import {
  auditLog,
  sessionSteps,
  studentAliases,
  students,
  teachingSessions,
} from '../../src/db/schema.ts';
import { csvCell } from '../../src/services/reports/csv.ts';
import {
  addSession,
  loadReportData,
  REPORT_NOW,
} from '../helpers/admin-data.ts';
import { APP_HEADERS, loginAs, useTestApp } from '../helpers/app.ts';
import { parseCsv } from '../helpers/csv.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db, () => ({ now: () => REPORT_NOW }));
let data: Awaited<ReturnType<typeof loadReportData>>;
let cookies: Record<string, string>;

beforeEach(async () => {
  await resetDb(db);
  data = await loadReportData(db);
  cookies = await loginAs(app(), data.admin, REPORT_NOW);
});

async function get(url: string) {
  const response = await app().inject({ method: 'GET', url, cookies });
  expect(response.statusCode, response.body).toBe(200);
  return response;
}

describe('numbers worked out by hand', () => {
  it('overview', async () => {
    const overview = (await get('/api/admin/overview')).json();
    expect(overview.activeDoctors).toBe(1);
    expect(overview.sessionsThisWeek).toBe(1);
    expect(overview.students).toBe(2);
    expect(overview.avgTeachingSecondsThisMonth).toBeCloseTo(70);
    expect(overview.avgOvertimeSecondsThisMonth).toBeCloseTo(40 / 3);
    const perStep = overview.avgRatingPerStepThisMonth;
    expect(perStep[0]).toBeCloseTo(3);
    expect(perStep[1]).toBeCloseTo(3);
    // Step 3 is no longer rated: its stored ratings stay out of the average.
    expect(perStep[2]).toBeNull();
    expect(perStep[3]).toBeCloseTo(10 / 3);
    expect(perStep[4]).toBeCloseTo(11 / 3);
    expect(overview.sessionsPerWeek).toHaveLength(12);
    expect(overview.sessionsPerWeek[0]).toEqual({
      weekStart: '2026-06-29',
      sessions: 0,
    });
    expect(overview.sessionsPerWeek.slice(-5)).toEqual([
      { weekStart: '2026-08-17', sessions: 1 },
      { weekStart: '2026-08-24', sessions: 0 },
      { weekStart: '2026-08-31', sessions: 1 },
      { weekStart: '2026-09-07', sessions: 1 },
      { weekStart: '2026-09-14', sessions: 1 },
    ]);
  });

  it('doctor activity', async () => {
    const rows = (await get('/api/admin/doctors')).json();
    const a = rows.find((r: { username: string }) => r.username === 'dr.a');
    const b = rows.find((r: { username: string }) => r.username === 'dr.b');
    expect(a).toMatchObject({
      sessionsTotal: 2,
      sessionsLast7Days: 1,
      studentsTaught: 2,
      lastSessionAt: '2026-09-16T05:00:00.000Z',
    });
    expect(a.avgTeachingSeconds).toBeCloseTo(70);
    expect(a.avgOvertimeSeconds).toBeCloseTo(15);
    expect(a.allStepsRatedShare).toBeCloseTo(0.5);
    expect(b).toMatchObject({
      sessionsTotal: 2,
      sessionsLast7Days: 0,
      studentsTaught: 1,
    });
    expect(b.avgTeachingSeconds).toBeCloseTo(65);
    expect(b.allStepsRatedShare).toBeCloseTo(1);
    const admin = rows.find(
      (r: { username: string }) => r.username === 'admin.reports',
    );
    expect(admin).toMatchObject({
      sessionsTotal: 0,
      avgTeachingSeconds: null,
      allStepsRatedShare: null,
    });
  });

  it('per-step student averages', async () => {
    const rows = (await get('/api/admin/students')).json();
    const one = rows.find((r: { name: string }) => r.name === 'Student One');
    const two = rows.find((r: { name: string }) => r.name === 'Student Two');
    expect(one).toMatchObject({ sessions: 3, doctors: 2 });
    for (const [i, value] of one.avgRatingPerStep.entries()) {
      if (i === 2) expect(value).toBeNull();
      else expect(value).toBeCloseTo(8 / 3);
    }
    expect(two).toMatchObject({
      sessions: 1,
      doctors: 1,
      avgRatingPerStep: [3, null, null, 4, 5],
    });
  });

  it('doctor detail: sessions, students taught and the spread of ratings', async () => {
    const detail = (await get(`/api/admin/doctors/${data.doctorB.id}`)).json();
    expect(detail.sessions.map((s: { id: string }) => s.id)).toEqual([
      data.sessions.earlyMonth.id,
      data.sessions.lastMonth.id,
    ]);
    expect(detail.students).toMatchObject([
      { name: 'Student One', sessions: 2 },
    ]);
    expect(detail.ratingSpread[0]).toEqual({
      counts: [1, 1, 0, 0, 0],
      unrated: 0,
    });
    expect(detail.ratingSpread[4]).toEqual({
      counts: [0, 1, 0, 0, 1],
      unrated: 0,
    });
    // Step 3's stored ratings aren't counted.
    expect(detail.ratingSpread[2]).toEqual({
      counts: [0, 0, 0, 0, 0],
      unrated: 0,
    });
  });
});

describe('students', () => {
  it('searches by name or PMDC number, treating % literally, and sorts', async () => {
    expect(
      (await get('/api/admin/students?query=11111'))
        .json()
        .map((r: { name: string }) => r.name),
    ).toEqual(['Student One']);
    expect((await get('/api/admin/students?query=two')).json()).toHaveLength(1);
    expect((await get('/api/admin/students?query=%25')).json()).toEqual([]);
    expect(
      (await get('/api/admin/students?sort=sessions'))
        .json()
        .map((r: { name: string }) => r.name),
    ).toEqual(['Student One', 'Student Two']);
    expect(
      (await get('/api/admin/students?sort=last_session')).json()[0].name,
    ).toBe('Student One');
  });

  it('detail has the profile, every session from every doctor, ratings over time and change history', async () => {
    await app().inject({
      method: 'PATCH',
      url: `/api/admin/students/${data.s1.id}`,
      cookies,
      headers: APP_HEADERS,
      payload: { year: '4th' },
    });
    const detail = (await get(`/api/admin/students/${data.s1.id}`)).json();
    expect(detail.student).toMatchObject({ name: 'Student One', year: '4th' });
    expect(detail.sessions).toHaveLength(3);
    expect(
      new Set(detail.sessions.map((s: { doctorName: string }) => s.doctorName)),
    ).toEqual(new Set(['Dr. A', 'Dr. B']));
    expect(
      detail.ratingsOverTime.map((p: { ratings: number[] }) => p.ratings),
    ).toEqual([
      [2, 2, 2, 2, 2],
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
    ]);
    expect(detail.changes).toMatchObject([
      {
        action: 'student.update_by_admin',
        actorName: 'Admin',
        before: { year: '3rd' },
        after: { year: '4th' },
      },
    ]);
  });

  it('a correction follows the sync rules: pmdc_taken, the year rule, and audit_log', async () => {
    const taken = await app().inject({
      method: 'PATCH',
      url: `/api/admin/students/${data.s2.id}`,
      cookies,
      headers: APP_HEADERS,
      payload: { pmdcNumber: '11111-p' },
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toMatchObject({ code: 'pmdc_taken' });

    const badYear = await app().inject({
      method: 'PATCH',
      url: `/api/admin/students/${data.s2.id}`,
      cookies,
      headers: APP_HEADERS,
      payload: { year: '2nd' },
    });
    expect(badYear.statusCode).toBe(400);

    const promoted = await app().inject({
      method: 'PATCH',
      url: `/api/admin/students/${data.s1.id}`,
      cookies,
      headers: APP_HEADERS,
      payload: { level: 'house_officer' },
    });
    expect(promoted.json()).toMatchObject({
      level: 'house_officer',
      year: null,
    });
    // Old sessions keep the level and year of the day they happened.
    const [old] = await db
      .select()
      .from(teachingSessions)
      .where(eq(teachingSessions.id, data.sessions.thisWeek.id));
    expect(old).toMatchObject({
      learnerLevel: 'medical_student',
      learnerYear: '3rd',
    });

    const missing = await app().inject({
      method: 'PATCH',
      url: '/api/admin/students/00000000-0000-4000-8000-00000000abcd',
      cookies,
      headers: APP_HEADERS,
      payload: { name: 'X Y' },
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('sessions', () => {
  it('filters by date range, doctor, student and case type, 50 to a page', async () => {
    const all = (await get('/api/admin/sessions')).json();
    expect(all.total).toBe(4);
    expect(all.rows.map((r: { id: string }) => r.id)).toEqual([
      data.sessions.thisWeek.id,
      data.sessions.lastWeek.id,
      data.sessions.earlyMonth.id,
      data.sessions.lastMonth.id,
    ]);
    expect(
      (await get('/api/admin/sessions?from=2026-09-01&to=2026-09-10')).json()
        .total,
    ).toBe(2);
    expect(
      (await get(`/api/admin/sessions?doctorId=${data.doctorB.id}`)).json()
        .total,
    ).toBe(2);
    expect(
      (await get(`/api/admin/sessions?studentId=${data.s2.id}`)).json().total,
    ).toBe(1);
    const caseType = data.sessions.thisWeek.caseType;
    const byCase = (
      await get(`/api/admin/sessions?caseType=${caseType}`)
    ).json();
    expect(
      byCase.rows.every((r: { caseType: string }) => r.caseType === caseType),
    ).toBe(true);
    expect((await get('/api/admin/sessions?page=2')).json()).toEqual({
      rows: [],
      total: 4,
    });
    const bad = await app().inject({
      method: 'GET',
      url: '/api/admin/sessions?from=2026-09-10&to=2026-09-01',
      cookies,
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ code: 'validation_failed' });
  });

  it('counts a session at 23:30 Pakistan time on the 5th for the 5th, and one at 00:30 on the 6th for the 6th', async () => {
    const late = await addSession(db, {
      doctor: data.doctorA,
      studentId: data.s1.id,
      startedAt: '2026-09-05T18:30:00.000Z',
      teachingSeconds: 40,
      ratings: [3, 3, 3, 3, 3],
    });
    const afterMidnight = await addSession(db, {
      doctor: data.doctorA,
      studentId: data.s1.id,
      startedAt: '2026-09-05T19:30:00.000Z',
      teachingSeconds: 40,
      ratings: [3, 3, 3, 3, 3],
    });
    const fifth = (
      await get('/api/admin/sessions?from=2026-09-05&to=2026-09-05')
    ).json();
    expect(fifth.rows.map((r: { id: string }) => r.id)).toEqual([late.id]);
    const sixth = (
      await get('/api/admin/sessions?from=2026-09-06&to=2026-09-06')
    ).json();
    expect(sixth.rows.map((r: { id: string }) => r.id)).toEqual([
      afterMidnight.id,
    ]);

    const csv = parseCsv(
      (
        await get(
          '/api/admin/export/sessions.csv?from=2026-09-05&to=2026-09-06',
        )
      ).body.slice(1),
    );
    expect(csv.slice(1).map((row) => [row[1], row[2]])).toEqual([
      ['2026-09-05', '23:30'],
      ['2026-09-06', '00:30'],
    ]);
  });

  it('detail shows every step; delete removes the steps too and writes audit_log', async () => {
    const id = data.sessions.lastWeek.id;
    const detail = (await get(`/api/admin/sessions/${id}`)).json();
    expect(detail.session.steps).toHaveLength(5);
    expect(detail).toMatchObject({
      doctor: { username: 'dr.a' },
      student: { name: 'Student Two' },
    });

    const removed = await app().inject({
      method: 'DELETE',
      url: `/api/admin/sessions/${id}`,
      cookies,
      headers: APP_HEADERS,
      payload: {},
    });
    expect(removed.statusCode).toBe(204);
    expect(
      await db
        .select()
        .from(sessionSteps)
        .where(eq(sessionSteps.sessionId, id)),
    ).toEqual([]);
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'session.delete'));
    expect(audit).toMatchObject({ actorId: data.admin.id, entityId: id });
    expect(
      (audit?.before as { diagnosis: unknown } | undefined)?.diagnosis,
    ).toBe(data.sessions.lastWeek.diagnosis);

    const again = await app().inject({
      method: 'DELETE',
      url: `/api/admin/sessions/${id}`,
      cookies,
      headers: APP_HEADERS,
      payload: {},
    });
    expect(again.statusCode).toBe(404);
    expect(
      (
        await app().inject({
          method: 'GET',
          url: `/api/admin/sessions/${id}`,
          cookies,
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('CSV export', () => {
  it('parses back: header, byte-order mark, rows, ratings, formula prefix and awkward text', async () => {
    await addSession(db, {
      doctor: data.doctorA,
      studentId: data.s1.id,
      startedAt: '2026-09-15T05:00:00.000Z',
      teachingSeconds: 65,
      ratings: [4, null, 2, 5, 1],
      diagnosis: '=HYPERLINK("x")',
    });
    await addSession(db, {
      doctor: data.doctorA,
      studentId: data.s1.id,
      startedAt: '2026-09-15T06:00:00.000Z',
      teachingSeconds: 30,
      ratings: [1, 1, 1, 1, 1],
      diagnosis: 'Pneumonia, "severe"\nwith sepsis',
    });

    const response = await get(
      '/api/admin/export/sessions.csv?from=2026-09-15&to=2026-09-15',
    );
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="omp-sessions-2026-09-17.csv"',
    );
    expect([...response.rawPayload.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const rows = parseCsv(response.body.replace(/^﻿/, ''));
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(3);
    const col = (name: (typeof CSV_COLUMNS)[number]) =>
      CSV_COLUMNS.indexOf(name);
    const [formula, awkward] = rows.slice(1);
    expect(formula?.[col('diagnosis')]).toBe('\'=HYPERLINK("x")');
    expect(
      [1, 2, 3, 4, 5].map((n) => formula?.[col(`step${n}_rating` as never)]),
    ).toEqual(['4', '', '2', '5', '1']);
    expect(formula?.[col('overtime_seconds')]).toBe('5');
    expect(formula?.[col('doctor_username')]).toBe('dr.a');
    expect(awkward?.[col('diagnosis')]).toBe(
      'Pneumonia, "severe"\nwith sepsis',
    );
    expect(awkward?.[col('student_name')]).toBe('Student One');

    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'sessions.export'));
    expect(audit).toMatchObject({
      actorId: data.admin.id,
      after: { from: '2026-09-15', to: '2026-09-15', rows: 2 },
    });
  });

  it('exports every session without a range', async () => {
    const rows = parseCsv(
      (await get('/api/admin/export/sessions.csv')).body.slice(1),
    );
    expect(rows).toHaveLength(5);
  });

  it('quotes and prefixes cells', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('+92 300')).toBe("'+92 300");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@home')).toBe("'@home");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('\rx')).toBe('"\'\rx"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });
});

describe('remove-test-records', () => {
  it('removes the listed sessions, then a student only when no session refers to them, with audit_log', async () => {
    const lonely = data.fixtures.makeStudentInput({
      name: 'Smoke Test Student',
      level: 'resident',
      year: null,
    });
    await db.transaction((tx) =>
      insertStudentRecord(tx, lonely, data.doctorA.id),
    );
    const smoke = await addSession(db, {
      doctor: data.doctorA,
      studentId: lonely.id,
      level: 'resident',
      startedAt: '2026-09-16T06:00:00.000Z',
      teachingSeconds: 30,
      ratings: [1, 1, 1, 1, 1],
    });
    const aliasId = data.fixtures.uuid();
    await db.transaction(async (tx) => {
      const { nextChangeSeq } = await import('../../src/db/change-seq.ts');
      await tx.insert(studentAliases).values({
        aliasId,
        studentId: lonely.id,
        changeSeq: await nextChangeSeq(tx),
      });
    });

    const report = await removeTestRecords(
      db,
      { sessions: [smoke.id], students: [lonely.id, data.s1.id] },
      REPORT_NOW,
    );

    expect(report.removedSessions).toEqual([smoke.id]);
    expect(report.removedStudents).toEqual([lonely.id]);
    expect(report.keptStudents).toEqual([
      { id: data.s1.id, reason: '3 sessions still refer to this student' },
    ]);
    expect(
      await db.select().from(students).where(eq(students.id, lonely.id)),
    ).toEqual([]);
    expect(
      await db.select().from(students).where(eq(students.id, data.s1.id)),
    ).toHaveLength(1);
    const actions = (await db.select().from(auditLog))
      .map((a) => a.action)
      .sort();
    expect(actions).toEqual(['session.delete', 'student.remove_test_record']);
  });

  it('refuses IDs that are not UUIDs', async () => {
    await expect(
      removeTestRecords(db, { sessions: ['42'], students: [] }),
    ).rejects.toThrow();
  });
});
