// 005 T057 / analysis H2: no game server reachable (US5-AS2, FR-073 and the "server is down" edge case).
import { expect, test } from '@playwright/test';
import { hook, quickSetup } from './helpers.ts';

test('US5-AS2 without the game server, Play online says so and hot-seat still starts and plays', async ({ page }) => {
  // Every request to the game server fails, as if it were down.
  await page.route('**/ws/**', (route) => route.abort('connectionrefused'));
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
  await page.goto('/');
  await page.getByTestId('play-online').click();
  await page.getByTestId('online-name').fill('Luka');
  await page.getByTestId('online-create').click();
  await expect(page.getByTestId('online-error')).toContainText('not available');
  await page.getByTestId('online-back').click();

  await quickSetup(page);
  await expect(page.getByTestId('phase-bar')).toBeVisible();
  const before = (await hook<unknown[]>(page, 'actions')).length;
  await page.getByTestId('end-phase').click();
  await expect.poll(async () => (await hook<unknown[]>(page, 'actions')).length).toBe(before + 1);
});
