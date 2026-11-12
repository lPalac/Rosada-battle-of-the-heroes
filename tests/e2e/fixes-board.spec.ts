// 006 US4 in the browser: targets on the board (B-02), reach, plan and walk (B-16), pick confirm (B-12), Space (B-15),
// the own-King warning (FR-024), blocked Lead squares and ability reasons on hover (FR-025, FR-026).
import { expect, test, type Page } from '@playwright/test';
import { clickSquare, hook, openAbilities, pickNamed, planOf, quickSetup } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });
type State = {
  phase: string; activeHeroId: string; pendingDecision: { type: string; options?: unknown[] } | null;
  heroes: { id: string; pos: { x: number; y: number }; health: number; pool: number }[];
  units: { id: string; pos: { x: number; y: number } }[]; turn: { lead: unknown; movementLeft: number };
  log: { type: string; data: Record<string, unknown> }[];
};
const state = (page: Page) => hook<State>(page, 'state');
const dispatch = (page: Page, a: unknown) => hook<boolean>(page, 'dispatch', a);
const highlighted = (page: Page) => hook<{ kind: string; square: string }[]>(page, 'highlighted');
const h1 = async (page: Page) => (await state(page)).heroes.find((h) => h.id === 'H1')!;

/** A real mouse click on a board square: since 006 Phase 8 the ability panel is docked at the side (B-17). */
const clickBoard = clickSquare;

async function namedSetup(page: Page, ids = ['cavalier', 'scout', 'magus', 'monk']): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ids) await pickNamed(page, id);
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
  await openAbilities(page);
}

async function toPhase(page: Page, phase: string): Promise<void> {
  for (let i = 0; i < 8 && (await state(page)).phase !== phase; i++) await dispatch(page, { type: 'endPhase' });
  expect((await state(page)).phase).toBe(phase);
}

async function arrange(page: Page, actions: unknown[]): Promise<void> {
  await dispatch(page, { type: 'setEnforcement', mode: 'sandbox' });
  for (const a of actions) await dispatch(page, a);
  await dispatch(page, { type: 'setEnforcement', mode: 'rules', restart: true });
}

/** The Cavalier (c0) Leads the Knight b1 → c3 (Peace: no roll) and answers the advance square: After Lead. */
async function cavalierAfterLead(page: Page): Promise<void> {
  await namedSetup(page);
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
  const d = (await state(page)).pendingDecision;
  if (d?.type === 'advanceSquare') await dispatch(page, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
  await expect(page.getByTestId('current-phase')).toHaveText('After Lead');
}

test('US4-AS1 Warhorse: the squares light up on the board, no list opens; a click moves the hero; Esc cancels', async ({ page }) => {
  await cavalierAfterLead(page);
  const before = await h1(page);
  await page.getByTestId('use-cavalier.warhorse').click();
  await expect(page.getByTestId('target-help')).toContainText('Warhorse');
  await expect(page.getByTestId('dialog')).toHaveCount(0);
  const targets = (await highlighted(page)).filter((h) => h.kind === 'target');
  expect(targets.length).toBeGreaterThan(1);
  // Esc leaves the ability unused.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('target-help')).toHaveCount(0);
  await expect(page.getByTestId('use-cavalier.warhorse')).toBeVisible();
  // Again, and pick a square on the board.
  await page.getByTestId('use-cavalier.warhorse').click();
  await clickBoard(page, targets[0].square);
  await expect.poll(async () => (await h1(page)).pos).not.toEqual(before.pos);
  await expect(page.getByTestId('target-help')).toHaveCount(0);
});

test('US4-AS2 a two-part target: the units first, then the squares for the chosen unit (Tight Formation)', async ({ page }) => {
  await namedSetup(page);
  await toPhase(page, 'lead');
  await page.getByTestId('use-cavalier.tightFormation').click();
  const units = (await highlighted(page)).filter((h) => h.kind === 'target').map((h) => h.square);
  expect(units).toContain('b1');
  await clickBoard(page, 'b1');
  const squares = (await highlighted(page)).filter((h) => h.kind === 'target').map((h) => h.square).sort();
  expect(squares).toContain('c3');
  expect(squares).not.toContain('b1');
  await clickBoard(page, 'c3');
  await expect.poll(async () => (await state(page)).units.find((u) => u.id === 'L-N-b')?.pos).toEqual(at(3, 3));
});

test('US4-AS3…AS6, AS8 reach, plan, grow, walk step by step; Esc clears a plan', async ({ page }) => {
  await quickSetup(page);
  const kinds = await highlighted(page);
  expect(kinds.filter((h) => h.kind === 'move' || h.kind === 'pass').length).toBeGreaterThan(8);
  await clickSquare(page, 'c2');
  expect(await planOf(page)).toEqual({ path: ['c1', 'c2'], left: 3 });
  await expect(page.getByTestId('help')).toContainText('Movement left after this path: 3');
  expect((await highlighted(page)).filter((h) => h.kind === 'path').map((h) => h.square)).toEqual(['c1', 'c2']);
  await clickSquare(page, 'c4');
  expect(await planOf(page)).toEqual({ path: ['c1', 'c2', 'c3', 'c4'], left: 1 });
  // Esc clears; nothing moved.
  await page.keyboard.press('Escape');
  expect(await planOf(page)).toBeNull();
  expect((await h1(page)).pos).toEqual(at(3, 0));
  // Plan again and walk: one moveStep per square; Undo takes back one step.
  await clickSquare(page, 'c3');
  await clickSquare(page, 'c3');
  await expect.poll(async () => (await h1(page)).pos).toEqual(at(3, 3));
  const steps = (await hook<{ type: string }[]>(page, 'actions')).filter((a) => a.type === 'moveStep');
  expect(steps).toHaveLength(3);
  await page.getByTestId('undo').click();
  await expect.poll(async () => (await h1(page)).pos).toEqual(at(3, 2));
});

test('US4-AS7 a double click on a reachable square walks there by the shortest path', async ({ page }) => {
  await quickSetup(page);
  const p = await hook<{ x: number; y: number }>(page, 'screenOf', 'e2');
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(async () => (await h1(page)).pos).toEqual(at(5, 2));
  expect((await state(page)).turn.movementLeft).toBe(3);
});

test('US4-AS9 a walk stops on the step that wounds the hero (a Bear Trap)', async ({ page }) => {
  await quickSetup(page);
  // A Dark Bear Trap on d2, put on the board through the test hook.
  await page.evaluate(() => {
    const r = (window as any).__rosada;
    const s = structuredClone(r.state());
    s.effects.push({ id: s.nextEffectId++, kind: 'bearTrap', source: { abilityId: 'scout.bearTraps', heroId: 'H2' }, target: { square: { x: 4, y: 2 } }, expires: { at: 'removed' }, data: { penalty: -3, wounds: 4 } });
    r.startPosition(s);
  });
  await clickSquare(page, 'd2');
  await clickSquare(page, 'd4');
  const plan = await planOf(page);
  expect(plan?.path).toContain('d2');
  await clickSquare(page, 'd4');
  await expect.poll(() => hook<boolean>(page, 'walking')).toBe(false);
  const h = await h1(page);
  expect(h.pos).toEqual(at(4, 2));
  expect(h.health).toBe(6);
});

test('US4-AS10 a hero pick needs a second click on the same card; another card moves the highlight', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  await page.getByTestId('pick-cavalier').click();
  await expect(page.getByTestId('pick-cavalier')).toHaveAttribute('data-pending', 'true');
  await expect(page.getByTestId('pick-confirm-hint')).toHaveText('Click again to confirm');
  await page.getByTestId('pick-scout').click();
  await expect(page.getByTestId('pick-scout')).toHaveAttribute('data-pending', 'true');
  await expect(page.getByTestId('pick-cavalier')).not.toHaveAttribute('data-pending', 'true');
  await page.getByTestId('pick-scout').click();
  await expect(page.getByTestId('pick-scout')).toBeDisabled(); // picked
});

test('US4-AS11 Space ends the phase; not while a dialog is open, not while disabled, once while held', async ({ page }) => {
  await quickSetup(page);
  await expect(page.getByTestId('current-phase')).toHaveText('Move');
  await page.getByTestId('open-settings').click();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('current-phase')).toHaveText('Move');
  await page.getByTestId('settings-resume').click();
  // Held down: the phase ends once.
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(page.getByTestId('current-phase')).not.toHaveText('Move');
  await toPhase(page, 'lead');
  // A possible Lead must be made: End phase is disabled, so Space does nothing.
  await expect(page.getByTestId('end-phase')).toBeDisabled();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('current-phase')).toHaveText('Lead');
});

test('US4-AS12 an ability that would put the own King in check: the warning; Undo uses nothing, Continue uses it', async ({ page }) => {
  await namedSetup(page, ['magus', 'scout', 'cavalier', 'monk']);
  // The Dark Rook on e6 and a Dark Pawn on e4; the Light Pawn e2 shields the Light King e1; the Magus on f3.
  await arrange(page, [
    { type: 'sandboxPlace', target: { unitId: 'D-P-e' }, to: at(5, 4) },
    { type: 'sandboxPlace', target: { unitId: 'D-R-a' }, to: at(5, 6) },
    { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(6, 3) },
  ]);
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-g', to: at(8, 3) });
  await expect(page.getByTestId('current-phase')).toHaveText('After Lead');
  const pool = (await h1(page)).pool;
  await page.getByTestId('use-magus.soulsClash').click();
  await expect(page.getByTestId('own-check-warning')).toContainText('This will put your King in check');
  await page.getByTestId('own-check-undo').click();
  await expect(page.getByTestId('own-check-warning')).toHaveCount(0);
  expect((await state(page)).units.some((u) => u.id === 'L-P-e')).toBe(true);
  expect((await h1(page)).pool).toBe(pool);
  await page.getByTestId('use-magus.soulsClash').click();
  await page.getByTestId('own-check-continue').click();
  await expect.poll(async () => (await state(page)).units.some((u) => u.id === 'L-P-e')).toBe(false);
  const s = await state(page);
  expect(s.log.some((l) => l.type === 'check' && l.data.side === 'light')).toBe(true);
});

test('US4-AS13 a square only check forbids: shown as blocked; hover and click say why; no Lead', async ({ page }) => {
  await quickSetup(page);
  // The Dark Bishop on b4 pins the Light Pawn d2 to the King e1; the hero stands on d1.
  await arrange(page, [
    { type: 'sandboxPlace', target: { unitId: 'D-B-c' }, to: at(2, 4) },
    { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(4, 1) },
  ]);
  await toPhase(page, 'lead');
  await clickSquare(page, 'd2');
  const blocked = (await highlighted(page)).filter((h) => h.kind === 'blocked').map((h) => h.square);
  expect(blocked).toContain('d3');
  const p = await hook<{ x: number; y: number }>(page, 'screenOf', 'd3');
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('board-tooltip')).toHaveText('That would place your King in check');
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('board-tooltip')).toBeHidden();
  await clickSquare(page, 'd3');
  await expect(page.getByTestId('board-tooltip')).toHaveText('That would place your King in check');
  expect((await state(page)).turn.lead).toBeNull();
});

test('US4-AS14 an ability row without a Use button gives its reason on hover', async ({ page }) => {
  await namedSetup(page);
  await expect(page.getByTestId('current-phase')).toHaveText('Before Move');
  await expect(page.getByTestId('use-cavalier.warhorse')).toHaveCount(0);
  const status = page.getByTestId('ability-cavalier.warhorse-status');
  await expect(status).toBeHidden();
  await page.getByTestId('ability-cavalier.warhorse').hover();
  await expect(status).toBeVisible();
  await expect(status).toHaveText('Not in this phase');
  await page.screenshot({ path: 'test-results/fixes-board-reason.png' });
});
