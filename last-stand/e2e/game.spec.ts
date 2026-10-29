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
  await expect(page.locator('#tower-tooltip h3')).toHaveText('Archer Tower');

  // Build with the hotkey and a click. The run's first Archer is free; the shop then shows the full price.
  const archerCost = page.locator('.tower-btn').first().locator('.tower-cost-value');
  await expect(archerCost).toHaveText('Free');
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await expect(archerCost).toHaveText('50');
  expect(await stat(page, 'gold')).toBe(gold0);
  await page.keyboard.press('Escape');

  // Hovering the built tower shows its card; clicking it opens the panel.
  const [x, y] = await tileCenter(page, 3, 3);
  await page.mouse.move(x, y);
  await expect(page.locator('#tower-tooltip .tt-level')).toHaveText('Level 1/3');
  await page.mouse.click(x, y);
  await expect(page.locator('#tower-panel')).toBeVisible();
  await expect(page.locator('#tp-name')).toHaveText('Archer Tower');

  // The free Archer sells for nothing, even after an upgrade (45g).
  await expect(page.locator('#tp-sell-value')).toHaveText('+0g');
  await page.locator('#tp-upgrade').click();
  await expect(page.locator('#tp-level')).toHaveText('LV 2/3');
  await expect(page.locator('#tp-sell-value')).toHaveText('+0g');
  const before = await stat(page, 'gold');
  await page.keyboard.press('s');
  await expect(page.locator('#tower-panel')).toBeHidden();
  expect(await stat(page, 'gold')).toBe(before);
  // Selling it doesn't give the free build back: the next Archer costs 50 and sells normally (70%).
  await expect(archerCost).toHaveText('50');
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await expect.poll(() => stat(page, 'gold')).toBe(before - 50);
  await page.keyboard.press('Escape');
  await clickTile(page, 3, 3);
  await expect(page.locator('#tp-sell-value')).toHaveText('+35g');
  await page.keyboard.press('s');
  await expect.poll(() => stat(page, 'gold')).toBe(before - 50 + 35);
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
  // The first Archer is free; the shop's price changing to 50 shows it was built.
  await expect(page.locator('.tower-btn').first().locator('.tower-cost-value')).toHaveText('50');
  expect(await stat(page, 'gold')).toBe(gold0);
  // Clicking the same tile now selects that tower: the click landed where intended.
  await clickTile(page, 3, 3);
  await expect(page.locator('#tp-name')).toHaveText('Archer Tower');
});

test('keyboard focus on a shop tower shows its tooltip', async ({ page }) => {
  await startRun(page);
  await page.locator('.tower-btn').nth(1).focus();
  await expect(page.locator('#tower-tooltip')).toBeVisible();
  await expect(page.locator('#tower-tooltip h3')).toHaveText('Ballista Tower');
  await expect(page.locator('#tower-tooltip .tt-stats')).toContainText('Global');
});

test('switching away from the tab pauses a running game', async ({ page }) => {
  await startRun(page);
  await expect(page.locator('#overlay-pause')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#overlay-pause')).toBeVisible();
});

test('the board actually renders (grid, path and towers are drawn)', async ({ page }) => {
  await startRun(page);
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  const canvas = page.locator('#game-container canvas');
  const box = (await canvas.boundingBox())!;
  const clip = { x: box.x, y: box.y, width: box.width / 2, height: box.height / 2 };
  // Same region with and without the canvas: a drawn board has far more detail (larger PNG) than
  // the empty background behind it.
  const drawn = await page.screenshot({ clip });
  await canvas.evaluate((c) => ((c as HTMLElement).style.visibility = 'hidden'));
  const blank = await page.screenshot({ clip });
  // Measured ~3x in Chromium; an unrendered board would be ~1x.
  expect(drawn.length).toBeGreaterThan(blank.length * 2);
});

test('the left shop shows each hero, and a tower can be dragged from it onto the map', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await expect(page.locator('.tower-hero')).toHaveText(['Wren', 'Brakk', 'Fen', 'Old Rime']);
  const gold0 = await stat(page, 'gold');
  const card = (await page.locator('.tower-btn').first().boundingBox())!;

  // Dropped on a free tile: built there.
  const [x, y] = await tileCenter(page, 3, 3);
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 6 });
  await expect(page.locator('.tower-btn').first()).toHaveClass(/selected/);
  await page.mouse.up();
  // Built: the free first Archer leaves gold unchanged and the shop now shows the full price.
  await expect(page.locator('.tower-btn').first().locator('.tower-cost-value')).toHaveText('50');
  expect(await stat(page, 'gold')).toBe(gold0);

  // Dropped back on the shop: nothing is built.
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 4 });
  await page.mouse.move(card.x + card.width / 2, card.y + card.height + 40, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.tower-btn').first()).not.toHaveClass(/selected/);
  expect(await stat(page, 'gold')).toBe(gold0);
  await expect(page.locator('.tower-btn').first().locator('.tower-cost-value')).toHaveText('50');
  expect(errors).toEqual([]);
});

test('the shop collapses to a rail that gives the map more room, and stays collapsed', async ({ page }) => {
  await startRun(page);
  const width = () => page.locator('#game-container').evaluate((el) => el.getBoundingClientRect().width);
  const expanded = await width();
  await page.locator('#shop-toggle').click();
  await expect(page.locator('#shop')).toHaveClass(/collapsed/);
  await expect(page.locator('#shop-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(width).toBeGreaterThan(expanded + 100);
  // Click-to-place still works from the rail.
  await page.locator('.tower-btn').first().click();
  await expect(page.locator('.tower-btn').first()).toHaveClass(/selected/);
  await page.reload();
  await expect(page.locator('#shop')).toHaveClass(/collapsed/);
  await page.locator('#shop-toggle').click();
  await expect(page.locator('#shop')).not.toHaveClass(/collapsed/);
});

test('the tower panel previews the next level and changes targeting', async ({ page }) => {
  await startRun(page);
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await page.keyboard.press('Escape');
  await clickTile(page, 3, 3);
  await expect(page.locator('#tp-hero')).toHaveText('Wren · Recruit');
  await expect(page.locator('#tp-next-rank')).toContainText('Veteran');
  await expect(page.locator('#tp-targeting .tgt-btn.active')).toHaveText('First');
  await page.locator('#tp-targeting .tgt-btn', { hasText: 'Strongest' }).click();
  await expect(page.locator('#tp-targeting .tgt-btn.active')).toHaveText('Strongest');
  await page.keyboard.press('t');
  await expect(page.locator('#tp-targeting .tgt-btn.active')).toHaveText('Fastest');
});

test('the free Archer is used once per run and comes back only with a new run', async ({ page }) => {
  await startRun(page);
  const archerCost = page.locator('.tower-btn').first().locator('.tower-cost-value');
  await expect(archerCost).toHaveText('Free');
  await page.keyboard.press('1');
  await clickTile(page, 3, 3);
  await expect(archerCost).toHaveText('50');
  // Selling it and pausing don't bring it back.
  await page.keyboard.press('Escape');
  await clickTile(page, 3, 3);
  await page.keyboard.press('s');
  await page.keyboard.press('p');
  await page.keyboard.press('p');
  await expect(archerCost).toHaveText('50');
  // A new run does.
  await page.keyboard.press('p');
  await page.locator('#btn-pause-restart').click();
  await expect(archerCost).toHaveText('Free');
});
