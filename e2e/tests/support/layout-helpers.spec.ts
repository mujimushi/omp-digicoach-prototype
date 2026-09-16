import { expect, test } from '../../support/fixtures.ts';
import {
  expectChipsStable,
  expectTextBoxesNotClipped,
} from '../../support/helpers/layout.ts';

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'Checks the helpers once, on desktop Chromium',
);

test('expectChipsStable fails on a chip that grows when tapped', async ({
  page,
}) => {
  await page.setContent(`
    <button type="button" id="a" onclick="this.style.fontWeight='700';this.style.paddingRight='24px'">Long Case</button>
    <button type="button" id="b">Short Case</button>`);
  await expect(
    expectChipsStable(page, ['Long Case', 'Short Case']),
  ).rejects.toThrow(/chip widths after tapping "Long Case"/);
});

test('expectChipsStable passes on chips that keep their width', async ({
  page,
}) => {
  await page.setContent(`
    <button type="button" style="width:120px" onclick="this.style.fontWeight='700'">Long Case</button>
    <button type="button" style="width:120px">Short Case</button>`);
  await expectChipsStable(page, ['Long Case', 'Short Case']);
});

test('expectTextBoxesNotClipped fails when a starter box runs past its row', async ({
  page,
}) => {
  await page.setContent(`
    <div data-testid="starter-row" style="display:flex;width:300px;overflow:hidden">
      <label style="white-space:nowrap;flex-shrink:0">Good clinical reasoning because</label>
      <input data-testid="starter-input" style="width:200px;flex-shrink:0">
    </div>`);
  await expect(expectTextBoxesNotClipped(page)).rejects.toThrow(/right edge/);
});
