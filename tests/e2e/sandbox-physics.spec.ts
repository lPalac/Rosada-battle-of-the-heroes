// 002 US1/US3 in the browser: drag pieces in sandbox with the mouse; resume from a physical position.
import { expect, test, type Page } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

async function enterSandbox(page: Page): Promise<void> {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await expect.poll(() => hook<boolean>(page, 'physicsReady'), { timeout: 20_000 }).toBe(true);
}

/** Press on a piece, move the mouse in steps to a square, optionally release. */
async function drag(page: Page, id: string, square: string, release = true): Promise<void> {
  const from = await hook<{ x: number; y: number }>(page, 'unitScreenOf', id);
  const to = await hook<{ x: number; y: number }>(page, 'screenOf', square);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 15, from.y + ((to.y - from.y) * i) / 15);
    await page.waitForTimeout(16);
  }
  if (release) await page.mouse.up();
}

const unitPos = (page: Page, id: string) =>
  hook<any>(page, 'state').then((s: any) => (s.units.find((u: any) => u.id === id) ?? s.graveyard.find((u: any) => u.id === id))?.pos);

test('US1-AS1 pressing on a piece and dragging lifts it and it follows the mouse', async ({ page }) => {
  await enterSandbox(page);
  await drag(page, 'L-N-g', 'f4', false);
  const p = await hook<{ x: number; y: number; z: number }>(page, 'pieceWorld', 'L-N-g');
  expect(p.y).toBeGreaterThan(0.1);
  const target = await hook<{ x: number; z: number }>(page, 'squareWorld', 'f4');
  expect(Math.hypot(p.x - target.x, p.z - target.z)).toBeLessThan(0.6);
  await page.mouse.up();
});

test('US1-AS6 a piece released over f3 rests there and the state and log record it', async ({ page }) => {
  await enterSandbox(page);
  await drag(page, 'L-N-g', 'f3');
  await expect.poll(() => unitPos(page, 'L-N-g'), { timeout: 5000 }).toEqual({ x: 6, y: 3 });
  await expect(page.getByTestId('log')).toContainText('Sandbox: place L-N-g');
});

test('US1-AS5 in rules mode pieces stand on their squares exactly as the state says', async ({ page }) => {
  await quickSetup(page);
  expect(await hook<boolean>(page, 'physicsReady')).toBe(false);
  const off = await hook<number>(page, 'maxPieceOffset');
  expect(off).toBeLessThan(0.01);
});

test('US3-AS1 a knocked-over piece is stood up on the square under its centre when rules resume', async ({ page }) => {
  await enterSandbox(page);
  await drag(page, 'L-R-a', 'h3'); // carried low, through the pawn row: pawns get knocked about
  await expect.poll(() => unitPos(page, 'L-R-a'), { timeout: 5000 }).toEqual({ x: 8, y: 3 });
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('sandbox-badge')).toHaveCount(0);
  expect(await hook<number>(page, 'maxPieceOffset')).toBeLessThan(0.01);
  expect(await hook<number>(page, 'maxPieceTilt')).toBeLessThan(1);
});

test('US3-AS6 a unit off the table waits at the rim, can go to the Graveyard, then rules resume', async ({ page }) => {
  await enterSandbox(page);
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'L-B-c' }, to: { x: 14, y: 4 } });
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('problems')).toContainText('L-B-c is not on the Battlefield or in a Graveyard');
  await page.getByTestId('problems-close').click();
  await expect.poll(() => hook<boolean>(page, 'physicsReady'), { timeout: 20_000 }).toBe(true);
  // The rim near (14, 4) is under the sandbox panel on screen, so the pointer events go straight to the canvas
  // (still through the real picking and carry code).
  await page.evaluate(async () => {
    const r = (window as any).__rosada;
    const from = r.unitScreenOf('L-B-c');
    const to = r.graveyardScreen('light');
    const cv = document.getElementById('table')!;
    const fire = (type: string, x: number, y: number) =>
      cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, pointerId: 1 }));
    fire('pointerdown', from.x, from.y);
    for (let i = 1; i <= 30; i++) {
      fire('pointermove', from.x + ((to.x - from.x) * i) / 30, from.y + ((to.y - from.y) * i) / 30);
      await new Promise((res) => setTimeout(res, 16));
    }
    fire('pointerup', to.x, to.y);
  });
  await expect.poll(() => hook<any>(page, 'state').then((s: any) => s.graveyard.map((u: any) => u.id)), { timeout: 5000 }).toContain('L-B-c');
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('sandbox-badge')).toHaveCount(0);
});
