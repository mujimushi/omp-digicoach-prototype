import { expect, test } from '../../support/fixtures.ts';
import { firstLoginOnPhone } from '../../support/helpers/admin.ts';
import {
  addStudent,
  expectAllSent,
  outboxCount,
  runQuickSession,
  syncBadge,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';
import {
  addDoctorByApi,
  adminAtDesk,
  emptyPhone,
  uniqueUsername,
} from '../../support/helpers/people.ts';

test('E2E-10 the admin switches a doctor off; the doctor’s next sync gets 401; the app says the account is switched off and keeps the waiting data', async ({
  browser,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium',
    'Runs in phone Chromium and desktop Chromium',
  );
  const admin = await adminAtDesk(browser, testInfo);
  const username = uniqueUsername('dr.gone', testInfo);
  const doctor = await addDoctorByApi(
    admin.context.request,
    'Dr. Going Away',
    username,
  );

  const phone = await emptyPhone(browser, testInfo);
  await firstLoginOnPhone(
    phone.page,
    username,
    doctor.password,
    'this account will be switched off',
  );
  await expect(
    phone.page.getByText('No students yet. Add the first one.'),
  ).toBeVisible();
  await addStudent(phone.page, 'Taught Before Switch Off');
  await expectAllSent(phone.page);
  await waitForServiceWorker(phone.page);

  await phone.context.setOffline(true);
  await runQuickSession(
    phone.page,
    'Taught Before Switch Off',
    'Recorded before being switched off',
  );
  await expect(syncBadge(phone.page)).toHaveText(/1 waiting/);

  await admin.page.goto(`/admin/doctors/${doctor.id}/edit`);
  await admin.page.getByRole('button', { name: 'Switch off' }).click();
  await admin.page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Switch off' })
    .click();
  await expect(
    admin.page.getByRole('button', { name: 'Switch on' }),
  ).toBeVisible();

  await phone.context.setOffline(false);
  const banner = phone.page
    .getByRole('alert')
    .filter({ hasText: 'switched off' });
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText(
    'This account has been switched off. Ask the admin.',
  );
  await expect(banner).toContainText('1 saved item is kept on this phone');
  expect(await outboxCount(phone.page)).toBe(1);

  await banner.getByRole('button', { name: 'Log in' }).click();
  await expect(
    phone.page.getByRole('button', { name: 'Log In' }),
  ).toBeVisible();
  expect(await outboxCount(phone.page)).toBe(1);

  await phone.context.close();
  await admin.context.close();
});
