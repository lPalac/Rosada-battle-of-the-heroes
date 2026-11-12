// 006 US7 in the browser: the table (B-13, B-14, B-23, B-24). Own-side camera online, one shared Royal Favor track, the
// Graveyard / Well strip moved outwards, the TTS table model, units turned.
import { expect, test, type Page } from '@playwright/test';
import { hook, pickNamed, quickSetup, viewSideOf } from './helpers.ts';

type Pt = { x: number; y: number };
type Elements = {
  track: { slots: number; light: number; dark: number };
  tracks?: unknown;
  ttsTable: boolean;
  tableTop: boolean;
  stripCorners: Pt[];
  pieceAssets: Record<string, string>;
};
const elements = (page: Page) => hook<Elements>(page, 'tableElements');
const dispatch = (page: Page, a: unknown) => hook<boolean>(page, 'dispatch', a);
const state = (page: Page) => hook<{ phase: string; activeHeroId: string; heroes: { id: string; side: string }[]; pendingDecision: { type: string; options?: unknown[] } | null }>(page, 'state');

async function settle(page: Page): Promise<void> {
  // The camera swings to a side in 0.7 s.
  await page.waitForTimeout(1200);
}

/** Ends phases (with the Cavalier's first Lead) until a hero of that side is active. */
async function toSide(page: Page, side: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s.heroes.find((h) => h.id === s.activeHeroId)?.side === side) return;
    if (s.phase === 'lead' && (await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: { x: 3, y: 3 } }))) {
      const d = (await state(page)).pendingDecision;
      if (d?.type === 'advanceSquare') await dispatch(page, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
      continue;
    }
    await dispatch(page, { type: 'endPhase' });
  }
  throw new Error(`no ${side} hero became active`);
}

test('US7-AS1 online: each player\'s camera stays on their own side over two turns, after orbiting, and after Reset camera', async ({ browser }) => {
  const players: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const page = await (await browser.newContext()).newPage();
    await page.goto('/');
    players.push(page);
  }
  const [a, b] = players;
  await a.getByTestId('play-online').click();
  await a.getByTestId('online-name').fill('Luka');
  await a.getByTestId('online-players-2').click();
  await a.getByTestId('online-create').click();
  await expect(a.getByTestId('lobby')).toBeVisible();
  const code = (await hook<{ room: { code: string } }>(a, 'online')).room.code;
  await b.goto(`/#/room/${code}`);
  await expect(b.getByTestId('lobby')).toBeVisible();
  await b.getByTestId('online-name').fill('Ana');
  await b.getByTestId('take-P2').click();
  await expect(b.getByTestId('seat-status-P2')).toHaveText('you');
  await a.getByTestId('online-start').click();
  await pickNamed(a, 'cavalier');
  await expect(b.getByTestId('pick-monk')).toBeEnabled();
  await pickNamed(b, 'monk');
  await pickNamed(b, 'scout');
  await pickNamed(a, 'magus');
  for (const p of [a, b]) await expect(p.getByTestId('phase-bar')).toBeVisible();
  const sideOf = async (p: Page) => (await hook<{ seat: string; room: { seats: { id: string; side: string }[] } }>(p, 'online'));
  const own = async (p: Page) => {
    const o = await sideOf(p);
    return o.room.seats.find((s) => s.id === o.seat)!.side;
  };
  const [sideA, sideB] = [await own(a), await own(b)];
  expect(sideA).not.toBe(sideB);
  await expect.poll(() => viewSideOf(a)).toBe(sideA);
  await expect.poll(() => viewSideOf(b)).toBe(sideB);
  // B orbits its camera; A plays on into the other side's turn: both keep their own side.
  const canvas = b.locator('#table');
  const box = (await canvas.boundingBox())!;
  await b.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
  await b.mouse.down({ button: 'right' });
  await b.mouse.move(box.x + box.width / 2 + 80, box.y + box.height * 0.9, { steps: 5 });
  await b.mouse.up({ button: 'right' });
  for (let turn = 0; turn < 2; turn++) {
    for (let i = 0; i < 12; i++) {
      const actor = (await hook<{ canAct: boolean }>(a, 'online')).canAct ? a : b;
      const s = await state(actor);
      const before = s.activeHeroId;
      if (s.phase === 'lead') {
        const st = await actor.evaluate(async () => {
          const path = '/src/rules/index.ts';
          const rules: any = await import(/* @vite-ignore */ path);
          const r = (window as any).__rosada;
          return rules.legalActions(r.state()).find((x: any) => x.type === 'announceLead') ?? null;
        });
        if (st) await dispatch(actor, st);
        const d = (await state(actor)).pendingDecision;
        if (d?.type === 'advanceSquare') await dispatch(actor, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
      } else await dispatch(actor, { type: 'endPhase' });
      await expect.poll(async () => (await state(a)).phase + (await state(a)).activeHeroId, { timeout: 10_000 }).not.toBe('');
      if ((await state(a)).activeHeroId !== before) break;
    }
    expect(await viewSideOf(a)).toBe(sideA);
    expect(await viewSideOf(b)).toBe(sideB);
  }
  await b.getByTestId('reset-camera').click();
  expect(await viewSideOf(b)).toBe(sideB);
});

test('US7-AS2, AS4 one shared track: Light 2 and Dark 1; both markers on one slot; no per-side tracks', async ({ page }) => {
  await quickSetup(page);
  const e = await elements(page);
  expect(e.tracks).toBeUndefined();
  expect(e.track).toEqual({ slots: 11, light: 0, dark: 0 });
  await dispatch(page, { type: 'setEnforcement', mode: 'sandbox' });
  for (const id of ['decimate', 'overwhelm']) await dispatch(page, { type: 'sandboxSet', path: 'favor', target: `light:${id}`, value: 'done' });
  await dispatch(page, { type: 'sandboxSet', path: 'favor', target: 'dark:decimate', value: 'done' });
  expect((await elements(page)).track).toEqual({ slots: 11, light: 2, dark: 1 });
  await dispatch(page, { type: 'sandboxSet', path: 'favor', target: 'dark:overwhelm', value: 'done' });
  expect((await elements(page)).track).toEqual({ slots: 11, light: 2, dark: 2 });
  await page.screenshot({ path: 'test-results/fixes-table-track.png' });
});

test('US7-AS5 the Royal Favor menu has the shared 1…11 row with both markers; the side lists stay', async ({ page }) => {
  await quickSetup(page);
  await dispatch(page, { type: 'setEnforcement', mode: 'sandbox' });
  for (const id of ['decimate', 'overwhelm']) await dispatch(page, { type: 'sandboxSet', path: 'favor', target: `light:${id}`, value: 'done' });
  await dispatch(page, { type: 'sandboxSet', path: 'favor', target: 'dark:decimate', value: 'done' });
  await page.keyboard.press('a');
  const row = page.getByTestId('tracker-shared');
  await expect(row).toHaveAttribute('data-light', '2');
  await expect(row).toHaveAttribute('data-dark', '1');
  await expect(row.locator('.slot')).toHaveCount(11);
  await expect(page.getByTestId('shared-marker-light')).toHaveCount(1);
  await expect(page.getByTestId('shared-marker-dark')).toHaveCount(1);
  await expect(row).toContainText('Hero Unit');
  await expect(page.getByTestId('tracker-light')).toBeVisible();
  await expect(page.getByTestId('tracker-dark')).toBeVisible();
  await expect(page.getByTestId('favor-light-decimate')).toHaveAttribute('data-status', 'done');
});

test.describe('1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('US7-AS3 the Graveyard / Well strip is fully visible at the default camera from both sides', async ({ page }) => {
    await quickSetup(page);
    for (const side of ['light', 'dark']) {
      await toSide(page, side);
      await expect.poll(() => viewSideOf(page)).toBe(side);
      await settle(page);
      const corners = (await elements(page)).stripCorners;
      for (const c of corners) {
        expect(c.x, `${side} x`).toBeGreaterThanOrEqual(0);
        expect(c.x, `${side} x`).toBeLessThanOrEqual(1366);
        expect(c.y, `${side} y`).toBeGreaterThanOrEqual(0);
        expect(c.y, `${side} y`).toBeLessThanOrEqual(768);
      }
      await page.screenshot({ path: `test-results/fixes-table-1366-${side}.png` });
    }
  });
});

test.describe('1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('US7-AS6 the TTS table model is shown once loaded', async ({ page }) => {
    await quickSetup(page);
    await expect.poll(async () => (await elements(page)).ttsTable, { timeout: 30_000 }).toBe(true);
    await page.screenshot({ path: 'test-results/fixes-table-1920.png' });
  });
});

test('US7-AS6 with ?placeholders the drawn slab stays', async ({ page }) => {
  await page.goto('/?generic&placeholders');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const r of ['short', 'short', 'long', 'long']) await page.getByTestId(`pick-${r}`).click();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await page.waitForTimeout(2000);
  const e = await elements(page);
  expect(e.ttsTable).toBe(false);
  expect(e.tableTop).toBe(true);
});

test('US7-AS7 every unit model is turned 180° inside its holder, for both sides', async ({ page }) => {
  await quickSetup(page);
  await expect.poll(async () => Object.values((await elements(page)).pieceAssets).filter((k) => k === 'tts').length, { timeout: 60_000 }).toBe(32);
  const ids = Object.keys((await elements(page)).pieceAssets);
  expect(ids.some((id) => id.startsWith('L-')) && ids.some((id) => id.startsWith('D-'))).toBe(true);
  for (const id of ids) {
    const f = await hook<{ holder: number; model: number | null } | null>(page, 'unitFacing', id);
    expect(f, id).not.toBeNull();
    expect(Math.abs(f!.model ?? 0), id).toBe(180);
  }
});
