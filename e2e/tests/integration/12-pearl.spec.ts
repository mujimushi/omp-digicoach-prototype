import { expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  nextStep,
  startSession,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

async function finishAndSave(
  page: import('@playwright/test').Page,
  diagnosis: string,
) {
  for (const step of [4, 5]) await nextStep(page, step);
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
}

test('E2E-12 a pearl saved for Pneumonia appears for "community acquired pneumonia", fills the fields when used, counts the use, and another doctor never sees it', async ({
  doctorPage: page,
  secondDoctorPage: other,
}) => {
  await page.goto('/');
  await startSession(page, 'Ahmed Khan');
  await page.getByLabel('Learner’s answer').fill('Pneumonia');
  await nextStep(page, 2);
  await nextStep(page, 3);
  await page
    .getByLabel('One important thing to remember is')
    .fill('CURB-65 guides admission');
  await page.getByLabel('In patients with').fill('hypoxia');
  await page.getByLabel('always check').fill('oxygen saturation');
  await page.getByLabel('First-line treatment is usually').fill('amoxicillin');
  await page.getByLabel('Warning sign').fill('confusion');
  await page.getByRole('button', { name: 'Save as teaching pearl' }).click();
  await expect(page.getByRole('button', { name: 'Pearl saved' })).toBeVisible();
  await finishAndSave(page, 'Pneumonia');

  await startSession(page, 'Fatima Rizvi');
  await page
    .getByLabel('Learner’s answer')
    .fill('community acquired pneumonia');
  await nextStep(page, 2);
  await nextStep(page, 3);
  const banner = page.getByTestId('pearl-banner');
  await expect(banner).toContainText('Saved pearl for “Pneumonia”');
  await banner.getByRole('button', { name: 'Use saved pearl' }).click();
  await expect(
    page.getByLabel('One important thing to remember is'),
  ).toHaveValue('CURB-65 guides admission');
  await expect(page.getByLabel('In patients with')).toHaveValue('hypoxia');
  await expect(page.getByLabel('always check')).toHaveValue(
    'oxygen saturation',
  );
  await expect(page.getByLabel('First-line treatment is usually')).toHaveValue(
    'amoxicillin',
  );
  await expect(page.getByLabel('Warning sign')).toHaveValue('confusion');
  await finishAndSave(page, 'Community acquired pneumonia');
  await expectAllSent(page);

  const [pearl] = await queryRows<{ id: string; times_used: number }>(
    "select id, times_used from pearls where diagnosis = 'Pneumonia'",
  );
  expect(pearl?.times_used).toBe(1);
  await page.goto('/pearls');
  await expect(page.getByText('Used 1 time')).toBeVisible();

  await other.goto('/pearls');
  await expect(
    other.getByRole('heading', { name: 'Teaching pearls' }),
  ).toBeVisible();
  await expect(other.getByText('CURB-65 guides admission')).toHaveCount(0);
  const pull = await other.request.get('/api/sync/pull?cursor=');
  expect(await pull.text()).not.toContain(pearl?.id ?? 'never');
});
