// quickstart.md manual check, steps 2–5, run in the browser (T109). Steps 1 and 6 are setup.spec.ts and
// sandbox.spec.ts. Positions for steps 3–5 are arranged in sandbox through the test hook, then played with the mouse.
import { expect, test, type Page } from '@playwright/test';
import { clickSquare, hook, quickSetup, walkTo } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });

async function arrange(page: Page, actions: unknown[]): Promise<void> {
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  for (const a of actions) await hook(page, 'dispatch', a);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
}

test('step 2: Turn 1, move the hero, Lead e2–e4: no Roll button while the Peace side is up', async ({ page }) => {
  await quickSetup(page);
  await walkTo(page, 'd1');
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('roll-button')).toHaveCount(0);
  const s = await hook<any>(page, 'state');
  expect(s.units.find((u: any) => u.id === 'L-P-e').pos).toEqual(at(5, 4));
});

test('step 3: a capture gives +2, flips the token to War, and the next Lead shows the Roll button with +2', async ({ page }) => {
  await quickSetup(page);
  await arrange(page, [{ type: 'sandboxPlace', target: { unitId: 'D-P-c' }, to: at(3, 3) }]);
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'c3');
  await expect(page.getByTestId('common-light')).toHaveText('2');
  await expect(page.getByTestId('peace-treaty')).toHaveText('War');
  await clickSquare(page, 'b2'); // advance
  await page.getByTestId('end-phase').click(); // End of Turn → H2
  await expect(page.getByTestId('active-hero')).toContainText('H2');
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'b8'); // Dark Knight next to H2 (c9)
  await clickSquare(page, 'a6');
  await expect(page.getByTestId('roll-button')).toBeVisible();
  await expect(page.getByTestId('lead-preview')).toContainText('War +2');
});

test('step 4: Ram an enemy hero with a Rook: lands past the Rook, −3 health, Resilient Destiny in the log', async ({ page }) => {
  await quickSetup(page);
  await arrange(page, [
    { type: 'sandboxPlace', target: { unitId: 'L-P-a' }, to: 'graveyard' },
    { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(2, 0) },
    { type: 'sandboxPlace', target: { heroId: 'H2' }, to: at(1, 4) },
  ]);
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await clickSquare(page, 'a1');
  await clickSquare(page, 'a5');
  await expect(page.getByTestId('hero-H2-health')).toHaveText('7/10');
  const s = await hook<any>(page, 'state');
  expect(s.heroes.find((h: any) => h.id === 'H2').pos).toEqual(at(1, 6));
  await expect(page.getByTestId('log')).toContainText('Resilient Destiny');
});

test('step 5: pause in a tavern, buy a Drink, continue; no buying after leaving', async ({ page }) => {
  await quickSetup(page);
  await arrange(page, [{ type: 'sandboxSet', path: 'health', target: 'H1', value: 6 }]);
  for (const sq of ['b0', 'a0']) await walkTo(page, sq);
  await walkTo(page, '<0');
  await expect(page.getByTestId('tavern')).toBeVisible();
  await page.getByTestId('buy-drink').click();
  await expect(page.getByTestId('hero-H1-health')).toHaveText('7/10');
  await walkTo(page, '<1');
  await expect(page.getByTestId('tavern')).toHaveCount(0);
  await expect(page.getByTestId('active-movement')).toHaveText('Move 1/5');
});

test('FR-200: a refresh keeps the game; Resume saved game restores it', async ({ page }) => {
  await quickSetup(page);
  await walkTo(page, 'd1');
  await page.reload();
  await page.getByTestId('resume-saved').click();
  await expect(page.getByTestId('active-movement')).toHaveText('Move 4/5');
  const s = await hook<any>(page, 'state');
  expect(s.heroes[0].pos).toEqual(at(4, 1));
});
