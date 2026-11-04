// 003 US7: the table like the Tabletop Simulator version (T040).
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

type Elements = {
  tableTop: boolean; roomFloor: boolean; boardBorder: boolean; strip: boolean;
  sheets: { heroId: string; name: string; portrait: string | null; portraitLoaded: boolean; healthMarker: number; pool: number; destiny: string | null; epicColumn: number | null; generation: number | null }[];
  tracks: { side: string; slots: number; tokens: number }[];
  medallions: { heroId: string; number: number; active: boolean }[];
  assets: Record<string, { image?: string }>;
};
const elements = (page: import('@playwright/test').Page) => hook<Elements>(page, 'tableElements');

test('US7-AS1…AS4 room, table, border, strip, sheets, tracks and medallions', async ({ page }) => {
  await quickSetup(page);
  const e = await elements(page);
  expect([e.tableTop, e.roomFloor, e.boardBorder, e.strip]).toEqual([true, true, true, true]);
  const s = await hook<any>(page, 'state');
  expect(e.sheets).toHaveLength(4);
  for (const sheet of e.sheets) {
    const h = s.heroes.find((x: any) => x.id === sheet.heroId);
    expect(sheet.name).toContain(sheet.heroId);
    expect(sheet.healthMarker).toBe(h.health);
    expect(sheet.pool).toBe(h.pool);
  }
  await expect.poll(async () => (await elements(page)).sheets.every((x) => x.portraitLoaded)).toBe(true);
  expect(e.tracks.map((t) => [t.side, t.slots, t.tokens])).toEqual([['light', 16, 0], ['dark', 16, 0]]);
  expect(e.medallions.map((m) => [m.number, m.active])).toEqual([[1, true], [2, false], [3, false], [4, false]]);
  // US7-AS3: a completed Royal Favor appears on the track.
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'favor', target: 'dark:decimate', value: 'done' });
  expect((await elements(page)).tracks.find((t) => t.side === 'dark')!.tokens).toBe(1);
});

test('US7-AS5, AS6 Epic art column on the sheet; every image comes from assets.json', async ({ page }) => {
  await quickSetup(page);
  const e = await elements(page);
  const short = e.sheets.find((x) => x.heroId === 'H1')!;
  expect(short.portrait).toBe(encodeURI(`/${e.assets['portrait.short'].image}`));
  expect(e.sheets.find((x) => x.heroId === 'H3')!.portrait).toBe(encodeURI(`/${e.assets['portrait.long'].image}`));
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'stage', value: 'epic' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'destiny', target: 'H1', value: 'dominant' });
  const after = (await elements(page)).sheets.find((x) => x.heroId === 'H1')!;
  expect([after.destiny, after.epicColumn, after.generation]).toEqual(['dominant', 2, 1]);
});

test('US7-AS7 default view: board and the active sheet visible; screenshot', async ({ page }) => {
  await quickSetup(page);
  // Board corners and the active hero's sheet project inside the canvas.
  for (const sq of ['a1', 'h1', 'a8', 'h8']) {
    const p = await hook<{ x: number; y: number }>(page, 'screenOf', sq);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(1280);
    expect(p.y).toBeLessThan(800);
  }
  const sheet = await page.evaluate(() => (window as any).__rosada.sheetScreen('H1'));
  expect(sheet.y).toBeLessThan(800);
  expect(sheet.y).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/table-003.png' });
});
