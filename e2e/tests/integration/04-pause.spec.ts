import { expect, test } from '../../support/fixtures.ts';
import { expectAllSent, nextStep } from '../../support/helpers/doctor.ts';
import { adminAtDesk } from '../../support/helpers/people.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-04 pausing for 20 seconds keeps the time left, and the dashboard shows 20 s paused', async ({
  doctorPage: page,
  browser,
}, testInfo) => {
  const diagnosis = `Pause check ${Date.now() % 100000}`;
  const start = new Date('2026-09-17T05:00:00.000Z');
  await page.clock.install({ time: start });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teach Nadia Qamar' }).click();
  await page.getByRole('button', { name: 'Procedure', exact: true }).click();
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
  await page.getByRole('button', { name: /Start teaching session/ }).click();

  await page.clock.fastForward(10_000);
  await expect(page.getByTestId('timer-text')).toHaveText('0:50');

  await page.getByTestId('timer-ring').click();
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.clock.fastForward(20_000);
  await expect(page.getByTestId('timer-text')).toHaveText('0:50');

  await page.getByTestId('timer-ring').click();
  await page.clock.fastForward(5_000);
  await expect(page.getByTestId('timer-text')).toHaveText('0:45');

  for (const step of [2, 3, 4, 5]) await nextStep(page, step);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('log-times')).toHaveText(
    'Teaching time 15s · Extra time 0s',
  );
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  await page.clock.resume();
  await expectAllSent(page);

  const admin = await adminAtDesk(browser, testInfo);
  await admin.page.goto('/admin/sessions');
  await admin.page
    .getByRole('row', { name: new RegExp(diagnosis) })
    .getByRole('link')
    .first()
    .click();
  await expect(admin.page.getByRole('row', { name: /^Paused/ })).toContainText(
    '20s',
  );
  await expect(
    admin.page.getByRole('row', { name: /^Teaching time/ }),
  ).toContainText('15s');
  await admin.context.close();
});
