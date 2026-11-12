// Hero sheets like the Tabletop Simulator version and the ability panel (004 T056, US5).
import { expect, test } from '@playwright/test';
import { hook, openAbilities, pickNamed } from './helpers.ts';

interface SheetInfo { heroId: string; name: string; sheetKey: string; healthMarker: number; pool: number; uses: Record<string, number>; crystals: Record<string, number>; badges: string[] }

async function namedSetup(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ['cavalier', 'scout', 'magus', 'monk']) await pickNamed(page, id);
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
  await openAbilities(page);
  await expect(page.getByTestId('ability-panel')).toContainText('Cavalier');
  await expect(page.getByTestId('ability-cavalier.demoralise')).toContainText('Before Move');
  await page.getByTestId('use-cavalier.demoralise').click();
  await expect.poll(async () => (await hook<{ effects: { kind: string }[] }>(page, 'state')).effects.map((e) => e.kind)).toContain('demoralise');
  // 006 US1-AS7: the use cost 1 D, the row says so, and the sheet shows a crystal on the spent symbol.
  await expect(page.getByTestId('ability-cavalier.demoralise-cost')).toHaveText('1 D · 0 of 1 left');
  const after = await hook<{ sheets: SheetInfo[] }>(page, 'tableElements').then((x) => Object.fromEntries(x.sheets.map((s) => [s.sheetKey, s])));
  expect(after['sheet.cavalier'].pool).toBe(2);
  expect(after['sheet.cavalier'].crystals['cavalier.demoralise']).toBe(1);
  expect(after['sheet.magus'].crystals['magus.flamingBolt']).toBe(0);
  // The mark shows on the table beside the Cavalier.
  await expect.poll(async () => (await hook<{ effectTokens: { kind: string }[] }>(page, 'tableElements')).effectTokens.map((e) => e.kind)).toContain('demoralise');
  await page.screenshot({ path: 'test-results/sheets-004.png' });
});
