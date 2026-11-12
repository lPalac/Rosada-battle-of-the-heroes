// UI pieces not covered elsewhere: result screen + Rematch (FR-091), Inspired Lead with a pay split (FR-072/073),
// rule reference for a rejected action (FR-202), position editor + fixture export (FR-204).
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

const at = (x: number, y: number) => ({ x, y });

test('result screen after checkmate; Rematch starts the same setup again', async ({ page }) => {
  await quickSetup(page);
  // Fool's mate position by hand, then resume: Before Turn finds the mate.
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  for (const [id, to] of [['L-P-f', at(6, 3)], ['L-P-g', at(7, 4)], ['D-P-e', at(5, 5)], ['D-Q-d', at(8, 4)]] as const) {
    await hook(page, 'dispatch', { type: 'sandboxPlace', target: { unitId: id }, to });
  }
  // 006 FR-006: a continued turn rules the mate at the next Before Turn; `restart` starts at Before Turn as in 001.
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules', restart: true });
  await expect(page.getByTestId('result-title')).toHaveText('Dark wins by checkmate');
  await page.getByTestId('result-rematch').click();
  await expect(page.getByTestId('result')).toHaveCount(0);
  await expect(page.getByTestId('active-hero')).toContainText('H1');
  const s = await hook<any>(page, 'state');
  expect(s.status).toBe('playing');
  expect(s.units).toHaveLength(32);
});

test('Inspired Lead asks for the amount and the pool split', async ({ page }) => {
  await quickSetup(page);
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'sandbox' });
  await hook(page, 'dispatch', { type: 'sandboxSet', path: 'common', target: 'light', value: 2 });
  await hook(page, 'dispatch', { type: 'setEnforcement', mode: 'rules' });
  await page.getByTestId('end-phase').click(); // Move → Before Lead
  await page.getByTestId('inspired-lead').click();
  await page.getByTestId('amount-2').click();
  await page.getByTestId('pay-1-1').click();
  const s = await hook<any>(page, 'state');
  expect(s.heroes[0].pool).toBe(2);
  expect(s.destiny.common.light).toBe(1);
  expect(s.turn.inspiredLeadBonus).toBe(4);
  await expect(page.getByTestId('current-phase')).toHaveText('Lead');
});

test('a rejected action shows what blocked it and the rule', async ({ page }) => {
  await quickSetup(page);
  await page.getByTestId('end-phase').click();
  await page.getByTestId('end-phase').click();
  await hook(page, 'dispatch', { type: 'endPhase' }); // a possible Lead is not attempted
  await expect(page.getByTestId('rule-reference')).toContainText('A possible Lead must be attempted');
  await expect(page.getByTestId('rule-reference')).toContainText('Rule: Lead');
});

test('position editor opens a sandbox game and exports a test fixture', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('position-editor').click();
  await expect(page.getByTestId('sandbox-badge')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-fixture').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('position.fixture.ts');
  const text = await (await file.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(text).toContain('position(`');
  expect(text).toContain('RNBQKBNR');
});
