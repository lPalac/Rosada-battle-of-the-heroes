// 002 US2 in the browser: bigger squares, two units side by side, each separately clickable.
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

const SQUARE_001 = 1;

test('US2-AS1 squares are at least 20% wider than in 001 and two units stand side by side', async ({ page }) => {
  await quickSetup(page);
  expect(await hook<number>(page, 'squareSize')).toBeGreaterThanOrEqual(SQUARE_001 * 1.2);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-P-c' }, to: { x: 4, y: 3 } });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-P-d' }, to: { x: 4, y: 3 } });
  await page.waitForTimeout(800);
  const a = await hook<{ x: number; y: number }>(page, 'unitScreenOf', 'L-P-c');
  const b = await hook<{ x: number; y: number }>(page, 'unitScreenOf', 'L-P-d');
  // Not on top of each other: apart by a good part of a square at the current zoom (003 moved the camera back).
  const c = await hook<{ x: number; y: number }>(page, 'screenOf', 'c3');
  const e = await hook<{ x: number; y: number }>(page, 'screenOf', 'e3');
  const squarePx = Math.hypot(c.x - e.x, c.y - e.y) / 2;
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.3 * squarePx);
  await page.screenshot({ path: 'test-results/shared-square.png' });
});

test('US2-AS9 each of two units on one square can be selected with the mouse', async ({ page }) => {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  // H1 (c0) has Range 1, so stack two Light pawns on d1 after moving the Queen away.
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-Q-d' }, to: { x: 4, y: 4 } });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-P-c' }, to: { x: 4, y: 1 } });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-P-d' }, to: { x: 4, y: 1 } });
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await expect(page.getByTestId('current-phase')).toHaveText('Lead');
  await page.waitForTimeout(800);
  for (const id of ['L-P-c', 'L-P-d']) {
    const p = await hook<{ x: number; y: number }>(page, 'unitScreenOf', id);
    await page.mouse.click(p.x, p.y);
    expect(await hook<string | null>(page, 'selected')).toBe(id);
  }
});
