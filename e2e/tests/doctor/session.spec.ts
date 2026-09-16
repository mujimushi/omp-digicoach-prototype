import { STEPS } from '@omp/shared';
import { expect, test } from '../../support/fixtures.ts';
import {
  nextStep,
  rateStep,
  startSession,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-B1 full session: rate each step, fill the quick log, find it in History', async ({
  doctorPage: page,
}) => {
  await page.goto('/');
  await startSession(page, 'Ahmed Khan');

  await page.getByLabel('Learner’s answer').fill('Pneumonia');
  const ratings = [3, 4, 2, 5, 1] as const;
  for (const [index, stars] of ratings.entries()) {
    await expect(
      page.getByRole('heading', { name: STEPS[index]?.name ?? '' }),
    ).toBeVisible();
    await rateStep(page, stars);
    if (index < 4) await nextStep(page, index + 2);
  }
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByRole('heading', { name: 'Quick log' })).toBeVisible();
  await page.getByLabel('Diagnosis').fill('Community acquired pneumonia');
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Usefulness 5' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await page
    .getByRole('link', { name: /Community acquired pneumonia/ })
    .click();

  const labels = [
    'Competent',
    'Proficient',
    'Basic',
    'Excellent',
    'Needs improvement',
  ];
  for (const [index, label] of labels.entries()) {
    await expect(page.getByTestId(`step-${index + 1}`)).toContainText(label);
  }
  await expect(page.getByText('Teaching time')).toBeVisible();
  await expect(page.getByText('Usefulness')).toBeVisible();
  await expect(page.getByText('5 of 6')).toBeVisible();
});

test('E2E-B2 extra time: +0:15 after 75 seconds on the same step, 15 s recorded', async ({
  doctorPage: page,
}) => {
  const start = new Date('2026-09-17T04:00:00.000Z');
  await page.clock.install({ time: start });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teach Fatima Rizvi' }).click();
  await page.getByRole('button', { name: 'Short Case', exact: true }).click();

  // Freeze time, so the session starts at a known moment.
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await expect(page.getByTestId('timer-text')).toHaveText('1:00');

  await page.clock.fastForward('01:15');
  await expect(page.getByTestId('timer-text')).toHaveText('+0:15');
  await expect(
    page.getByRole('button', { name: 'Extra time 0:15' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Step 1 of 5' }),
  ).toBeVisible();

  for (const step of [2, 3, 4, 5]) await nextStep(page, step);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('log-times')).toHaveText(
    'Teaching time 1m 15s · Extra time 15s',
  );
});
