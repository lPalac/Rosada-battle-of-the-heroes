// 006 US3 in the browser (B-01): each Epic choice names the hero and shows its own forms; Mirror asks two choices and
// does not offer Light's hero for Dark's pick.
import { expect, test, type Page } from '@playwright/test';
import { hook, pickNamed } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });
type State = { stage: string; activeHeroId: string; phase: string; pendingDecision: { type: string; options?: unknown[] } | null; heroes: { id: string; form: string | null; definitionId: string }[] };
const state = (page: Page) => hook<State>(page, 'state');

async function setup(page: Page, mode: 'draft' | 'mirror'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId(`mode-${mode}`).click();
  if (mode === 'draft') {
    for (const id of ['cavalier', 'scout', 'magus', 'monk']) await pickNamed(page, id);
  } else {
    await pickNamed(page, 'cavalier'); // Light: the Cavalier for both sides
    await expect(page.getByTestId('pick-cavalier')).toBeDisabled(); // US3-AS8: not offered for Dark's pick
    await pickNamed(page, 'monk'); // Dark: the Monk for both sides
  }
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
}

/** Light pawn d2 takes a Dark Knight on c3 with the last 2 Destiny; then the turn ends and the choices open. */
async function depleteWell(page: Page): Promise<void> {
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'well', value: 2 });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'D-N-b' }, to: at(3, 3) });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(3, 1) });
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules', restart: true });
  for (let i = 0; i < 6 && (await state(page)).phase !== 'lead'; i++) await hook(page, 'dispatch', { type: 'endPhase' });
  expect(await hook(page, 'dispatch', { type: 'announceLead', unitId: 'L-P-d', to: at(3, 3) })).toBe(true);
  for (let i = 0; i < 12; i++) {
    const s = await state(page);
    if (s.pendingDecision?.type === 'epicDestiny') break;
    const d = s.pendingDecision;
    if (d?.type === 'advanceSquare') await hook(page, 'dispatch', { type: 'decide', decision: { type: 'square', to: d.options![0] } });
    else await hook(page, 'dispatch', { type: 'endPhase' });
  }
  await expect(page.getByTestId('destiny-hero')).toBeVisible();
}

const FORMS: Record<string, string[]> = {
  Cavalier: ['Death Knight', 'Dragon Lord', 'Holy Paladin'], Monk: ['Cultist', 'Saint', 'Supreme Inquisitor'],
  Scout: ['Scoundrel', 'Spy Master', 'Royal Assassin'], Magus: ['Necromancer', 'Grand Arcanist', 'Chronomonger'],
};

test('US3-AS1…AS5 four choices, each with its hero, its own forms and portraits, the choices so far; then the forms', async ({ page }) => {
  await setup(page, 'draft');
  await depleteWell(page);
  const seen = new Set<string>();
  const order: string[] = [];
  for (let n = 1; n <= 4; n++) {
    await expect(page.getByTestId('destiny-step')).toHaveText(`Choice ${n} of 4`);
    const title = await page.getByTestId('destiny-hero').innerText();
    const hero = Object.keys(FORMS).find((k) => title.includes(k))!;
    expect(hero, title).toBeTruthy();
    order.push(hero);
    const forms = await Promise.all(['fanatic', 'resolute', 'dominant'].map((d) => page.getByTestId(`destiny-${d}-form`).innerText()));
    expect(forms).toEqual(FORMS[hero]);
    for (const d of ['fanatic', 'resolute', 'dominant']) seen.add((await page.getByTestId(`destiny-${d}`).locator('img').getAttribute('src'))!);
    if (n > 1) await expect(page.getByTestId('destiny-chosen')).toContainText(order[0]);
    // US3-AS4: Fanatic for the first hero of a side; the ally then sees Dominant disabled with its reason.
    const dominant = page.getByTestId('destiny-dominant');
    if (await dominant.isDisabled()) {
      await expect(dominant).toContainText('Not with a Fanatic hero');
      await page.getByTestId('destiny-resolute').click();
    } else await page.getByTestId('destiny-fanatic').click();
  }
  expect(seen.size).toBe(12);
  expect(order.sort()).toEqual(['Cavalier', 'Magus', 'Monk', 'Scout']);
  // US3-AS5: every hero has its Epic form; the hero cards show the form names.
  await expect(page.getByTestId('epic-notice')).toBeVisible();
  const s = await state(page);
  expect(s.stage).toBe('epic');
  expect(s.heroes.every((h) => h.form)).toBe(true);
  await expect(page.getByTestId('hero-H1')).toContainText(/Death Knight|Dragon Lord|Holy Paladin/);
  await page.screenshot({ path: 'test-results/fixes-epic-draft.png' });
});

test('US3-AS6 / US3-AS7 / US3-AS8 Mirror: two choices, each for both heroes of a class', async ({ page }) => {
  await setup(page, 'mirror');
  await depleteWell(page);
  await expect(page.getByTestId('destiny-step')).toHaveText('Choice 1 of 2');
  await expect(page.getByTestId('destiny-applies')).toContainText('(Light)');
  await expect(page.getByTestId('destiny-applies')).toContainText('(Dark)');
  const first = await page.getByTestId('destiny-hero').innerText();
  await page.screenshot({ path: 'test-results/fixes-epic-mirror.png' });
  await page.getByTestId('destiny-fanatic').click();
  await expect(page.getByTestId('destiny-step')).toHaveText('Choice 2 of 2');
  const second = await page.getByTestId('destiny-hero').innerText();
  expect(second).not.toBe(first);
  await expect(page.getByTestId('destiny-dominant')).toBeDisabled();
  await page.getByTestId('destiny-resolute').click();
  await expect(page.getByTestId('epic-notice')).toBeVisible();
  const s = await state(page);
  for (const def of ['cavalier', 'monk']) {
    const forms = s.heroes.filter((h) => h.definitionId === def).map((h) => h.form);
    expect(forms).toHaveLength(2);
    expect(forms[0]).toBe(forms[1]);
  }
});
