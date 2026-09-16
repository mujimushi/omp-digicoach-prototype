import { readFileSync, writeFileSync } from 'node:fs';
import { CSV_COLUMNS } from '@omp/shared';
import { KNOWN_STUDENTS } from '@omp/shared/fixtures';
import { expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';

test.skip(({ isMobile }) => isMobile, 'The dashboard runs on desktops');

/** Parses the export back, quotes and all. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows;
}

test('E2E-15 (E2E-D4) the student report in print mode hides navigation and shows every section', async ({
  adminPage,
}, testInfo) => {
  const ahmed = KNOWN_STUDENTS[0];
  await adminPage.goto(`/admin/reports/students/${ahmed?.id}`);
  await expect(
    adminPage.getByRole('heading', { name: `Student report: ${ahmed?.name}` }),
  ).toBeVisible();
  await expect(
    adminPage.getByRole('navigation', { name: 'Dashboard' }),
  ).toBeVisible();

  await adminPage.emulateMedia({ media: 'print' });
  await expect(
    adminPage.getByRole('navigation', { name: 'Dashboard' }),
  ).toBeHidden();
  await expect(
    adminPage.getByRole('button', { name: 'Print or save as PDF' }),
  ).toBeHidden();
  for (const section of [
    'Student',
    'Summary',
    'Ratings over time',
    'Sessions',
  ]) {
    await expect(
      adminPage.getByRole('region', { name: section, exact: true }),
    ).toBeVisible();
  }
  await testInfo.attach('student-report-print.png', {
    body: await adminPage.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const pdf = await adminPage.pdf({ format: 'A4', printBackground: true });
  await testInfo.attach('student-report.pdf', {
    body: pdf,
    contentType: 'application/pdf',
  });
  writeFileSync(testInfo.outputPath('student-report.pdf'), pdf);
});

test('E2E-15 (E2E-D5) the CSV download parses with the right columns, rows and ratings', async ({
  adminPage,
}, testInfo) => {
  const day = (msAgo: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(
      new Date(Date.now() - msAgo),
    );
  const from = day(20 * 86_400_000);
  const to = day(0);
  await adminPage.goto('/admin/export');
  await adminPage.getByLabel('From').fill(from);
  await adminPage.getByLabel('To').fill(to);
  const download = adminPage.waitForEvent('download');
  await adminPage.getByRole('button', { name: 'Download CSV' }).click();
  const file = testInfo.outputPath('sessions.csv');
  await (await download).saveAs(file);

  const text = readFileSync(file, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const [header, ...rows] = parseCsv(text.slice(1));
  expect(header).toEqual([...CSV_COLUMNS]);

  const expected = await queryRows<{ id: string; ratings: (number | null)[] }>(
    `select s.id, (select array_agg(ss.rating order by ss.step) from session_steps ss where ss.session_id = s.id) as ratings
     from teaching_sessions s
     where s.started_at >= ($1::date::timestamp at time zone 'Asia/Karachi')
       and s.started_at < (($2::date + 1)::timestamp at time zone 'Asia/Karachi')`,
    [from, to],
  );
  expect(expected.length).toBeGreaterThan(0);
  expect(rows).toHaveLength(expected.length);

  const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name);
  for (const row of rows) {
    const match = expected.find((e) => e.id === row[col('session_id')]);
    expect(match, `session ${row[col('session_id')]}`).toBeDefined();
    const ratings = [1, 2, 3, 4, 5].map(
      (n) => row[col(`step${n}_rating` as (typeof CSV_COLUMNS)[number])],
    );
    expect(ratings).toEqual(
      match?.ratings.map((r) => (r === null ? '' : String(r))),
    );
  }
});
