import { expect, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions; assert it's empty at the end of a test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Opens the game and starts a run from the main menu, skipping the tutorial. */
export async function startRun(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#overlay-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay-menu')).toBeHidden();
  const skip = page.locator('#tutorial-skip');
  if (await skip.isVisible()) await skip.click();
}

/**
 * Page coordinates of the centre of map tile (col, row). The canvas fills the stage and shows scenery
 * around the map; the game publishes where the map sits (data attributes on #game-container).
 */
export async function tileCenter(page: Page, col: number, row: number): Promise<[number, number]> {
  const box = (await page.locator('#game-container canvas').boundingBox())!;
  const map = await page.locator('#game-container').evaluate((el) => ({
    left: Number((el as HTMLElement).dataset.mapLeft),
    top: Number((el as HTMLElement).dataset.mapTop),
    tile: Number((el as HTMLElement).dataset.tile),
  }));
  return [box.x + map.left + (col + 0.5) * map.tile, box.y + map.top + (row + 0.5) * map.tile];
}

export async function clickTile(page: Page, col: number, row: number): Promise<void> {
  const [x, y] = await tileCenter(page, col, row);
  await page.mouse.click(x, y);
}

export const stat = (page: Page, name: 'wave' | 'gold' | 'health') =>
  page.locator(`#stat-${name}`).innerText().then(Number);
