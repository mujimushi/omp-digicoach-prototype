import { isRatedStep, RATING_LABELS } from '@omp/shared';
import { expect, test } from '../../support/fixtures.ts';
import {
  expectAllSent,
  rateAllAndFinish,
  startSession,
} from '../../support/helpers/doctor.ts';
import { adminAtDesk } from '../../support/helpers/people.ts';

test('E2E-02 (E2E-B1) a doctor adds a student and records a session; History and the admin show the same ratings and times', async ({
  doctorPage: page,
  browser,
}, testInfo) => {
  test.skip(!testInfo.project.use.isMobile, 'The doctor records on a phone');
  const student = `Session Student ${Date.now() % 100000}`;
  const diagnosis = `Pleural effusion ${Date.now() % 100000}`;
  const ratings = [3, 4, 2, 5, 1] as const;

  await page.goto('/');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Name', { exact: true }).fill(student);
  await page
    .getByRole('button', { name: 'Medical Student', exact: true })
    .click();
  await page.getByRole('button', { name: '4th Year', exact: true }).click();
  await page.getByRole('button', { name: 'Add student' }).click();

  await startSession(page, student);
  await page.getByLabel('Learner’s answer').fill('Effusion');
  await rateAllAndFinish(page, ratings);
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Usefulness 5' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  await expectAllSent(page);

  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: new RegExp(diagnosis) }).click();
  for (const [index, stars] of ratings.entries()) {
    const card = page.getByTestId(`step-${index + 1}`);
    if (isRatedStep(index + 1))
      await expect(card).toContainText(RATING_LABELS[stars - 1] ?? '');
    else await expect(card).not.toContainText('Not rated');
  }
  const appTime = await page
    .locator('dt', { hasText: /^Teaching time$/ })
    .locator('xpath=following-sibling::dd')
    .textContent();
  const appExtra = await page
    .locator('dt', { hasText: /^Extra time$/ })
    .locator('xpath=following-sibling::dd')
    .textContent();

  const admin = await adminAtDesk(browser, testInfo);
  await admin.page.goto('/admin/sessions');
  await admin.page
    .getByRole('row', { name: new RegExp(diagnosis) })
    .getByRole('link')
    .first()
    .click();
  await expect(
    admin.page.getByRole('heading', { name: diagnosis }),
  ).toBeVisible();
  for (const [index, stars] of ratings.entries()) {
    const region = admin.page.getByRole('region', {
      name: new RegExp(`^Step ${index + 1}:`),
    });
    if (isRatedStep(index + 1))
      await expect(region).toContainText(
        `${stars} of 5, ${RATING_LABELS[stars - 1]}`,
      );
    else await expect(region).not.toContainText('of 5');
  }
  await expect(
    admin.page.getByRole('row', { name: /^Teaching time/ }),
  ).toContainText(appTime ?? 'missing');
  await expect(
    admin.page.getByRole('row', { name: /^Extra time/ }),
  ).toContainText(appExtra ?? 'missing');
  await expect(admin.page.getByRole('row', { name: /^Student/ })).toContainText(
    student,
  );
  await admin.context.close();
});
