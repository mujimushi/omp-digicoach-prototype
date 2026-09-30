import {
  CSV_COLUMNS,
  isRatedStep,
  RATED_STEP_IDS,
  REPORT_TIME_ZONE,
} from '@omp/shared';
import { KNOWN_STUDENTS, KNOWN_USERS } from '@omp/shared/fixtures';
import type { Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures.ts';
import { parseCsv } from '../../support/helpers/csv.ts';
import { queryRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  nextStep,
  outboxCount,
  rateStep,
} from '../../support/helpers/doctor.ts';
import { adminAtDesk } from '../../support/helpers/people.ts';

// Phase 6 data check: sessions recorded on a phone reach the database one for one, the dashboard's
// averages equal the same averages taken directly in SQL, and CSV rows equal database rows.

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || !isMobile,
  'Runs in phone Chromium, with the admin in a desktop context',
);

const RECORDED = 12;
const CASE_TYPES = ['Long Case', 'Short Case', 'Procedure'] as const;
// Asia/Karachi is UTC+5 all year, with no daylight saving.
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

type SessionRow = {
  id: string;
  doctor_id: string;
  student_id: string;
  department: string;
  case_type: string;
  learner_level: string;
  learner_year: string | null;
  started_at: Date;
  teaching_seconds: number;
  overtime_seconds: number;
  paused_seconds: number;
  log_seconds: number;
  diagnosis: string | null;
  learner_gave_diagnosis: boolean | null;
  usefulness: number | null;
  app_version: string;
  steps: {
    step: number;
    seconds: number;
    rating: number | null;
    content: Record<string, unknown>;
  }[];
};

const SESSION_SQL = `
  select s.*,
    (select json_agg(json_build_object('step', ss.step, 'seconds', ss.seconds, 'rating', ss.rating,
      'content', ss.content) order by ss.step) from session_steps ss where ss.session_id = s.id) as steps
  from teaching_sessions s`;

/** A database row in the shape the phone keeps. */
function asPhoneSession(row: SessionRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    department: row.department,
    caseType: row.case_type,
    learnerLevel: row.learner_level,
    learnerYear: row.learner_year,
    startedAt: row.started_at.toISOString(),
    teachingSeconds: row.teaching_seconds,
    overtimeSeconds: row.overtime_seconds,
    pausedSeconds: row.paused_seconds,
    logSeconds: row.log_seconds,
    diagnosis: row.diagnosis,
    learnerGaveDiagnosis: row.learner_gave_diagnosis,
    usefulness: row.usefulness,
    appVersion: row.app_version,
    steps: row.steps,
  };
}

async function phoneSessions(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('omp');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction('sessions')
            .objectStore('sessions')
            .getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/** Records one session with its own step times, ratings, pause and quick log. */
async function recordSession(page: Page, i: number, diagnosis: string) {
  const student = KNOWN_STUDENTS[i % KNOWN_STUDENTS.length];
  await page.getByRole('button', { name: `Teach ${student?.name}` }).click();
  await page
    .getByRole('button', {
      name: CASE_TYPES[i % CASE_TYPES.length] ?? 'Long Case',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  for (let step = 1; step <= 5; step += 1) {
    await page.clock.fastForward((6 + ((i * 7 + step * 5) % 17)) * 1000);
    if (step === 3 && i % 3 === 0) {
      await page.getByTestId('timer-ring').click();
      await page.clock.fastForward((4 + i) * 1000);
      await page.getByTestId('timer-ring').click();
    }
    if ((i + step) % 4 !== 0 && isRatedStep(step))
      await rateStep(page, (((i + step) % 5) + 1) as 1 | 2 | 3 | 4 | 5);
    if (step < 5) await nextStep(page, step + 1);
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Diagnosis').fill(diagnosis);
  if (i % 3 !== 2)
    await page
      .getByRole('button', { name: i % 3 === 0 ? 'Yes' : 'No', exact: true })
      .click();
  if (i % 4 !== 3)
    await page
      .getByRole('button', { name: `Usefulness ${(i % 6) + 1}` })
      .click();
  await page.clock.fastForward((10 + i) * 1000);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  // The badge's count waits for timers that the paused clock holds, so read the outbox itself.
  await expect.poll(() => outboxCount(page)).toBe(i + 1);
}

function pakistanStart(unit: 'week' | 'month', now: Date): Date {
  const local = new Date(now.getTime() + PAKISTAN_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day =
    unit === 'month' ? 1 : local.getUTCDate() - ((local.getUTCDay() + 6) % 7); // back to Monday
  return new Date(Date.UTC(year, month, day) - PAKISTAN_OFFSET_MS);
}

function expectSameAverage(actual: number | null, expected: unknown) {
  if (expected === null) expect(actual).toBeNull();
  else expect(actual).toBeCloseTo(Number(expected), 9);
}

/** The dashboard's time format, from the SQL average. */
function minutesAndSeconds(seconds: number): string {
  const whole = Math.round(seconds);
  const m = Math.floor(whole / 60);
  return m > 0 ? `${m}m ${whole % 60}s` : `${whole % 60}s`;
}

test('Data check: phone sessions match database rows, dashboard averages match SQL, and CSV rows match the database', async ({
  doctorPage: page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  expect(REPORT_TIME_ZONE).toBe('Asia/Karachi');
  const run = Date.now() % 100000;
  const doctorId = KNOWN_USERS.doctor.id;

  // 1. Record sessions on the phone without signal, then send them.
  await page.clock.install({ time: new Date() });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
  await expectAllSent(page);
  await page.context().setOffline(true);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const diagnoses: string[] = [];
  for (let i = 0; i < RECORDED; i += 1) {
    // The last one looks like a spreadsheet formula, to check the CSV's protection.
    const diagnosis =
      i === RECORDED - 1 ? `=1+1 data check ${run}` : `Data check ${run} ${i}`;
    diagnoses.push(diagnosis);
    await recordSession(page, i, diagnosis);
  }
  await page.clock.resume();
  await page.context().setOffline(false);
  await expectAllSent(page, 30_000);

  // 2. The phone's sessions and the database rows match one for one.
  const rows = await queryRows<SessionRow>(
    `${SESSION_SQL} where s.doctor_id = $1 order by s.id`,
    [doctorId],
  );
  const onPhone = (await phoneSessions(page)).sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );
  expect(
    rows.filter((row) => diagnoses.includes(row.diagnosis ?? '')),
  ).toHaveLength(RECORDED);
  expect(onPhone.map((s) => s.id)).toEqual(rows.map((row) => row.id));
  for (const [index, row] of rows.entries()) {
    expect(onPhone[index]).toMatchObject(asPhoneSession(row));
  }

  // 3. The dashboard's averages equal the same averages in SQL.
  const admin = await adminAtDesk(browser, testInfo);
  const now = new Date();
  const monthStart = pakistanStart('month', now).toISOString();
  const weekStart = pakistanStart('week', now).toISOString();
  const [figures] = await queryRows<Record<string, unknown>>(
    `select
      (select avg(teaching_seconds) from teaching_sessions where started_at >= $1) as teaching,
      (select avg(overtime_seconds) from teaching_sessions where started_at >= $1) as overtime,
      (select count(*) from teaching_sessions where started_at >= $2) as this_week,
      (select count(distinct doctor_id) from teaching_sessions
        where started_at >= $3::timestamptz - interval '14 days') as active_doctors,
      (select count(*) from students) as students`,
    [monthStart, weekStart, now.toISOString()],
  );
  const perStep = await queryRows<{ step: number; average: string }>(
    `select ss.step, avg(ss.rating) as average
     from session_steps ss join teaching_sessions s on s.id = ss.session_id
     where s.started_at >= $1 and ss.rating is not null group by ss.step`,
    [monthStart],
  );
  const overview = await (
    await admin.page.request.get('/api/admin/overview')
  ).json();
  expectSameAverage(overview.avgTeachingSecondsThisMonth, figures?.teaching);
  expectSameAverage(overview.avgOvertimeSecondsThisMonth, figures?.overtime);
  for (let step = 1; step <= 5; step += 1) {
    // Steps no longer rated stay out of the averages, whatever is stored.
    expectSameAverage(
      overview.avgRatingPerStepThisMonth[step - 1],
      isRatedStep(step)
        ? (perStep.find((p) => p.step === step)?.average ?? null)
        : null,
    );
  }
  expect(overview.sessionsThisWeek).toBe(Number(figures?.this_week));
  expect(overview.activeDoctors).toBe(Number(figures?.active_doctors));
  expect(overview.students).toBe(Number(figures?.students));

  await admin.page.goto('/admin');
  await expect(
    admin.page
      .getByText('Average teaching time', { exact: true })
      .locator('..'),
  ).toContainText(minutesAndSeconds(Number(figures?.teaching)));

  const activity = await (
    await admin.page.request.get('/api/admin/doctors')
  ).json();
  for (const id of [KNOWN_USERS.doctor.id, KNOWN_USERS.secondDoctor.id]) {
    const [expected] = await queryRows<Record<string, unknown>>(
      `select count(*) as total, avg(teaching_seconds) as teaching, avg(overtime_seconds) as overtime,
        avg(case when (select count(ss.rating) from session_steps ss
            where ss.session_id = s.id and ss.step = any($2::int[])) = cardinality($2::int[])
          then 1 else 0 end) as all_rated,
        count(distinct student_id) as students
       from teaching_sessions s where s.doctor_id = $1`,
      [id, [...RATED_STEP_IDS]],
    );
    const row = activity.find((r: { id: string }) => r.id === id);
    expect(row.sessionsTotal).toBe(Number(expected?.total));
    expect(row.studentsTaught).toBe(Number(expected?.students));
    expectSameAverage(row.avgTeachingSeconds, expected?.teaching);
    expectSameAverage(row.avgOvertimeSeconds, expected?.overtime);
    expectSameAverage(row.allStepsRatedShare, expected?.all_rated);
  }

  // 4. CSV rows equal database rows, column by column, for 20 sessions: the 12 recorded here and 8 others.
  const response = await admin.page.request.get(
    '/api/admin/export/sessions.csv',
  );
  expect(response.ok()).toBe(true);
  const [header, ...lines] = parseCsv((await response.text()).replace(/^﻿/, ''));
  expect(header).toEqual([...CSV_COLUMNS]);
  const [{ count }] = (await queryRows<{ count: string }>(
    'select count(*) from teaching_sessions',
  )) as [{ count: string }];
  expect(lines).toHaveLength(Number(count));
  const csvById = new Map(
    lines.map((cells) => [
      cells[0],
      Object.fromEntries(CSV_COLUMNS.map((column, i) => [column, cells[i]])),
    ]),
  );

  const recordedIds = rows
    .filter((row) => diagnoses.includes(row.diagnosis ?? ''))
    .map((row) => row.id);
  const others = await queryRows<{ id: string }>(
    'select id from teaching_sessions where not (id = any($1::uuid[])) order by md5(id::text) limit 8',
    [recordedIds],
  );
  const sampleIds = [...recordedIds, ...others.map((o) => o.id)];
  expect(sampleIds).toHaveLength(20);

  const sample = await queryRows<
    SessionRow & {
      username: string;
      doctor_name: string;
      doctor_department: string | null;
      doctor_designation: string | null;
      student_name: string;
      pmdc_number: string | null;
    }
  >(
    `select s.*, u.username, u.name as doctor_name, u.department as doctor_department,
       u.designation as doctor_designation, st.name as student_name, st.pmdc_number,
       (select json_agg(json_build_object('step', ss.step, 'seconds', ss.seconds, 'rating', ss.rating,
         'content', ss.content) order by ss.step) from session_steps ss where ss.session_id = s.id) as steps
     from teaching_sessions s join users u on u.id = s.doctor_id join students st on st.id = s.student_id
     where s.id = any($1::uuid[])`,
    [sampleIds],
  );
  expect(sample).toHaveLength(20);

  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };
  const yesNo = (value: boolean | null) =>
    value === null ? '' : value ? 'yes' : 'no';

  for (const row of sample) {
    const step = (n: number) => row.steps.find((s) => s.step === n);
    const tags = (step(4)?.content.tags as string[] | undefined) ?? [];
    const expected: Record<string, string> = {
      session_id: row.id,
      date: day.format(row.started_at),
      start_time: time.format(row.started_at),
      doctor_username: cell(row.username),
      doctor_name: cell(row.doctor_name),
      doctor_department: cell(row.doctor_department),
      doctor_designation: cell(row.doctor_designation),
      student_id: row.student_id,
      student_name: cell(row.student_name),
      pmdc_number: cell(row.pmdc_number),
      learner_level: row.learner_level,
      learner_year: cell(row.learner_year),
      department: row.department,
      case_type: row.case_type,
      teaching_seconds: String(row.teaching_seconds),
      overtime_seconds: String(row.overtime_seconds),
      paused_seconds: String(row.paused_seconds),
      log_seconds: String(row.log_seconds),
      step2_mode: cell(step(2)?.content.mode),
      step4_tags: cell(tags.join('; ')),
      diagnosis: cell(row.diagnosis),
      learner_gave_diagnosis: yesNo(row.learner_gave_diagnosis),
      usefulness: cell(row.usefulness),
      pearl_used: step(3)?.content.pearlUsedId ? 'yes' : 'no',
      app_version: cell(row.app_version),
    };
    for (let n = 1; n <= 5; n += 1) {
      expected[`step${n}_rating`] = cell(step(n)?.rating);
      expected[`step${n}_seconds`] = cell(step(n)?.seconds);
    }
    expect(csvById.get(row.id)).toEqual(expected);
  }
  const formula = rows.find((row) => row.diagnosis?.startsWith('='));
  expect(csvById.get(formula?.id ?? '')?.diagnosis).toMatch(/^'=1\+1/);

  await admin.context.close();
});
