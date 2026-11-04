// US7 in the browser: one full turn with the mouse; highlights, the Roll button and the result (T060).
import { expect, test } from '@playwright/test';
import { clickSquare, hook, quickSetup } from './helpers.ts';

test('US7-AS1 selecting a unit highlights its legal destinations', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('end-phase').click(); // Move → Before Lead
  await page.getByTestId('end-phase').click(); // → Lead
  await expect(page.getByTestId('current-phase')).toHaveText('Lead');
  await clickSquare(page, 'b1'); // Knight next to H1 (c0)
  const hl = await hook<{ kind: string; square: string }[]>(page, 'highlighted');
  expect(hl.map((h) => h.square).sort()).toEqual(['a3', 'c3']);
});

test('US7-AS2 the Roll button throws the d20 and shows face, modifiers, total and result', async ({ page }) => {
  await quickSetup(page);
  // Reach War: a first Destiny gain flips the Peace Treaty. Set up by hand in sandbox, then resume.
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'peaceTreaty', value: 'war' });
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'c3');
  await expect(page.getByTestId('lead-preview')).toContainText('War +2');
  await expect(page.getByTestId('lead-preview')).toContainText('≥ 6');
  await hook(page, 'forceNextRoll', 3);
  await page.getByTestId('roll-button').click();
  // A 3 + War 2 = 5 fails: unit stays, Light gains 1 D.
  await expect(page.getByTestId('common-light')).toHaveText('1');
  const rolled = await hook<any>(page, 'state').then((s: any) => s.log.filter((l: any) => l.type === 'rolled').pop().data);
  expect(rolled).toMatchObject({ value: 3, total: 5, success: false });
  await expect(page.getByTestId('log')).toContainText('Roll 3, total 5: fail');
});

test('US7-AS3 active hero, phase, health, Movement and Range are visible without menus', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('active-hero')).toContainText('H1');
  await expect(page.getByTestId('current-phase')).toHaveText('Move');
  await expect(page.getByTestId('hero-H1-health')).toHaveText('Health 10/10');
  await expect(page.getByTestId('active-movement')).toHaveText('Movement 5/5');
  await expect(page.getByTestId('active-range')).toHaveText('Range 1');
  await clickSquare(page, 'd1');
  await expect(page.getByTestId('active-movement')).toHaveText('Movement 4/5');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/default-camera.png' });
});

test('a full turn with the mouse only: Move, Lead, advance, hand-off', async ({ page }) => {
  await quickSetup(page);
  await clickSquare(page, 'd1');
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'd2');
  await clickSquare(page, 'd4'); // Peace: no roll
  await expect(page.getByTestId('help')).toContainText('Choose where the hero ends');
  await clickSquare(page, 'c3');
  await page.getByTestId('end-phase').click(); // End of Turn (Hero Retreat offered) → H2
  await expect(page.getByTestId('active-hero')).toContainText('H2');
  const s = await hook<any>(page, 'state');
  expect(s.units.find((u: any) => u.id === 'L-P-d').pos).toEqual({ x: 4, y: 4 });
  expect(s.heroes[0].pos).toEqual({ x: 3, y: 3 });
});
