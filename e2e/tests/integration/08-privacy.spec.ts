import { KNOWN_STUDENTS } from '@omp/shared/fixtures';
import { expect, test } from '../../support/fixtures.ts';
import { queryRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  nextStep,
  rateStep,
  startSession,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-08 a second doctor sees neither the first doctor’s sessions, pearls nor ratings, in the app or through the API', async ({
  doctorPage: first,
  secondDoctorPage: second,
}) => {
  const diagnosis = `Private diagnosis ${Date.now() % 100000}`;
  const pearlDx = `Private pearl ${Date.now() % 100000}`;

  await first.goto('/');
  await startSession(first, 'Ahmed Khan');
  await first.getByLabel('Learner’s answer').fill(pearlDx);
  await rateStep(first, 5);
  await nextStep(first, 2);
  await nextStep(first, 3);
  await first.getByLabel('Warning sign').fill('A teaching point only I see');
  await first.getByRole('button', { name: 'Save as teaching pearl' }).click();
  await expect(
    first.getByRole('button', { name: 'Pearl saved' }),
  ).toBeVisible();
  await nextStep(first, 4);
  await nextStep(first, 5);
  await first.getByRole('button', { name: 'Finish' }).click();
  await first.getByLabel('Diagnosis').fill(diagnosis);
  await first.getByRole('button', { name: 'Save' }).click();
  await expect(
    first.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  await expectAllSent(first);

  const [stored] = await queryRows<{ id: string }>(
    'select id from teaching_sessions where diagnosis = $1',
    [diagnosis],
  );
  const [pearl] = await queryRows<{ id: string }>(
    'select id from pearls where diagnosis = $1',
    [pearlDx],
  );
  expect(stored?.id).toBeTruthy();
  expect(pearl?.id).toBeTruthy();

  // In the app.
  await second.goto('/');
  await expectAllSent(second);
  await second.getByRole('link', { name: 'History' }).click();
  await expect(second.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(second.getByText(diagnosis)).toHaveCount(0);
  await second.goto(`/history/${stored?.id}`);
  await expect(second).toHaveURL(/\/history$/);
  await second.goto('/pearls');
  await expect(
    second.getByRole('heading', { name: 'Teaching pearls' }),
  ).toBeVisible();
  await expect(second.getByText(pearlDx)).toHaveCount(0);
  // Ahmed Khan was taught by the first doctor only: his progress page shows the second doctor nothing.
  await second.goto(`/progress/${KNOWN_STUDENTS[0]?.id}`);
  await expect(
    second.getByText('You haven’t taught this student yet.'),
  ).toBeVisible();
  await expect(second.getByRole('table')).toHaveCount(0);

  // Through the API.
  const pull = await second.request.get('/api/sync/pull?cursor=');
  expect(pull.status()).toBe(200);
  const body = await pull.text();
  expect(body).not.toContain(stored?.id ?? 'never');
  expect(body).not.toContain(pearl?.id ?? 'never');
  expect(body).not.toContain(diagnosis);
  expect(body).not.toContain('A teaching point only I see');
  expect((await second.request.get('/api/admin/sessions')).status()).toBe(403);
  expect(
    (await second.request.get(`/api/admin/sessions/${stored?.id}`)).status(),
  ).toBe(403);
});
