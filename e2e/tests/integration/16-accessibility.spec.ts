import { KNOWN_STUDENTS } from '@omp/shared/fixtures';
import { expect, test } from '../../support/fixtures.ts';
import { expectNoSeriousA11yIssues } from '../../support/helpers/axe.ts';
import { startSession } from '../../support/helpers/doctor.ts';

test('E2E-16 accessibility: the login screen', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});

test('E2E-16 (E2E-B4) accessibility: the student list, a session step and the quick log', async ({
  doctorPage: page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The doctor app runs on phones');
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Students' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Teach Nadia Qamar' }),
  ).toBeVisible();
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

test('E2E-16 (E2E-D6) accessibility: the overview, the doctors list and a student’s detail', async ({
  adminPage,
  isMobile,
}) => {
  test.skip(isMobile, 'The dashboard runs on desktops');
  await adminPage.goto('/admin');
  await expect(adminPage.getByText('Active doctors')).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);

  await adminPage.goto('/admin/doctors');
  await expect(adminPage.getByRole('table', { name: 'Doctors' })).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);

  await adminPage.goto(`/admin/students/${KNOWN_STUDENTS[0]?.id}`);
  await expect(
    adminPage.getByRole('region', { name: 'Change history' }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(adminPage);
});
