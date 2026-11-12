import { expect, type Page } from '@playwright/test';

export async function hook<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(([f, a]) => (window as any).__rosada[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
}

// 006 test hook (contracts/ui-interactions.md).
export type Rect = { x: number; y: number; w: number; h: number };
export type Flash = { kind: string; text: string; tone: string };
export const planOf = (page: Page) => hook<{ path: string[]; left: number } | null>(page, 'plan');
export const flashesOf = (page: Page) => hook<Flash[]>(page, 'flashes');
export const panelRectsOf = (page: Page) => hook<Record<string, Rect>>(page, 'panelRects');
export const boardRectOf = (page: Page) => hook<{ x: number; y: number }[]>(page, 'boardRect');
export const viewSideOf = (page: Page) => hook<'light' | 'dark' | null>(page, 'viewSide');

/** 006 FR-022: pick a named hero: the first click highlights the card, the second click picks it. */
export async function pickNamed(page: Page, id: string): Promise<void> {
  const card = page.getByTestId(`pick-${id}`);
  await card.click();
  await expect(card).toHaveAttribute('data-pending', 'true');
  await card.click();
}

/** Click the centre of a board square with the real mouse (goes through raycast picking). */
export async function clickSquare(page: Page, square: string): Promise<void> {
  const p = await hook<{ x: number; y: number }>(page, 'screenOf', square);
  await page.mouse.click(p.x, p.y);
}

/** 006 FR-021: move the hero to a square: the first click plans the shortest path, the second walks it. */
export async function walkTo(page: Page, square: string): Promise<void> {
  await clickSquare(page, square);
  await clickSquare(page, square);
  await expect.poll(() => hook<boolean>(page, 'walking')).toBe(false);
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
