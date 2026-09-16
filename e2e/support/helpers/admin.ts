import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Page,
} from '@playwright/test';

/** A phone for the doctor's side of a dashboard test. */
export async function phoneContext(
  browser: Browser,
  baseURL: string,
): Promise<BrowserContext> {
  return browser.newContext({ ...devices['Pixel 7'], baseURL });
}

/** Adds a doctor through the dashboard form and returns the temporary password it shows once. */
export async function addDoctorInDashboard(
  page: Page,
  name: string,
  username: string,
): Promise<string> {
  await page.goto('/admin/doctors/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Department').selectOption('medicine');
  await page.getByLabel('Designation').selectOption('registrar');
  await page.getByRole('button', { name: 'Add doctor' }).click();
  const password = await page.getByTestId('temporary-password').textContent();
  if (!password) throw new Error('No temporary password shown');
  return password.trim();
}

/** Logs in on the phone and chooses a new password. */
export async function firstLoginOnPhone(
  phone: Page,
  username: string,
  temporaryPassword: string,
  newPassword: string,
) {
  await phone.goto('/');
  await phone.getByLabel('Username').fill(username);
  await phone.getByLabel('Password').fill(temporaryPassword);
  await phone.getByRole('button', { name: 'Log In' }).click();
  await expect(
    phone.getByRole('heading', { name: 'Choose your password' }),
  ).toBeVisible();
  await phone.getByLabel('Temporary password').fill(temporaryPassword);
  await phone.getByLabel('New password', { exact: true }).fill(newPassword);
  await phone.getByLabel('New password again').fill(newPassword);
  await phone.getByRole('button', { name: 'Save new password' }).click();
}
