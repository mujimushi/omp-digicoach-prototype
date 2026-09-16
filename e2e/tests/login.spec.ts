import { createAdminWithCli } from '../support/cli.ts';
import { expect, test } from '../support/fixtures.ts';

test('a new admin logs in with the temporary password, changes it, and logs out', async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name.replace(/(\w)\w*-?/g, '$1');
  const username = `admin.${project}.${Date.now() % 1_000_000}`;
  const temporaryPassword = createAdminWithCli('E2E Admin', username);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(temporaryPassword);
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page).toHaveURL(/\/change-password$/);
  await expect(
    page.getByRole('heading', { name: 'Choose your password' }),
  ).toBeVisible();

  const newPassword = 'the admin chose a long phrase';
  await page.getByLabel('Temporary password').fill(temporaryPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('New password again').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole('navigation', { name: 'Dashboard' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The old login is gone: the dashboard sends us back to the login screen.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});
