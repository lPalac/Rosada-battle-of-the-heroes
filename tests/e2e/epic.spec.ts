// 003 US1 in the browser: the Well runs out, the destiny dialog opens in turn order, Fanatic blocks Dominant.
import { expect, test, type Page } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });

/** Light pawn d2 takes a Dark Knight on c3 with the last 2 Destiny; then the turn ends. */
export async function depleteWell(page: Page): Promise<void> {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'well', value: 2 });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: 'D-N-b' }, to: at(3, 3) });
  await hook(page, 'dispatch', { type: 'sandboxPlace', target: { heroId: 'H1' }, to: at(3, 1) });
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
  for (let i = 0; i < 4; i++) {
    const s = await hook<any>(page, 'state');
    if (s.phase === 'lead') break;
    await hook(page, 'dispatch', { type: 'endPhase' });
  }
  expect(await hook(page, 'dispatch', { type: 'announceLead', unitId: 'L-P-d', to: at(3, 3) })).toBe(true);
  for (let i = 0; i < 10; i++) {
    const s = await hook<any>(page, 'state');
    if (s.activeHeroId !== 'H1') break;
    const d = s.pendingDecision;
    if (d?.type === 'advanceSquare') await hook(page, 'dispatch', { type: 'decide', decision: { type: 'square', to: d.options[0] } });
    else await hook(page, 'dispatch', { type: 'endPhase' });
  }
}

test('US1 destiny dialog: turn order, Fanatic blocks Dominant, Epic Stage applies', async ({ page }) => {
  await depleteWell(page);
  await expect(page.getByTestId('destiny-fanatic')).toBeVisible();
  await expect(page.getByTestId('dialog')).toContainText('H2');
  await page.getByTestId('destiny-fanatic').click(); // H2 (Dark)
  await expect(page.getByTestId('dialog')).toContainText('H3');
  await page.getByTestId('destiny-resolute').click(); // H3 (Light)
  await expect(page.getByTestId('dialog')).toContainText('H4');
  await expect(page.getByTestId('destiny-dominant')).toBeDisabled();
  await page.getByTestId('destiny-resolute').click(); // H4
  await expect(page.getByTestId('dialog')).toContainText('H1'); // the depleting hero chooses last
  await page.getByTestId('destiny-dominant').click();
  await expect(page.getByTestId('epic-notice')).toBeVisible();
  const s = await hook<any>(page, 'state');
  expect(s.stage).toBe('epic');
  expect(s.tokens.peaceTreaty).toBe('removed');
  expect(s.royalFavors.light.track).toContain('manifestEpicDestiny');
  await expect(page.getByTestId('hero-H1-destiny')).toContainText('Dominant');
  await expect(page.getByTestId('hero-H1-generation')).toBeVisible();
});
