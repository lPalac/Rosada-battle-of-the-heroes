// US6 in the browser: quickstart manual check step 6 (T103).
import { expect, test } from '@playwright/test';
import { clickSquare, hook, quickSetup } from './helpers.ts';

test('Knight onto its own King → problem listed; fix → resume at Before Turn', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-sandbox-on').click();
  await page.getByTestId('confirm-yes').click();
  await expect(page.getByTestId('sandbox-badge')).toBeVisible();
  await clickSquare(page, 'g1'); // pick up the Knight
  await clickSquare(page, 'e1'); // drop it on its own King
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('problems')).toContainText('Light King shares a square');
  await page.getByTestId('problems-close').click();
  await expect(page.getByTestId('sandbox-badge')).toBeVisible();
  // Two pieces share e1 now, so move the Knight away by its id rather than by a click that could pick the King.
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-N-g' }, to: { x: 6, y: 3 } });
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('sandbox-badge')).toHaveCount(0);
  await expect(page.getByTestId('current-phase')).toHaveText('Move');
  const s = await hook<any>(page, 'state');
  const phases = s.log.filter((l: any) => l.type === 'phaseChanged').slice(-4).map((l: any) => l.data.phase);
  expect(phases).toEqual(['beforeTurn', 'beginningOfTurn', 'beforeMove', 'move']);
  expect(s.units.find((u: any) => u.id === 'L-N-g').hasBeenLed).toBe(true);
});

test('free roll in sandbox is shown but not applied', async ({ page }) => {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'forceNextRoll', 12);
  await page.getByTestId('free-roll').click();
  await expect(page.getByTestId('free-roll-result')).toContainText('Free roll: 12');
});
