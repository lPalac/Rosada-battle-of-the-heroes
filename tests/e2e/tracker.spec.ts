// 003 US3-AS14 in the browser: the Royal Favor tracker modal (T025).
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });

test('the tracker opens with the button and the A key and shows both sides', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('open-tracker').click();
  await expect(page.getByTestId('tracker-light')).toBeVisible();
  await expect(page.getByTestId('tracker-dark')).toBeVisible();
  await expect(page.getByTestId('favor-light-overwhelm')).toHaveAttribute('data-status', 'open');
  await expect(page.getByTestId('tracker-dark-next')).toContainText('6 more for Hero Unit');
  await page.getByTestId('tracker-close').click();
  await expect(page.getByTestId('tracker')).toHaveCount(0);
  await page.keyboard.press('a');
  await expect(page.getByTestId('tracker')).toBeVisible();
  await page.keyboard.press('a');
  await expect(page.getByTestId('tracker')).toHaveCount(0);
});

test('after a Ram the tracker shows Overwhelm half done for the Ramming side', async ({ page }) => {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { heroId: 'H2' }, to: at(4, 3) }); // d3
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(3, 1) }); // c1
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
  for (let i = 0; i < 4; i++) {
    if ((await hook<any>(page, 'state')).phase === 'lead') break;
    await hook(page, 'dispatch', { type: 'endPhase' });
  }
  expect(await hook(page, 'dispatch', { type: 'announceLead', unitId: 'L-P-d', to: at(4, 4) })).toBe(true);
  await page.keyboard.press('a');
  await expect(page.getByTestId('favor-light-overwhelm')).toHaveAttribute('data-status', 'half');
  await expect(page.getByTestId('favor-light-overwhelm')).toContainText('½');
  await expect(page.getByTestId('favor-dark-overwhelm')).toHaveAttribute('data-status', 'open');
});
