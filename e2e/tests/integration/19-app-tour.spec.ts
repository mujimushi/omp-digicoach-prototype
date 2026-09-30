import { expect, test } from '../../support/fixtures.ts';
import { firstLoginOnPhone } from '../../support/helpers/admin.ts';
import { countRows, queryRows } from '../../support/helpers/db.ts';
import { outboxCount } from '../../support/helpers/doctor.ts';
import {
  addDoctorByApi,
  adminAtDesk,
  emptyPhone,
  uniqueUsername,
} from '../../support/helpers/people.ts';

test('E2E-19 a new doctor takes the app tour and a practice session; nothing is saved, and the tour doesn’t return', async ({
  browser,
}, testInfo) => {
  const admin = await adminAtDesk(browser, testInfo);
  const username = uniqueUsername('dr.tour', testInfo);
  const doctor = await addDoctorByApi(
    admin.context.request,
    'Dr. First Day',
    username,
  );
  await admin.context.close();

  const { context, page } = await emptyPhone(browser, testInfo);
  await firstLoginOnPhone(
    page,
    username,
    doctor.password,
    'my very first ward round',
    { tour: 'leave' },
  );

  const cards = page.getByRole('dialog');
  await expect(cards).toHaveAccessibleName('Welcome to OMP DigiCoach');
  for (const title of [
    'Five steps, one minute',
    'Works without signal',
    'Try a practice session',
  ]) {
    await cards.getByRole('button', { name: 'Next' }).click();
    await expect(cards).toHaveAccessibleName(title);
  }
  await cards.getByRole('button', { name: 'Start practice' }).click();

  await expect(page.getByText('Practice · nothing is saved')).toBeVisible();
  await expect(page.getByText('Tap the learner to begin.')).toBeVisible();
  // The doctor's own student list is hidden during practice.
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Teach Practice Learner' }).click();

  await expect(page.getByText('Choose the case type.')).toBeVisible();
  await page.getByRole('button', { name: 'Long Case' }).click();
  await expect(page.getByText('Start the one-minute timer.')).toBeVisible();
  await page.getByRole('button', { name: /Start teaching session/ }).click();

  await expect(
    page.getByText('One minute for all five steps. Tap to pause.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByText('Rate the learner on this step.')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByText('Go through the five steps.')).toBeVisible();
  for (let step = 1; step < 5; step += 1)
    await page.getByRole('button', { name: 'Next step' }).click();

  await expect(page.getByText('Finish when you’re done.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByText('Add a note if you like, then save.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  const ready = page.getByRole('dialog', { name: 'You’re ready' });
  await expect(ready).toBeVisible();
  await ready.getByRole('button', { name: 'Start teaching' }).click();
  await expect(page.getByText('Practice · nothing is saved')).toBeHidden();
  await expect(
    page.getByText('No students yet. Add the first one.'),
  ).toBeVisible();

  expect(await outboxCount(page)).toBe(0);
  expect(
    await countRows('teaching_sessions', 'doctor_id = $1', [doctor.id]),
  ).toBe(0);
  await expect
    .poll(async () => {
      const [row] = await queryRows<{ tour_completed_at: Date | null }>(
        'select tour_completed_at from users where id = $1',
        [doctor.id],
      );
      return row?.tour_completed_at ?? null;
    })
    .not.toBeNull();

  await page.reload();
  await expect(
    page.getByText('No students yet. Add the first one.'),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await context.close();

  // A second phone: the server remembers the tour.
  const second = await emptyPhone(browser, testInfo);
  await second.page.goto('/');
  await second.page.getByLabel('Username').fill(username);
  await second.page.getByLabel('Password').fill('my very first ward round');
  await second.page.getByRole('button', { name: 'Log In' }).click();
  await expect(
    second.page.getByText('No students yet. Add the first one.'),
  ).toBeVisible();
  await expect(second.page.getByRole('dialog')).toBeHidden();
  await second.context.close();
});
