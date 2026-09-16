import { contextFor, expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  runQuickSession,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';

test('E2E-13 two doctors, offline, add a student with the same PMDC number and record a session each; after sync there is one student with both sessions', async ({
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
    await expect(
      page.getByRole('button', { name: 'Teach Ahmed Khan' }),
    ).toBeVisible();
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

  const students = await queryRows<{ id: string; name: string }>(
    'select id, name from students where pmdc_number = $1',
    [pmdc.toUpperCase()],
  );
  expect(students).toHaveLength(1);
  const sessions = await queryRows<{ student_id: string }>(
    'select student_id from teaching_sessions where diagnosis like $1',
    [`Twin session % ${pmdc}`],
  );
  expect(sessions).toHaveLength(2);
  expect(sessions.every((s) => s.student_id === students[0]?.id)).toBe(true);

  // The second phone now lists the student under the first ID, once.
  const second = pages[1];
  if (!second) throw new Error('second phone missing');
  await second.reload();
  await expect(
    second.getByRole('button', { name: /Teach Twin Student/ }),
  ).toHaveCount(1);

  for (const context of phones) await context.close();
});
