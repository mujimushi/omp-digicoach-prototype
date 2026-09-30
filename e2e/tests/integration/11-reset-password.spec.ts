import { expect, test } from '../../support/fixtures.ts';
import { firstLoginOnPhone } from '../../support/helpers/admin.ts';
import {
  addDoctorByApi,
  adminAtDesk,
  emptyPhone,
  uniqueUsername,
} from '../../support/helpers/people.ts';

test('E2E-11 the admin resets a password; the doctor’s old login stops; the temporary password works and must be changed', async ({
  browser,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium',
    'Runs in desktop Chromium and phone Chromium',
  );
  const admin = await adminAtDesk(browser, testInfo);
  const username = uniqueUsername('dr.reset', testInfo);
  const doctor = await addDoctorByApi(
    admin.context.request,
    'Dr. Forgetful',
    username,
  );

  const phone = await emptyPhone(browser, testInfo);
  await firstLoginOnPhone(
    phone.page,
    username,
    doctor.password,
    'the first password I chose',
  );
  await expect(
    phone.page.getByText('Choose the learner to teach'),
  ).toBeVisible();

  await admin.page.goto(`/admin/doctors/${doctor.id}/edit`);
  await admin.page.getByRole('button', { name: 'Reset password' }).click();
  await admin.page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset password' })
    .click();
  const temporary =
    (
      await admin.page.getByTestId('temporary-password').textContent()
    )?.trim() ?? '';
  expect(temporary).toMatch(/^[a-z]{3,6}\d{4}$/);

  expect((await phone.context.request.get('/api/me')).status()).toBe(401);
  await phone.page.reload();
  await expect(
    phone.page.getByRole('button', { name: 'Log In' }),
  ).toBeVisible();

  await phone.page.getByLabel('Username').fill(username);
  await phone.page.getByLabel('Password').fill('the first password I chose');
  await phone.page.getByRole('button', { name: 'Log In' }).click();
  await expect(phone.page.getByRole('alert')).toHaveText(
    'Wrong username or password.',
  );

  await phone.page.getByLabel('Password').fill(temporary);
  await phone.page.getByRole('button', { name: 'Log In' }).click();
  await expect(
    phone.page.getByRole('heading', { name: 'Choose your password' }),
  ).toBeVisible();

  await phone.context.close();
  await admin.context.close();
});
