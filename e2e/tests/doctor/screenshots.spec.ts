import { expect, test } from '../../support/fixtures.ts';
import {
  nextStep,
  rateStep,
  startSession,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('screenshots of each doctor screen at 390 px, attached to the report', async ({
  doctorPage: page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shoot = async (name: string) => {
    await testInfo.attach(`${testInfo.project.name}-${name}`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  };

  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Students' })).toBeVisible();
  await shoot('01-student-list');

  await page.getByRole('button', { name: 'Add student' }).click();
  await page
    .getByRole('button', { name: 'Medical Student', exact: true })
    .click();
  await shoot('02-add-student');

  await page.goto('/');
  await startSession(page, 'Ahmed Khan');
  await page.getByLabel('Learner’s answer').fill('Pneumonia');
  await rateStep(page, 4);
  await shoot('03-step-1');
  for (const step of [2, 3, 4, 5]) {
    await nextStep(page, step);
    await rateStep(page, 3);
    await shoot(`0${step + 2}-step-${step}`);
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Diagnosis').fill('Pneumonia');
  await shoot('08-quick-log');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();

  const screens: [string, string][] = [
    ['History', '09-history'],
    ['Stats', '11-stats'],
    ['Progress', '12-progress'],
    ['More', '14-more'],
  ];
  for (const [tab, name] of screens) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.waitForTimeout(200);
    await shoot(name);
    if (tab === 'History') {
      await page
        .getByRole('link', { name: /Pneumonia/ })
        .first()
        .click();
      await shoot('10-session-detail');
      await page.getByRole('link', { name: 'History', exact: true }).click();
    }
    if (tab === 'Progress') {
      await page.getByRole('link', { name: /Ahmed Khan/ }).click();
      await shoot('13-student-progress');
    }
  }
  await page.getByRole('link', { name: /About OMP/ }).click();
  await shoot('15-about');
});
