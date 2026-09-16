import { expect, test } from '../../support/fixtures.ts';
import { expectNoSeriousA11yIssues } from '../../support/helpers/axe.ts';
import { startSession } from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-B4 accessibility: the student list, a session step and the quick log', async ({
  doctorPage: page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Students' })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await startSession(page, 'Nadia Qamar');
  await expectNoSeriousA11yIssues(page);

  for (let step = 2; step <= 5; step += 1) {
    await page.getByRole('button', { name: 'Next step' }).click();
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Quick log' })).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});
