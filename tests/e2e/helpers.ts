import { expect, type Page } from '@playwright/test';

export async function hook<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(([f, a]) => (window as any).__rosada[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
}

/** Click the centre of a board square with the real mouse (goes through raycast picking). */
export async function clickSquare(page: Page, square: string): Promise<void> {
  const p = await hook<{ x: number; y: number }>(page, 'screenOf', square);
  await page.mouse.click(p.x, p.y);
}

/** 4-player Draft setup through the UI with the suggested order; returns when the table shows. */
export async function quickSetup(page: Page): Promise<void> {
  // Generic heroes (`?generic`, spec Q-42) keep the 001–003 flows unchanged.
  await page.goto('/?generic');
  await page.getByTestId('setup-next').click();
  await page.getByTestId('mode-draft').click();
  for (const r of ['short', 'short', 'long', 'long']) await page.getByTestId(`pick-${r}`).click();
  await page.getByTestId('order-confirm-light').click();
  await page.getByTestId('order-confirm-dark').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('phase-bar')).toBeVisible();
}
