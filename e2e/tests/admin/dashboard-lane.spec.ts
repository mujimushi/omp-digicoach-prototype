import { expect, test } from '../../support/fixtures.ts';
import {
  addDoctorInDashboard,
  firstLoginOnPhone,
  phoneContext,
} from '../../support/helpers/admin.ts';

test.skip(({ isMobile }) => isMobile, 'The dashboard runs on desktops');

const suffix = () => String(Date.now() % 1_000_000);

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
