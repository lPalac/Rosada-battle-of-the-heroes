// 006 US2 in the browser: Undo after End phase (B-03), the sandbox keeps the turn (B-06), the checkmate alert.
import { expect, test, type Page } from '@playwright/test';
import { hook, openAbilities, pickNamed, quickSetup } from './helpers.ts';

type State = { phase: string; activeHeroId: string; status: string; enforcement: string; result: unknown; turn: { movementLeft: number }; pendingDecision: { type: string; options?: unknown[] } | null };
const state = (page: Page) => hook<State>(page, 'state');
const dispatch = (page: Page, action: unknown) => hook<boolean>(page, 'dispatch', action);

async function namedSetup(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ['cavalier', 'scout', 'magus', 'monk']) await pickNamed(page, id);
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
}

async function toPhase(page: Page, phase: string): Promise<void> {
  for (let i = 0; i < 8 && (await state(page)).phase !== phase; i++) await dispatch(page, { type: 'endPhase' });
  expect((await state(page)).phase).toBe(phase);
}

async function rulesOffThenOn(page: Page): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-sandbox-on').click();
  await page.getByTestId('confirm-yes').click();
  await expect(page.getByTestId('sandbox-badge')).toBeVisible();
}

test('US2-AS1 the Undo button is enabled after End phase from After Lead and goes back there', async ({ page }) => {
  await namedSetup(page);
  await toPhase(page, 'lead');
  // The Cavalier (c0) Leads the Knight b1 → c3; the Peace side is up, so no roll. Then the advance square.
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: { x: 3, y: 3 } });
  const d = (await state(page)).pendingDecision;
  if (d?.type === 'advanceSquare') await dispatch(page, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
  await expect(page.getByTestId('current-phase')).toHaveText('After Lead');
  await page.getByTestId('end-phase').click();
  await expect(page.getByTestId('current-phase')).toHaveText('End of Turn');
  await expect(page.getByTestId('undo')).toBeEnabled();
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('current-phase')).toHaveText('After Lead');
  await openAbilities(page);
  await expect(page.getByTestId('use-cavalier.warhorse')).toBeVisible();
});

test('US2-AS3 a sandbox round trip in the Lead phase keeps the phase and the Movement left', async ({ page }) => {
  await quickSetup(page);
  const before = await state(page);
  expect(before.phase).toBe('move');
  await dispatch(page, { type: 'moveStep', to: { x: 4, y: 0 } });
  await toPhase(page, 'lead');
  const lead = await state(page);
  await rulesOffThenOn(page);
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('sandbox-badge')).toHaveCount(0);
  const back = await state(page);
  expect([back.activeHeroId, back.phase, back.turn.movementLeft]).toEqual([lead.activeHeroId, 'lead', lead.turn.movementLeft]);
  await expect(page.getByTestId('current-phase')).toHaveText('Lead');
});

test('US2-AS8 / US2-AS9 a checkmate set up in the sandbox: the alert, "Back to sandbox", then "Continue the game"', async ({ page }) => {
  await quickSetup(page);
  await rulesOffThenOn(page);
  // Scholar's mate: the Dark Pawn f7 to the Graveyard, the Light Bishop f1 → c4, the Light Queen d1 → f7.
  await dispatch(page, { type: 'sandboxPlace', target: { unitId: 'D-P-f' }, to: 'graveyard' });
  await dispatch(page, { type: 'sandboxPlace', target: { unitId: 'L-B-f' }, to: { x: 3, y: 4 } });
  await dispatch(page, { type: 'sandboxPlace', target: { unitId: 'L-Q-d' }, to: { x: 6, y: 7 } });
  await page.getByTestId('resume-rules').click();
  await expect(page.getByTestId('checkmate-alert')).toContainText("Dark's King is checkmated");
  await page.getByTestId('checkmate-back').click();
  await expect(page.getByTestId('checkmate-alert')).toHaveCount(0);
  await expect(page.getByTestId('sandbox-badge')).toBeVisible();
  expect((await state(page)).enforcement).toBe('sandbox');
  // Again, and continue: rules come back on; the checkmate is ruled when the next turn begins.
  await page.getByTestId('resume-rules').click();
  await page.getByTestId('checkmate-continue').click();
  await expect(page.getByTestId('sandbox-badge')).toHaveCount(0);
  const on = await state(page);
  expect([on.enforcement, on.status]).toEqual(['rules', 'playing']);
  // Finish Light's turn (a possible Lead must be made: the Knight b1 → a3), so the next turn begins.
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: { x: 1, y: 3 } });
  for (let i = 0; i < 12 && (await state(page)).status === 'playing'; i++) {
    const d = (await state(page)).pendingDecision;
    if (d?.type === 'advanceSquare') await dispatch(page, { type: 'decide', decision: { type: 'square', to: d.options![0] } });
    else await dispatch(page, { type: 'endPhase' });
  }
  expect((await state(page)).result).toMatchObject({ kind: 'win', winner: 'light', by: 'checkmate' });
});
