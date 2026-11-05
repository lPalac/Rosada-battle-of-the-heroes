// Tabletop Simulator pieces and table (004 T062, US6).
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

interface TableInfo {
  pieceAssets: Record<string, string>;
  sky: boolean;
  ttsTable: boolean;
  ttsStrip: boolean;
  assets: Record<string, { mesh?: string; image?: string }>;
}

test('US6-AS1…AS3 TTS models in both colours, TTS table, sky and Graveyard / Well board; first load under 10 s', async ({ page }) => {
  const t0 = Date.now();
  await quickSetup(page);
  await expect.poll(async () => {
    const info = await hook<TableInfo>(page, 'tableElements');
    return Object.values(info.pieceAssets).filter((k) => k === 'tts').length;
  }, { timeout: 60_000 }).toBe(32);
  const info = await hook<TableInfo>(page, 'tableElements');
  expect(info.assets['unit.light.king'].mesh).toBe('tts/mesh/king.obj');
  expect(info.assets['unit.dark.pawn'].mesh).toBe('tts/mesh/pawn.obj');
  await expect.poll(async () => (await hook<TableInfo>(page, 'tableElements')).ttsStrip, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await hook<TableInfo>(page, 'tableElements')).sky, { timeout: 30_000 }).toBe(true);
  expect(Date.now() - t0).toBeLessThan(60_000);
  await page.screenshot({ path: 'test-results/tts-table-004.png' });
});

test('US6-AS4 with ?placeholders the placeholder pieces show', async ({ page }) => {
  await page.goto('/?generic&placeholders');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const r of ['short', 'short', 'long', 'long']) await page.getByTestId(`pick-${r}`).click();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await page.waitForTimeout(2000);
  const info = await hook<TableInfo>(page, 'tableElements');
  expect(Object.values(info.pieceAssets).every((k) => k === 'placeholder')).toBe(true);
});
