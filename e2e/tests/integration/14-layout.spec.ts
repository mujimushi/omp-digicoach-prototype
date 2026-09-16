import { STEP4_TAGS } from '@omp/shared';
import { expect, test } from '../../support/fixtures.ts';
import { nextStep, startSession } from '../../support/helpers/doctor.ts';
import {
  expectChipsStable,
  expectTextBoxesNotClipped,
} from '../../support/helpers/layout.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

const WIDTHS = [320, 360, 390, 412, 430];
const CASE_TYPES = [
  'Long Case',
  'Short Case',
  'Case Based Discussion',
  'Procedure',
  'Counseling',
  'Other',
];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Final Year'];

for (const width of WIDTHS) {
  test(`E2E-14 (E2E-B3) layout at ${width} px: chips don't move when selected, and text boxes aren't cut off`, async ({
    doctorPage: page,
  }) => {
    await page.setViewportSize({ width, height: 800 });

    await page.goto('/students/new');
    await page
      .getByRole('button', { name: 'Medical Student', exact: true })
      .click();
    await expectChipsStable(page, YEARS);

    await page.goto('/');
    await page.getByRole('button', { name: 'Teach Ahmed Khan' }).click();
    await expectChipsStable(page, CASE_TYPES);

    await page.goto('/');
    await startSession(page, 'Ahmed Khan');
    for (const step of [2, 3, 4]) await nextStep(page, step);
    await expectTextBoxesNotClipped(page);
    await expectChipsStable(page, STEP4_TAGS);
    await nextStep(page, 5);
    await expectTextBoxesNotClipped(page);
    await expect(page.getByLabel('Action plan')).toBeVisible();
  });
}
