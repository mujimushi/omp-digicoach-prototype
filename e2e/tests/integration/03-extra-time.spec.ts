import { expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';
import { expectAllSent, nextStep } from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-03 (E2E-B2) extra time: at 60 s the display turns to extra time, at 90 s it shows +0:30, nothing moves on, and 90 s teaching with 30 s extra is recorded', async ({
  doctorPage: page,
}) => {
  const diagnosis = `Extra time check ${Date.now() % 100000}`;
  const start = new Date('2026-09-17T04:00:00.000Z');
  await page.clock.install({ time: start });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teach Fatima Rizvi' }).click();
  await page.getByRole('button', { name: 'Short Case', exact: true }).click();

  // Freeze time, so the session starts at a known moment.
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await expect(page.getByTestId('timer-text')).toHaveText('1:00');

  await page.clock.fastForward('01:00');
  await expect(page.getByTestId('timer-text')).toHaveText('0:00');
  await page.clock.fastForward(1000);
  await expect(page.getByTestId('timer-text')).toHaveText('+0:01');
  await expect(page.getByText('EXTRA TIME')).toBeVisible();

  await page.clock.fastForward(14_000);
  await expect(
    page.getByRole('button', { name: 'Extra time 0:15' }),
  ).toBeVisible();
  await page.clock.fastForward(15_000);
  await expect(page.getByTestId('timer-text')).toHaveText('+0:30');
  await expect(
    page.getByRole('heading', { name: 'Step 1 of 5' }),
  ).toBeVisible();

  for (const step of [2, 3, 4, 5]) await nextStep(page, step);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('log-times')).toHaveText(
    'Teaching time 1m 30s · Extra time 30s',
  );
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();

  await page.clock.resume();
  await expectAllSent(page);
  const [row] = await queryRows<{
    teaching_seconds: number;
    overtime_seconds: number;
  }>(
    'select teaching_seconds, overtime_seconds from teaching_sessions where diagnosis = $1',
    [diagnosis],
  );
  expect(row).toEqual({ teaching_seconds: 90, overtime_seconds: 30 });
});
