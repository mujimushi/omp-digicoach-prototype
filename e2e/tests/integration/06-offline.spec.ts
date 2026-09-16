import { expect, test } from '../../support/fixtures.ts';
import { countRows } from '../../support/helpers/db.ts';
import {
  addStudent,
  expectAllSent,
  runQuickSession,
  syncBadge,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';
import { adminAtDesk } from '../../support/helpers/people.ts';

test('E2E-06 (E2E-C1) offline: the app loads from the service worker, saves a student and a session, and once online the admin sees each once', async ({
  doctorPage: page,
  browser,
  browserName,
  isMobile,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Service worker offline runs in phone Chromium',
  );
  const name = `Offline Student ${Date.now() % 100000}`;
  const diagnosis = `Offline diagnosis ${Date.now() % 100000}`;

  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText('Choose the learner to teach')).toBeVisible();
  await expect(syncBadge(page)).toContainText('Offline');

  await addStudent(page, name);
  await runQuickSession(page, name, diagnosis);
  await expect(syncBadge(page)).toHaveText(/2 waiting/);

  await page.context().setOffline(false);
  await expectAllSent(page, 10_000);

  expect(await countRows('students', 'name = $1', [name])).toBe(1);
  expect(
    await countRows('teaching_sessions', 'diagnosis = $1', [diagnosis]),
  ).toBe(1);

  const admin = await adminAtDesk(browser, testInfo);
  await admin.page.goto('/admin/sessions');
  await expect(
    admin.page.getByRole('row', { name: new RegExp(diagnosis) }),
  ).toHaveCount(1);
  await admin.page.goto('/admin/students');
  await expect(
    admin.page.getByRole('row', { name: new RegExp(name) }),
  ).toHaveCount(1);
  await admin.context.close();
});
