import { contextFor, expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  runQuickSession,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';

test('E2E-13 two doctors, offline, add a student with the same PMDC number and record a session each; after sync each doctor has their own record, with their own session', async ({
  browser,
  browserName,
  isMobile,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Two phone Chromium contexts',
  );
  const pmdc = `${Date.now() % 100000}-T`;
  const phones = await Promise.all([
    contextFor(browser, testInfo, 'doctor'),
    contextFor(browser, testInfo, 'secondDoctor'),
  ]);
  const pages = await Promise.all(phones.map((context) => context.newPage()));

  for (const [i, page] of pages.entries()) {
    await page.goto('/');
    await expect(page.getByText('Choose the learner to teach')).toBeVisible();
    await waitForServiceWorker(page);
    await phones[i]?.setOffline(true);

    await page.getByRole('button', { name: 'Add student' }).click();
    await page
      .getByLabel('Name', { exact: true })
      .fill(i === 0 ? 'Twin Student' : 'Twin Student Typed Again');
    await page.getByLabel('PMDC number (optional)').fill(pmdc);
    await page.getByRole('button', { name: 'Resident', exact: true }).click();
    await page.getByRole('button', { name: 'Add student' }).click();
    const name = i === 0 ? 'Twin Student' : 'Twin Student Typed Again';
    await runQuickSession(page, name, `Twin session ${i + 1} ${pmdc}`);
  }

  for (const [i, page] of pages.entries()) {
    await phones[i]?.setOffline(false);
    await expectAllSent(page);
  }

  // Each doctor keeps their own student list: two records, one per doctor.
  const students = await queryRows<{ id: string; created_by: string }>(
    'select id, created_by from students where pmdc_number = $1',
    [pmdc.toUpperCase()],
  );
  expect(students).toHaveLength(2);
  expect(new Set(students.map((s) => s.created_by)).size).toBe(2);
  const sessions = await queryRows<{ student_id: string; doctor_id: string }>(
    'select student_id, doctor_id from teaching_sessions where diagnosis like $1',
    [`Twin session % ${pmdc}`],
  );
  expect(sessions).toHaveLength(2);
  for (const session of sessions) {
    const student = students.find((s) => s.id === session.student_id);
    expect(student?.created_by).toBe(session.doctor_id);
  }

  // Each phone lists only its own record.
  for (const [i, page] of pages.entries()) {
    await page.reload();
    await expect(page.getByText('Choose the learner to teach')).toBeVisible();
    const own = i === 0 ? 'Twin Student' : 'Twin Student Typed Again';
    const other = i === 0 ? 'Twin Student Typed Again' : 'Twin Student';
    await expect(
      page.getByRole('button', { name: `Teach ${own}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Teach ${other}`, exact: true }),
    ).toHaveCount(0);
  }

  for (const context of phones) await context.close();
});
