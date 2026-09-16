import { expect, test } from '../../support/fixtures.ts';
import {
  addStudent,
  expectAllSent,
  outboxCount,
  syncBadge,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';

test('E2E-17 logout with waiting data warns first; confirming clears the phone’s data', async ({
  doctorPage: page,
  browserName,
  isMobile,
}) => {
  test.skip(browserName !== 'chromium' || !isMobile, 'Runs in phone Chromium');
  await page.goto('/');
  await expectAllSent(page);
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await addStudent(page, `Unsent Student ${Date.now() % 100000}`);
  await expect(syncBadge(page)).toHaveText(/1 waiting/);

  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: '1 item hasn’t been sent',
  });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await outboxCount(page)).toBe(1);

  await page.getByRole('button', { name: 'Log out' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Log out and delete them' })
    .click();
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();

  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  expect(databases).not.toContain('omp');
});
