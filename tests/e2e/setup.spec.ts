// US1 through the UI: 4-player Draft, a non-default turn order and Bishop for Light, start the game (T059).
import { expect, test } from '@playwright/test';
import { hook } from './helpers.ts';

test('4-player Draft setup reaches the table with the chosen turn order and squares', async ({ page }) => {
  await page.goto('/?generic');
  for (let i = 1; i <= 4; i++) await page.getByTestId(`player-name-${i}`).fill(`P${i}name`);
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  // Draft order: Light, Dark, Dark, Light.
  await expect(page.getByRole('heading', { name: 'Light picks' })).toBeVisible();
  await page.getByTestId('pick-short').click();
  await expect(page.getByRole('heading', { name: 'Dark picks' })).toBeVisible();
  await page.getByTestId('pick-long').click();
  await page.getByTestId('pick-short').click();
  await expect(page.getByRole('heading', { name: 'Light picks' })).toBeVisible();
  await page.getByTestId('pick-long').click();
  // Light: its 2nd pick (Long, Player 3) plays turn 1 and starts behind the c-file Bishop.
  await page.getByTestId('first-light-1').check();
  await page.getByTestId('cfile-light-1').check();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  const summary = page.getByTestId('setup-summary');
  await expect(summary).toContainText('Turn 1: Light Long range (P3name) on c0');
  await expect(summary).toContainText('Turn 3: Light Short range (P1name) on f0');
  await expect(summary).toContainText('Turn 2: Dark Long range (P2name) on c9');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('active-hero')).toContainText('H1 (Light, Long range)');
  await expect(page.getByTestId('current-phase')).toHaveText('Move');
  const heroes = await hook<{ id: string; pos: { x: number; y: number } }[]>(page, 'state').then((s: any) =>
    s.heroes.map((h: any) => ({ id: h.id, rangeType: h.rangeType, pos: h.pos })));
  expect(heroes).toEqual([
    { id: 'H1', rangeType: 'long', pos: { x: 3, y: 0 } },
    { id: 'H2', rangeType: 'long', pos: { x: 3, y: 9 } },
    { id: 'H3', rangeType: 'short', pos: { x: 6, y: 0 } },
    { id: 'H4', rangeType: 'short', pos: { x: 6, y: 9 } },
  ]);
});
