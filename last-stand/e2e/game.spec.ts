import { expect, test } from '@playwright/test';
import { clickTile, startRun, stat, tileCenter, trackErrors } from './helpers';

test('loads cleanly into the main menu with a sharp, unstretched canvas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#overlay-menu')).toBeVisible();
  await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator('#menu-record')).toContainText('Switchback');
  const ratio = await page.evaluate(() => {
    const c = document.querySelector('#game-container canvas') as HTMLCanvasElement;
    return (c.getBoundingClientRect().width * devicePixelRatio) / c.width;
  });
  expect(ratio).toBeCloseTo(1, 2);
  expect(errors).toEqual([]);
});

test('build, inspect, upgrade and sell a tower', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const gold0 = await stat(page, 'gold');

  // Shop tooltip.
  await page.locator('.tower-btn').first().hover();
  await expect(page.locator('#tower-tooltip')).toBeVisible();
  await expect(page.locator('#tower-tooltip h3')).toHaveText('Turret');

  // Build with the hotkey and a click; building costs gold.
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await expect.poll(() => stat(page, 'gold')).toBe(gold0 - 50);
  await page.keyboard.press('Escape');

  // Hovering the built tower shows its card; clicking it opens the panel.
  const [x, y] = await tileCenter(page, 3, 3);
  await page.mouse.move(x, y);
  await expect(page.locator('#tower-tooltip .tt-level')).toHaveText('Level 1/3');
  await page.mouse.click(x, y);
  await expect(page.locator('#tower-panel')).toBeVisible();
  await expect(page.locator('#tp-name')).toHaveText('Turret');

  // Upgrade (45g) then sell.
  await page.locator('#tp-upgrade').click();
  await expect(page.locator('#tp-level')).toHaveText('LV 2/3');
  const before = await stat(page, 'gold');
  await page.keyboard.press('s');
  await expect(page.locator('#tower-panel')).toBeHidden();
  await expect.poll(() => stat(page, 'gold')).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('a wave plays out at 3x and Auto Wave counts down to the next one', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.keyboard.press('1');
  for (const [c, r] of [[3, 3], [5, 7]]) await clickTile(page, c, r);
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await expect(page.locator('.speed-btn.active')).toHaveText('3x');

  await page.keyboard.press('Space');
  await expect(page.locator('#stat-wave')).toHaveText('1');
  await expect(page.locator('#start-wave-label')).toContainText('in progress');

  // Cleared: the countdown appears, then wave 2 starts on its own.
  await expect(page.locator('#wave-countdown')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#stat-wave')).toHaveText('2', { timeout: 15_000 });

  // Pause freezes the run.
  await page.keyboard.press('p');
  await expect(page.locator('#overlay-pause')).toBeVisible();
  const gold = await stat(page, 'gold');
  await page.waitForTimeout(1500);
  expect(await stat(page, 'gold')).toBe(gold);
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-pause')).toBeHidden();
  expect(errors).toEqual([]);
});

test('settings persist across reloads', async ({ page }) => {
  await startRun(page);
  await page.keyboard.press('m'); // mute
  await page.keyboard.press('a'); // Auto Wave off
  await page.keyboard.press('f'); // 2x
  await expect(page.locator('#btn-mute')).toHaveClass(/muted/);
  await page.reload();
  await expect(page.locator('#btn-menu-mute')).toHaveText('Sound: Off');
  await expect(page.locator('#btn-menu-autowave')).toHaveText('Auto Wave: Off');
  await expect(page.locator('.speed-btn.active')).toHaveText('2x');
});

test('losing a run shows the summary and records a personal best', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  // No defence, 3x speed, Auto Wave on: the run ends within a few waves.
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await page.keyboard.press('Space');
  await expect(page.locator('#overlay-gameover')).toBeVisible({ timeout: 100_000 });
  await expect(page.locator('#go-best')).toContainText('New best!');
  await page.locator('#btn-gameover-menu').click();
  await expect(page.locator('#menu-record')).toContainText('Best on Switchback: wave');
  expect(errors).toEqual([]);
});

test('resizing keeps the board sharp and clicks on the right tile', async ({ page }) => {
  await startRun(page);
  await page.setViewportSize({ width: 1280, height: 760 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector('#game-container canvas') as HTMLCanvasElement;
        return Math.round(((c.getBoundingClientRect().width * devicePixelRatio) / c.width) * 1000) / 1000;
      }),
    )
    .toBe(1);
  const gold0 = await stat(page, 'gold');
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await page.keyboard.press('Escape');
  await expect.poll(() => stat(page, 'gold')).toBe(gold0 - 50);
  // Clicking the same tile now selects that tower: the click landed where intended.
  await clickTile(page, 3, 3);
  await expect(page.locator('#tp-name')).toHaveText('Turret');
});
