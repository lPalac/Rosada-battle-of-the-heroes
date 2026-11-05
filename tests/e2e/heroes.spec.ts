// Named heroes in setup (004 T026, US1): Draft cards with portrait and range; a picked hero is disabled for the other side.
import { expect, test } from '@playwright/test';
import { hook } from './helpers.ts';

test('Draft through the UI picks named heroes; a picked hero is disabled', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  await expect(page.getByTestId('pick-short')).toHaveCount(0);
  const cav = page.getByTestId('pick-cavalier');
  await expect(cav.locator('img')).toBeVisible();
  await expect(cav).toContainText('Short range');
  await cav.click();
  await expect(page.getByTestId('pick-cavalier')).toBeDisabled();
  await page.getByTestId('pick-scout').click();
  await page.getByTestId('pick-magus').click();
  await page.getByTestId('pick-monk').click();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
  const defs = await hook<string[]>(page, 'heroDefinitions');
  expect(defs.sort()).toEqual(['cavalier', 'magus', 'monk', 'scout']);
});
