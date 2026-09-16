import { expect, test } from '../../support/fixtures.ts';
import { firstLoginOnPhone } from '../../support/helpers/admin.ts';
import {
  adminAtDesk,
  emptyPhone,
  uniqueUsername,
} from '../../support/helpers/people.ts';

test('E2E-01 (E2E-D1) the admin adds a doctor; the doctor logs in with the temporary password, must change it, and reaches the student list', async ({
  browser,
}, testInfo) => {
  const admin = await adminAtDesk(browser, testInfo);
  const username = uniqueUsername('dr.new', testInfo);
  await admin.page.goto('/admin/doctors/new');
  await admin.page.getByLabel('Name', { exact: true }).fill('Dr. Newly Added');
  await admin.page.getByLabel('Username').fill(username);
  await admin.page.getByLabel('Department').selectOption('medicine');
  await admin.page.getByLabel('Designation').selectOption('registrar');
  await admin.page.getByRole('button', { name: 'Add doctor' }).click();
  const temporaryPassword =
    (
      await admin.page.getByTestId('temporary-password').textContent()
    )?.trim() ?? '';
  expect(temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

  const phone = await emptyPhone(browser, testInfo);
  await firstLoginOnPhone(
    phone.page,
    username,
    temporaryPassword,
    'a morning ward round with tea',
  );
  await expect(
    phone.page.getByText('Choose the learner to teach'),
  ).toBeVisible();
  await expect(
    phone.page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();

  await phone.context.close();
  await admin.context.close();
});
