import { expect, type Page } from '@playwright/test';

/** Chip colour changes animate for 0.2 s; measure after they settle. */
const CHIP_SETTLE_MS = 350;

async function widths(page: Page, names: readonly string[]): Promise<number[]> {
  const result: number[] = [];
  for (const name of names) {
    const box = await page
      .getByRole('button', { name, exact: true })
      .boundingBox();
    if (!box) throw new Error(`Chip "${name}" is not visible`);
    result.push(Math.round(box.width * 100) / 100);
  }
  return result;
}

/**
 * Records each chip's width, taps each chip in turn, and checks after each tap that no chip's
 * width changed.
 */
export async function expectChipsStable(
  page: Page,
  names: readonly string[],
): Promise<void> {
  const before = await widths(page, names);
  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(CHIP_SETTLE_MS);
    expect(
      await widths(page, names),
      `chip widths after tapping "${name}"`,
    ).toEqual(before);
  }
}

/** Checks that no sentence-starter text box runs past the right edge of its row. */
export async function expectTextBoxesNotClipped(page: Page): Promise<void> {
  const rows = page.getByTestId('starter-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const rowBox = await row.boundingBox();
    const inputBox = await row.getByTestId('starter-input').boundingBox();
    if (!rowBox || !inputBox)
      throw new Error(`Starter row ${i} is not visible`);
    expect(inputBox.width, `starter box ${i} width`).toBeGreaterThanOrEqual(
      100,
    );
    expect(
      inputBox.x + inputBox.width,
      `starter box ${i} right edge`,
    ).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
  }
}
