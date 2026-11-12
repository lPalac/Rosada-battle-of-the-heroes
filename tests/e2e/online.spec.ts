// 005 T037–T039, T045, T046: online play in several browser contexts (each its own player and storage).
import { expect, test, type Browser, type Page } from '@playwright/test';
import { pickNamed } from './helpers.ts';

/** A 2-player game played headless (in the page, with the rules core) until a Lead waits for a roll. */
function saveAtRoll(page: Page): Promise<{ actions: unknown[] }> {
  return page.evaluate(async () => {
    const paths = ['/src/rules/index.ts', '/src/online/auto-setup.ts', '/src/game/save.ts'];
    const [rules, auto, save]: any[] = await Promise.all(paths.map((p) => import(p)));
    const initial = rules.createSetup({ mode: 'draft', playerCount: 2 });
    let s = initial;
    const actions: any[] = [];
    const play = (a: any) => {
      const r = rules.apply(s, a);
      if (!r.ok) throw new Error(`${a.type}: ${r.error.message}`);
      s = r.state;
      actions.push(a);
    };
    const order = ['light', 'dark', 'dark', 'light'];
    ['cavalier', 'monk', 'scout', 'magus'].forEach((h, i) => play({ type: 'pickHero', side: order[i], heroDefinitionId: h }));
    for (const a of auto.autoSetupActions(s)) play(a);
    let n = 0;
    for (let i = 0; i < 3000 && !(rules.awaitingRoll(s) && !s.pendingDecision); i++) {
      const legal = rules.legalActions(s).filter((a: any) => !['setEnforcement', 'offerDraw', 'submitRoll'].includes(a.type));
      const leads = legal.filter((a: any) => a.type === 'announceLead');
      // A simple deterministic walk: Leads first, otherwise a spread of the other legal actions.
      play(leads.length ? leads[n++ % leads.length] : legal[(n++ * 7) % legal.length]);
    }
    if (!rules.awaitingRoll(s)) throw new Error('no roll reached');
    return save.toSaveFile(initial, actions);
  });
}

type Online = { seat: string | null; canAct: boolean; seq: number; resyncs: number; room: { code: string; status: string } | null } | null;

const online = (page: Page) => page.evaluate(() => (window as any).__rosada.online()) as Promise<Online>;

async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  return page;
}

async function createRoom(page: Page, name: string, players: 2 | 3 | 4 = 2): Promise<string> {
  await page.getByTestId('play-online').click();
  await page.getByTestId('online-name').fill(name);
  await page.getByTestId(`online-players-${players}`).click();
  await page.getByTestId('online-create').click();
  await expect(page.getByTestId('lobby')).toBeVisible();
  return (await online(page))!.room!.code;
}

async function joinByLink(page: Page, code: string, name: string, seat: string): Promise<void> {
  await page.goto(`/#/room/${code}`);
  await expect(page.getByTestId('lobby')).toBeVisible();
  await page.getByTestId('online-name').fill(name);
  await page.getByTestId(`take-${seat}`).click();
  await expect(page.getByTestId(`seat-status-${seat}`)).toHaveText('you');
}

/** Two players in a started 2-player room, with heroes picked through the UI. */
async function twoPlayerGame(browser: Browser): Promise<{ a: Page; b: Page; code: string }> {
  const a = await newPlayer(browser);
  const b = await newPlayer(browser);
  const code = await createRoom(a, 'Luka');
  await joinByLink(b, code, 'Ana', 'P2');
  await a.getByTestId('online-start').click();
  // Draft: Light (Luka) picks, Dark (Ana) picks twice, Light picks.
  await pickNamed(a, 'cavalier');
  await expect(b.getByTestId('pick-monk')).toBeEnabled();
  await pickNamed(b, 'monk');
  await pickNamed(b, 'scout');
  await pickNamed(a, 'magus');
  for (const p of [a, b]) await expect(p.getByTestId('phase-bar')).toBeVisible();
  return { a, b, code };
}

test.describe('005 online play', () => {
  test('US1-AS1…AS4 create a room, join by link, take seats, start', async ({ browser }) => {
    const a = await newPlayer(browser);
    const b = await newPlayer(browser);
    const code = await createRoom(a, 'Luka');
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/);
    await expect(a.getByTestId('online-start')).toBeDisabled();
    await joinByLink(b, code, 'Ana', 'P2');
    await expect(a.getByTestId('seat-name-P2')).toHaveText('Ana');
    await expect(b.getByTestId('lobby-wait')).toContainText('Luka');
    await a.getByTestId('online-start').click();
    await expect(a.getByTestId('pick-cavalier')).toBeEnabled();
    await expect(b.getByTestId('online-pick-wait')).toContainText('Luka');
  });

  test('US1-AS5 a wrong code is refused with a message', async ({ browser }) => {
    const a = await newPlayer(browser);
    await a.getByTestId('play-online').click();
    await a.getByTestId('online-code').fill('zzzz zzz');
    await a.getByTestId('online-join').click();
    await expect(a.getByTestId('online-error')).toContainText('no room');
  });

  test('US2-AS1…AS4 picks per seat, automatic setup, only the active player acts', async ({ browser }) => {
    const { a, b } = await twoPlayerGame(browser);
    expect((await online(a))!.canAct).toBe(true);
    expect((await online(b))!.canAct).toBe(false);
    await expect(b.getByTestId('online-not-your-turn')).toContainText('Luka');
    const before = (await online(a))!.seq;
    await a.getByTestId('end-phase').click();
    // Both windows get the same applied action from the server (US2-AS3).
    await expect.poll(async () => [(await online(a))!.seq, (await online(b))!.seq]).toEqual([before + 1, before + 1]);
    // An out-of-turn action sent by hand is refused by the server.
    await b.evaluate(() => (window as any).__rosada.dispatch({ type: 'endPhase' }));
    await expect(b.getByTestId('toasts')).toContainText(/not your turn/i);
  });

  test('US6-AS2 + US3-AS1 a room from a save; the server roll lands on the same value in both windows', async ({ browser }) => {
    // The save stops at a Lead waiting for a roll (built headless with the rules core, see saveAtRoll).
    const a = await newPlayer(browser);
    const save = await saveAtRoll(a);
    const b = await newPlayer(browser);
    await a.getByTestId('play-online').click();
    await a.getByTestId('online-name').fill('Luka');
    await a.getByTestId('online-save-file').setInputFiles({ name: 'game.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(a.getByTestId('lobby')).toBeVisible({ timeout: 20_000 }); // the server replays the save first
    const code = (await online(a))!.room!.code;
    await joinByLink(b, code, 'Ana', 'P2');
    await a.getByTestId('online-start').click();
    for (const p of [a, b]) await expect(p.getByTestId('phase-bar')).toBeVisible();
    expect((await online(a))!.seq).toBe(save.actions.length);
    const roller = (await online(a))!.canAct ? a : b;
    await roller.evaluate(() => (window as any).__rosada.forceNextRoll(17));
    await roller.getByTestId('roll-button').click();
    for (const p of [a, b]) {
      await expect.poll(() => p.evaluate(() => {
        const log = (window as any).__rosada.state().log;
        return log.filter((l: any) => l.type === 'rolled').at(-1)?.data.value ?? null;
      })).toBe(17);
    }
    expect((await online(a))!.resyncs + (await online(b))!.resyncs).toBe(0);
  });

  test('US5-AS3 a client with another version is refused with VERSION_MISMATCH', async ({ browser }) => {
    const a = await newPlayer(browser);
    const code = await createRoom(a, 'Luka');
    const reason = await a.evaluate(async (c) => {
      const path = '/src/net/client.ts';
      const net: any = await import(path);
      const server = new net.GameServer(net.browserEndpoint(location));
      try {
        await server.join(c, { buildId: 'an-old-build', dataHash: 'x' });
        return 'joined';
      } catch (e: any) {
        return e.reason;
      }
    }, code);
    expect(reason).toBe('VERSION_MISMATCH');
  });

  test('US4-AS1 a reload puts the player back in the seat', async ({ browser }) => {
    const { a, b } = await twoPlayerGame(browser);
    const seq = (await online(a))!.seq;
    await b.reload();
    await expect.poll(async () => (await online(b))?.seat ?? null, { timeout: 10_000 }).toBe('P2');
    expect((await online(b))!.seq).toBe(seq);
    await expect(b.getByTestId('phase-bar')).toBeVisible();
  });
});
