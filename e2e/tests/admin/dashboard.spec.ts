import { writeFileSync } from 'node:fs';
import { KNOWN_STUDENTS } from '@omp/shared/fixtures';
import { expect, test } from '../../support/fixtures.ts';
import {
  addDoctorInDashboard,
  firstLoginOnPhone,
  phoneContext,
} from '../../support/helpers/admin.ts';
import { expectNoSeriousA11yIssues } from '../../support/helpers/axe.ts';
import { countRows } from '../../support/helpers/db.ts';

test.skip(({ isMobile }) => isMobile, 'The dashboard runs on desktops');

const suffix = () => String(Date.now() % 1_000_000);

test('E2E-D1 the admin adds a doctor; the doctor logs in on a phone, changes the password and reaches the students', async ({
  adminPage,
  browser,
  baseURL,
}) => {
  const username = `dr.new.${suffix()}`;
  const temporaryPassword = await addDoctorInDashboard(
    adminPage,
    'Dr. Newly Added',
    username,
  );
  expect(temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

  const context = await phoneContext(browser, baseURL ?? '');
  const phone = await context.newPage();
  await firstLoginOnPhone(
    phone,
    username,
    temporaryPassword,
    'a morning ward round with tea',
  );
  await expect(phone.getByText('Choose the learner to teach')).toBeVisible();
  await expect(
    phone.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
  await context.close();
});

test('E2E-D2 the admin switches a doctor off; the doctor’s next page load goes to login with a message', async ({
  adminPage,
  browser,
  baseURL,
}) => {
  const username = `dr.off.${suffix()}`;
  const temporaryPassword = await addDoctorInDashboard(
    adminPage,
    'Dr. Soon Off',
    username,
  );
  await adminPage.getByRole('button', { name: 'Done' }).click();

  const context = await phoneContext(browser, baseURL ?? '');
  const phone = await context.newPage();
  await firstLoginOnPhone(
    phone,
    username,
    temporaryPassword,
    'switch me off after this one',
  );
  await expect(phone.getByText('Choose the learner to teach')).toBeVisible();

  await adminPage.getByRole('link', { name: 'Dr. Soon Off' }).click();
  await adminPage.getByRole('button', { name: 'Edit' }).click();
  await adminPage.getByRole('button', { name: 'Switch off' }).click();
  await adminPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Switch off' })
    .click();
  await expect(
    adminPage.getByRole('button', { name: 'Switch on' }),
  ).toBeVisible();

  await phone.reload();
  await expect(phone.getByRole('button', { name: 'Log In' })).toBeVisible();
  await expect(
    phone.getByText('This account has been switched off. Ask the admin.'),
  ).toBeVisible();
  await context.close();
});

test('E2E-D3 a doctor opening /admin is blocked, and a direct admin request gets 403', async ({
  doctorPage,
}) => {
  await doctorPage.goto('/admin');
  await expect(
    doctorPage.getByRole('heading', { name: 'This page is for the admin' }),
  ).toBeVisible();
  const response = await doctorPage.request.get('/api/admin/overview');
  expect(response.status()).toBe(403);
  const doctors = await doctorPage.request.get('/api/admin/doctors');
  expect(doctors.status()).toBe(403);
});

test('E2E-D4 the student report in print mode hides navigation and shows every section', async ({
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

test('E2E-D5 the CSV download parses with the right columns and a row per seeded session in range', async ({
  adminPage,
}, testInfo) => {
  const to = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
  }).format(new Date());
  const from = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
  }).format(new Date(Date.now() - 20 * 86_400_000));
  await adminPage.goto('/admin/export');
  await adminPage.getByLabel('From').fill(from);
  await adminPage.getByLabel('To').fill(to);
  const download = adminPage.waitForEvent('download');
  await adminPage.getByRole('button', { name: 'Download CSV' }).click();
  const file = testInfo.outputPath('sessions.csv');
  await (await download).saveAs(file);

  const { readFileSync } = await import('node:fs');
  const text = readFileSync(file, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trimEnd().split('\r\n');
  const { CSV_COLUMNS } = await import('@omp/shared');
  expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  const expected = await countRows(
    'teaching_sessions',
    "started_at >= ($1::date::timestamp at time zone 'Asia/Karachi') and started_at < (($2::date + 1)::timestamp at time zone 'Asia/Karachi')",
    [from, to],
  );
  expect(expected).toBeGreaterThan(0);
  expect(lines).toHaveLength(expected + 1);
  const ratingIndex = CSV_COLUMNS.indexOf('step1_rating');
  for (const line of lines.slice(1)) {
    const rating = line.split(',')[ratingIndex];
    expect(['', '1', '2', '3', '4', '5']).toContain(rating);
  }
});

test('E2E-D6 accessibility: the overview, the doctors list and a student’s detail', async ({
  adminPage,
}) => {
  await adminPage.goto('/admin');
  await expect(adminPage.getByText('Active doctors')).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);

  await adminPage.goto('/admin/doctors');
  await expect(adminPage.getByRole('table', { name: 'Doctors' })).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);

  await adminPage.goto(`/admin/students/${KNOWN_STUDENTS[0]?.id}`);
  await expect(
    adminPage.getByRole('region', { name: 'Change history' }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);
});
