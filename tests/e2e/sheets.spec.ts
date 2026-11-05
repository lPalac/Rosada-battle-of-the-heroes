// Hero sheets like the Tabletop Simulator version and the ability panel (004 T056, US5).
import { expect, test } from '@playwright/test';
import { hook } from './helpers.ts';

interface SheetInfo { heroId: string; name: string; sheetKey: string; healthMarker: number; pool: number; uses: Record<string, number>; badges: string[] }

async function namedSetup(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ['cavalier', 'scout', 'magus', 'monk']) await page.getByTestId(`pick-${id}`).click();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
}

test('US5-AS1…AS5 TTS sheet images with health, pool and uses; US5-AS6 the ability panel', async ({ page }) => {
  await namedSetup(page);
  const sheets = await hook<SheetInfo[]>(page, 'tableElements').then((x: unknown) => (x as { sheets: SheetInfo[] }).sheets);
  const byKey = Object.fromEntries(sheets.map((s) => [s.sheetKey, s]));
  expect(Object.keys(byKey).sort()).toEqual(['sheet.cavalier', 'sheet.magus', 'sheet.monk', 'sheet.scout']);
  expect(byKey['sheet.cavalier'].healthMarker).toBe(10);
  expect(byKey['sheet.magus'].pool).toBe(3);
  expect(byKey['sheet.monk'].uses['monk.preaching']).toBe(2);
  // Ability panel: the Cavalier rests in Before Move with Demoralise usable.
  await expect(page.getByTestId('ability-panel')).toContainText('Cavalier');
  await expect(page.getByTestId('ability-cavalier.demoralise')).toContainText('Before Move');
  await page.getByTestId('use-cavalier.demoralise').click();
  await expect.poll(async () => (await hook<{ effects: { kind: string }[] }>(page, 'state')).effects.map((e) => e.kind)).toContain('demoralise');
  await page.screenshot({ path: 'test-results/sheets-004.png' });
});
