// 006 US5 in the browser: the Lead prompt says why no roll is needed (B-04), offers Inspired Lead at the roll (B-07),
// and names its modifiers (X-01).
import { expect, test, type Page } from '@playwright/test';
import { clickSquare, hook, openAbilities, pickNamed, quickSetup } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });
type State = { phase: string; turn: { lead: { success: boolean | null; needsRoll: boolean; modifiers: { source: string; value: number }[] } | null } };
const state = (page: Page) => hook<State>(page, 'state');
const dispatch = (page: Page, a: unknown) => hook<boolean>(page, 'dispatch', a);

async function toPhase(page: Page, phase: string): Promise<void> {
  for (let i = 0; i < 8 && (await state(page)).phase !== phase; i++) await dispatch(page, { type: 'endPhase' });
  expect((await state(page)).phase).toBe(phase);
}

/** War declared, through the sandbox (no edit of the turn). */
async function war(page: Page): Promise<void> {
  await dispatch(page, { type: 'setEnforcement', mode: 'sandbox' });
  await dispatch(page, { type: 'sandboxSet', path: 'peaceTreaty', value: 'war' });
  await dispatch(page, { type: 'setEnforcement', mode: 'rules' });
}

test('US5-AS1 a Lead without a roll says why; "No roll needed" appears nowhere', async ({ page }) => {
  await quickSetup(page);
  await toPhase(page, 'lead');
  await clickSquare(page, 'b1');
  await expect(page.getByTestId('lead-auto')).toHaveText('Peace Treaty: the Lead succeeds');
  await expect(page.getByText('No roll needed')).toHaveCount(0);
});

test('US5-AS2…AS4 Inspired Lead next to the Roll button: +2 per D, the Lead can succeed without a roll; gone after the roll', async ({ page }) => {
  await quickSetup(page);
  await war(page);
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
  await expect(page.getByTestId('roll-button')).toBeVisible();
  await expect(page.getByTestId('inspired-lead-roll')).toBeVisible();
  await expect(page.getByTestId('inspired-lead')).toHaveCount(0); // the action bar's button is for Before Lead only
  await expect(page.getByTestId('lead-preview')).toHaveText('d20 + War +2 ≥ 6');
  // 2 D: 1 + War 2 + 4 = 7 ≥ 6, so the Lead cannot fail and succeeds at once.
  await page.getByTestId('inspired-lead-roll').click();
  await page.getByTestId('amount-2').click();
  const pay = page.getByTestId('pay-2-0');
  if (await pay.count()) await pay.click();
  await expect.poll(async () => (await state(page)).turn.lead?.success).toBe(true);
  await expect(page.getByTestId('roll-button')).toHaveCount(0);
  await expect(page.getByTestId('inspired-lead-roll')).toHaveCount(0);
});

test('US5-AS3 one D only adds +2 to the line; the roll is still needed; after the roll the button is gone', async ({ page }) => {
  await quickSetup(page);
  await war(page);
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
  await page.getByTestId('inspired-lead-roll').click();
  await page.getByTestId('amount-1').click();
  await expect(page.getByTestId('lead-preview')).toHaveText('d20 + War +2 + Inspired Lead +2 ≥ 6');
  await hook(page, 'forceNextRoll', 10);
  await page.getByTestId('roll-button').click();
  await expect(page.getByTestId('roll-result')).toBeVisible();
  await expect(page.getByTestId('inspired-lead-roll')).toHaveCount(0);
});

test('US5-AS5 modifiers by name: War, Bear Traps, Future Sight', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const id of ['magus', 'scout', 'cavalier', 'monk']) await pickNamed(page, id);
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
  // War, and a Dark Bear Trap on c4 next to the Knight's path b1 → c3.
  await page.evaluate(() => {
    const r = (window as any).__rosada;
    const s = structuredClone(r.state());
    s.tokens.peaceTreaty = 'war';
    s.effects.push({ id: s.nextEffectId++, kind: 'bearTrap', source: { abilityId: 'scout.bearTraps', heroId: 'H2' }, target: { square: { x: 3, y: 4 } }, expires: { at: 'removed' }, data: { penalty: -3, wounds: 4 } });
    r.startPosition(s);
  });
  await toPhase(page, 'beforeLead');
  await openAbilities(page);
  await page.getByTestId('use-magus.futureSight').click();
  await toPhase(page, 'lead');
  await dispatch(page, { type: 'announceLead', unitId: 'L-N-b', to: at(3, 3) });
  const line = page.getByTestId('lead-preview');
  await expect(line).toContainText('War +2');
  await expect(line).toContainText('Bear Traps −3');
  await expect(line).toContainText('Future Sight +2');
  await expect(line).not.toContainText('mod.');
  await expect(line).not.toContainText('scout.');
  await page.screenshot({ path: 'test-results/fixes-lead.png' });
});
