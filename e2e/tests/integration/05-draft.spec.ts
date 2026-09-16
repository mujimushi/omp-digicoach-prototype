import { expect, test } from '../../support/fixtures.ts';
import { nextStep, startSession } from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-05 (E2E-C3) a reload during Step 3 brings back the text and times', async ({
  doctorPage: page,
}) => {
  await page.goto('/');
  await startSession(page, 'Fatima Rizvi');
  await nextStep(page, 2);
  await nextStep(page, 3);
  await page.getByLabel('Red flag').fill('Sudden breathlessness');
  await page.waitForTimeout(1_200);

  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Step 3 of 5' }),
  ).toBeVisible();
  await expect(page.getByLabel('Red flag')).toHaveValue(
    'Sudden breathlessness',
  );
  // The countdown kept running across the reload instead of starting again.
  await expect(page.getByTestId('timer-text')).not.toHaveText('1:00');
});

test('E2E-05 an old draft asks Resume or Discard', async ({
  doctorPage: page,
}) => {
  const start = new Date('2026-09-17T06:00:00.000Z');
  await page.clock.install({ time: start });
  await page.goto('/');
  await startSession(page, 'Bilal Hussain');
  await nextStep(page, 2);
  await page.clock.runFor(1_000);

  // The doctor closes the app and opens it again 16 minutes later.
  const context = page.context();
  await page.close();
  const later = await context.newPage();
  await later.clock.install({ time: new Date(start.getTime() + 16 * 60_000) });
  await later.goto('/');

  const prompt = later.getByRole('alertdialog', {
    name: /Resume the session with Bilal Hussain from \d\d:\d\d\?/,
  });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Resume' }).click();
  await expect(
    later.getByRole('heading', { name: 'Step 2 of 5' }),
  ).toBeVisible();
  await expect(later.getByTestId('timer-text')).toHaveText(/^\+1[56]:\d\d$/);

  // Leave, and this time discard.
  await later.getByRole('button', { name: 'Leave session' }).click();
  await later
    .getByRole('region', { name: 'Session in progress' })
    .getByRole('button', { name: 'Discard' })
    .click();
  await later
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
    .click();
  await expect(
    later.getByRole('region', { name: 'Session in progress' }),
  ).toBeHidden();
});
