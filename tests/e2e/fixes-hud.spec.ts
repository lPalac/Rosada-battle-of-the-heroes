// 006 US6 in the browser: a readable HUD (B-17 … B-22, B-08, B-05). Screens at 1920×1080 and 1366×768.
import { expect, test, type Page } from '@playwright/test';
import { boardRectOf, flashesOf, hook, panelRectsOf, pickNamed, viewSideOf, type Rect } from './helpers.ts';

type State = {
  phase: string; activeHeroId: string; status: string;
  heroes: { id: string; side: string; health: number; pool: number; definitionId?: string }[];
  units: { id: string; type: string; side: string; pos: { x: number; y: number } }[];
};
const state = (page: Page) => hook<State>(page, 'state');
const dispatch = (page: Page, a: unknown) => hook<boolean>(page, 'dispatch', a);
const at = (x: number, y: number) => ({ x, y });

const SIZES = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }];

async function namedSetup(page: Page, ids = ['cavalier', 'scout', 'magus', 'monk']): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ids) await pickNamed(page, id);
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
}

async function arrange(page: Page, actions: unknown[]): Promise<void> {
  await dispatch(page, { type: 'setEnforcement', mode: 'sandbox' });
  for (const a of actions) await dispatch(page, a);
  await dispatch(page, { type: 'setEnforcement', mode: 'rules', restart: true });
}

/** Ends phases until a hero of that side is active. */
async function toSide(page: Page, side: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s.heroes.find((h) => h.id === s.activeHeroId)?.side === side) return;
    // The Cavalier's first Lead: the Knight b1 to c3 (Peace: no roll), then the advance square if asked.
    if (s.phase === 'lead' && (await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) }))) {
      const d = (await hook<{ pendingDecision: { type: string; options?: unknown[] } | null }>(page, 'state')).pendingDecision;
      if (d?.type === 'advanceSquare') await dispatch(page, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
      continue;
    }
    await dispatch(page, { type: 'endPhase' });
  }
  throw new Error(`no ${side} hero became active`);
}

/** Points spread over the playing area (bilinear between its screen corners), including its edges. */
function boardPoints(c: { x: number; y: number }[], n = 24): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const u = i / n;
      const v = j / n;
      const top = { x: c[0].x + (c[1].x - c[0].x) * u, y: c[0].y + (c[1].y - c[0].y) * u };
      const bottom = { x: c[3].x + (c[2].x - c[3].x) * u, y: c[3].y + (c[2].y - c[3].y) * u };
      out.push({ x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v });
    }
  }
  return out;
}

async function expectBoardClear(page: Page, label: string): Promise<void> {
  // The camera swings to the active side in 0.7 s; wait until it stands still.
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await boardRectOf(page));
    const still = now === last;
    last = now;
    return still;
  }, { intervals: [300], timeout: 20_000 }).toBe(true);
  const corners = await boardRectOf(page);
  const rects = await panelRectsOf(page);
  const inside = (r: Rect, p: { x: number; y: number }) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  const hits: string[] = [];
  for (const [id, r] of Object.entries(rects)) {
    const n = boardPoints(corners).filter((p) => inside(r, p)).length;
    if (n) hits.push(`${id} covers ${n} board points`);
  }
  expect(hits, label).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('US6-AS1 the ability panel is docked, collapses, remembers, shows the phase; no panel covers the board', async ({ page }) => {
      await namedSetup(page);
      const panel = page.getByTestId('ability-panel');
      await expect(panel).toBeVisible();
      // Starts open on a wide screen, collapsed below 1500 px.
      const startCollapsed = size.width < 1500;
      await expect(panel).toHaveAttribute('data-collapsed', String(startCollapsed));
      await expect(page.getByTestId('ability-panel-phase')).toBeVisible();
      for (const collapsed of [startCollapsed, !startCollapsed]) {
        if ((await panel.getAttribute('data-collapsed')) !== String(collapsed)) await page.getByTestId('ability-panel-toggle').click();
        await expect(panel).toHaveAttribute('data-collapsed', String(collapsed));
        await expect(page.getByTestId('ability-panel-phase')).toBeVisible();
        expect(await viewSideOf(page)).toBe('light');
        await expectBoardClear(page, `light view, panel ${collapsed ? 'collapsed' : 'open'}`);
      }
      await page.screenshot({ path: `test-results/fixes-hud-${size.width}-light.png` });
      // The choice is remembered in this browser.
      const now = await panel.getAttribute('data-collapsed');
      await page.reload();
      await page.getByTestId('resume-saved').click();
      await expect(page.getByTestId('ability-panel')).toHaveAttribute('data-collapsed', now!);
      // The phase box follows the phase.
      const before = await page.getByTestId('ability-panel-phase').textContent();
      await dispatch(page, { type: 'endPhase' });
      await expect(page.getByTestId('ability-panel-phase')).not.toHaveText(before!);
      // From the other side: play on until a Dark hero is active.
      await toSide(page, 'dark');
      await expect.poll(() => viewSideOf(page)).toBe('dark');
      await expectBoardClear(page, 'dark view');
      await page.screenshot({ path: `test-results/fixes-hud-${size.width}-dark.png` });
    });
  });
}

const highlighted = (page: Page) => hook<{ kind: string; square: string }[]>(page, 'highlighted');

async function toPhase(page: Page, phase: string): Promise<void> {
  for (let i = 0; i < 8 && (await state(page)).phase !== phase; i++) await dispatch(page, { type: 'endPhase' });
  expect((await state(page)).phase).toBe(phase);
}

/** Change the game state in the page (test hook) and play on from it. */
async function edit(page: Page, body: string, arg?: unknown): Promise<void> {
  await page.evaluate(([fn, a]) => {
    const r = (window as any).__rosada;
    const s = structuredClone(r.state());
    new Function('s', 'a', fn as string)(s, a);
    r.startPosition(s);
  }, [body, arg] as const);
}

/** The first legal target choice of an ability, dispatched as `useAbility`. */
async function useFirst(page: Page, abilityId: string): Promise<boolean> {
  return page.evaluate(async (id) => {
    const path = '/src/rules/index.ts';
    const rules: any = await import(/* @vite-ignore */ path);
    const r = (window as any).__rosada;
    const offer = rules.abilityOffers(r.state()).find((o: any) => o.abilityId === id);
    if (!offer) return false;
    return r.dispatch({ type: 'useAbility', abilityId: id, targets: offer.targets[0] ?? [] });
  }, abilityId);
}

const DARK_KING_ON_E4 = "s.units.find((u) => u.type === 'king' && u.side === 'dark').pos = { x: 5, y: 4 };";
const skipped = (phase: string) => `Phase '${phase}' skipped`;

test.describe('1920×1080 HUD', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('US6-AS2 the collapsed header counts the usable abilities', async ({ page }) => {
    await namedSetup(page);
    const panel = page.getByTestId('ability-panel');
    if ((await panel.getAttribute('data-collapsed')) !== 'true') await page.getByTestId('ability-panel-toggle').click();
    await expect(panel).toHaveAttribute('data-collapsed', 'true');
    // Before Move: Demoralise is usable.
    await expect(page.getByTestId('ability-panel-usable')).toHaveText('1 usable');
    await expect(page.getByTestId('ability-panel-phase')).toHaveText('Before Move');
    await expect(page.getByTestId('ability-cavalier.demoralise')).toHaveCount(0);
  });

  test('US6-AS3 the health bar: green for what is left, red for what is lost, "6/8" inside', async ({ page }) => {
    await namedSetup(page);
    await arrange(page, [{ type: 'sandboxSet', path: 'health', target: 'H2', value: 6 }]);
    const bar = page.getByTestId('hero-H2-health');
    await expect(bar).toHaveAttribute('aria-label', 'Health 6 of 8');
    await expect(bar).toContainText('6/8');
    const widths = await bar.evaluate((b) => [b.getBoundingClientRect().width, (b.querySelector('.health-fill') as HTMLElement).getBoundingClientRect().width]);
    expect(widths[1] / widths[0]).toBeCloseTo(0.75, 1);
    await page.getByTestId('hero-H2').screenshot({ path: 'test-results/fixes-hud-health.png' });
  });

  test('US6-AS4 flashes for an ability, Destiny, a wound and a roll; the log keeps every line', async ({ page }) => {
    await namedSetup(page);
    // Before Move: Demoralise (1 D).
    expect(await useFirst(page, 'cavalier.demoralise')).toBe(true);
    await expect.poll(async () => (await flashesOf(page)).map((f) => f.kind)).toEqual(expect.arrayContaining(['ability', 'destiny']));
    // A wound: a Dark Bear Trap one step ahead of the Cavalier.
    const h1 = (await state(page)).heroes.find((h) => h.id === 'H1') as unknown as { pos: { x: number; y: number } };
    const ahead = at(h1.pos.x, h1.pos.y + 1);
    await edit(page, "s.effects.push({ id: s.nextEffectId++, kind: 'bearTrap', source: { abilityId: 'scout.bearTraps', heroId: 'H2' }, target: { square: a }, expires: { at: 'removed' }, data: { penalty: -3, wounds: 4 } });", ahead);
    await toPhase(page, 'move');
    await dispatch(page, { type: 'moveStep', to: ahead });
    await expect.poll(async () => (await flashesOf(page)).map((f) => f.kind)).toContain('wound');
    // A roll: War, the Knight b1 → c3 needs one.
    await edit(page, "s.tokens.peaceTreaty = 'war';");
    await toPhase(page, 'lead');
    await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
    await hook(page, 'forceNextRoll', 15);
    await page.getByTestId('roll-button').click();
    await expect.poll(async () => (await flashesOf(page)).find((f) => f.kind === 'roll')?.text ?? '').toMatch(/15/);
    expect((await page.getByTestId('log').textContent()) ?? '').toMatch(/Demoralise/);
  });

  test('US6-AS4 skipped phases: "Before Move" for a Cavalier whose Demoralise is spent, none of the start phases for a Dragon Lord', async ({ page }) => {
    await namedSetup(page);
    await arrange(page, [{ type: 'sandboxSet', path: 'uses', target: 'H1:cavalier.demoralise', value: 0 }]);
    await expect.poll(async () => (await flashesOf(page)).map((f) => f.text)).toContain(skipped('Before Move'));
    for (const p of ['Before Turn', 'Beginning of Turn']) expect((await flashesOf(page)).map((f) => f.text)).not.toContain(skipped(p));
    await namedSetup(page);
    await arrange(page, [{ type: 'sandboxSet', path: 'form', target: 'H1', value: 'dragonLord' }]);
    await expect.poll(async () => (await state(page)).phase).toBe('move');
    const texts = (await flashesOf(page)).map((f) => f.text);
    for (const p of ['Before Turn', 'Beginning of Turn', 'Before Move']) expect(texts).not.toContain(skipped(p));
  });

  test('US6-AS6 named heroes by name, Move and Range badges, never "Short range"', async ({ page }) => {
    await namedSetup(page);
    await expect(page.getByTestId('active-hero')).toHaveText('H1 · Cavalier (Light)');
    await expect(page.getByTestId('active-movement')).toHaveText(/Move 5\/5/);
    await expect(page.getByTestId('active-range')).toHaveText(/Range 1/);
    await expect(page.getByTestId('hero-H2-move')).toHaveText(/Move 3\/3/);
    await expect(page.getByTestId('hero-H2-range')).toHaveText(/Range 3/);
    await expect(page.locator('#hud')).not.toContainText(/Short range|Long range/);
  });

  test('US6-AS7 the Range is outlined in the Lead phase', async ({ page }) => {
    await namedSetup(page);
    expect((await highlighted(page)).filter((h) => h.kind === 'range')).toEqual([]);
    await toPhase(page, 'lead');
    expect((await highlighted(page)).filter((h) => h.kind === 'range').length).toBeGreaterThan(0);
  });

  test('US6-AS8 Hero Unit icons are dimmed until the side has the Hero Unit power', async ({ page }) => {
    await namedSetup(page);
    const icons = page.getByTestId('hero-H1-unit-icons');
    await expect(icons).toHaveAttribute('data-unlocked', 'false');
    await edit(page, "s.royalFavors.light.track = ['bloodyTheCastleGates', 'overwhelm', 'greatIncursion', 'tacticalGenius', 'deployTroops', 'royalsFury'];");
    await expect(icons).toHaveAttribute('data-unlocked', 'true');
    await expect(page.getByTestId('hero-H2-unit-icons')).toHaveAttribute('data-unlocked', 'false');
  });

  test('US6-AS9 + AS10 Settings ends with "Resume game" and has Offer draw; the action bar has none', async ({ page }) => {
    await namedSetup(page);
    await expect(page.getByTestId('actions').getByTestId('offer-draw')).toHaveCount(0);
    await page.getByTestId('open-settings').click();
    const buttons = page.getByTestId('settings').locator('button');
    await expect(buttons.last()).toHaveText('Resume game');
    await expect(buttons.last()).toHaveAttribute('data-testid', 'settings-resume');
    await expect(page.getByTestId('offer-draw')).toBeEnabled();
    await page.screenshot({ path: 'test-results/fixes-hud-settings.png' });
    await page.getByTestId('settings-resume').click();
    await expect(page.getByTestId('settings')).toHaveCount(0);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('offer-draw').click();
    await expect(page.getByTestId('settings')).toHaveCount(0);
    await expect.poll(async () => (await hook<{ pendingDecision: { type: string } | null }>(page, 'state')).pendingDecision?.type).toBe('drawOffer');
  });

  test('US6-AS11 + AS12 a new check: "CHECK" above the King, the "In check" pop-up with its rule, gone when the check ends', async ({ page }) => {
    await namedSetup(page);
    // The Dark King on e4: the Knight Led b1 → c3 checks it.
    await edit(page, DARK_KING_ON_E4);
    await toPhase(page, 'lead');
    await expect(page.getByTestId('in-check-dark')).toHaveCount(0);
    await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
    const notice = page.getByTestId('check-flash');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('data-side', 'dark');
    // Above the King's square, centred on it, and it takes no clicks (read at once: the notice lasts three seconds).
    const where = await page.evaluate(() => {
      const n = document.querySelector('[data-testid="check-flash"]') as HTMLElement;
      const king = (window as any).__rosada.screenOf('e4');
      const r = n.getBoundingClientRect();
      return { text: n.textContent, dx: Math.abs(r.left + r.width / 2 - king.x), above: r.bottom < king.y, events: getComputedStyle(n).pointerEvents };
    });
    expect(where).toEqual({ text: 'CHECK', dx: expect.any(Number), above: true, events: 'none' });
    expect(where.dx).toBeLessThan(4);
    const popup = page.getByTestId('in-check-dark');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Dark');
    // Directly above the ability panel.
    const pb = (await popup.boundingBox())!;
    const ab = (await page.getByTestId('ability-panel').boundingBox())!;
    expect(pb.y + pb.height).toBeLessThanOrEqual(ab.y + 1);
    await expect(page.getByTestId('in-check-rule')).toBeHidden();
    await popup.hover();
    await expect(page.getByTestId('in-check-rule')).toHaveText('If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn.');
    await page.screenshot({ path: 'test-results/fixes-hud-check.png' });
    expect((await page.getByTestId('log').textContent()) ?? '').toMatch(/check/i);
    // The check ends (the Lead is undone): the pop-up goes away.
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('in-check-dark')).toHaveCount(0);
  });

  test('US6-AS5 + AS11 reduced motion: the CHECK notice is steady', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await namedSetup(page);
    await edit(page, DARK_KING_ON_E4);
    await toPhase(page, 'lead');
    await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
    // Read at once: the notice lasts three seconds.
    const style = await page.evaluate(() => {
      const n = document.querySelector('[data-testid="check-flash"]');
      return n ? { steady: n.classList.contains('steady'), animation: getComputedStyle(n).animationName } : null;
    });
    expect(style).toEqual({ steady: true, animation: 'none' });
  });
});

test('US6-AS10 online: Offer draw and "Resume game" in Settings', async ({ browser }) => {
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
  await expect(a.getByTestId('actions').getByTestId('offer-draw')).toHaveCount(0);
  await a.getByTestId('open-settings').click();
  await expect(a.getByTestId('settings').locator('button').last()).toHaveText('Resume game');
  await expect(a.getByTestId('offer-draw')).toBeEnabled();
  // The player who may not act cannot offer a draw now.
  await b.getByTestId('open-settings').click();
  await expect(b.getByTestId('offer-draw')).toBeDisabled();
  await b.getByTestId('settings-resume').click();
  await expect(b.getByTestId('settings')).toHaveCount(0);
});
