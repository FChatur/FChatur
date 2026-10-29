import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SOUNDTRACK, type SoundtrackManifest } from '../src/config/audio';
import { startRun, trackErrors } from './helpers';

/** The soundtrack files can be withheld from the repository while licensing is checked (docs/AUDIO.md). */
const soundtrackPresent = existsSync(`public/audio/music/${SOUNDTRACK.id}/${SOUNDTRACK.chunks[0].file}.ogg`);
const WITHHELD = 'Soundtrack files withheld from the repository pending licensing (docs/AUDIO.md section 4).';

/** Counts audio contexts the page creates, and remembers which audio files it requests. */
async function watchAudio(page: Page): Promise<string[]> {
  await page.addInitScript(() => {
    const w = window as unknown as { __contexts: number; AudioContext: typeof AudioContext };
    w.__contexts = 0;
    const Native = w.AudioContext;
    w.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__contexts++;
      }
    };
  });
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/audio/')) requests.push(r.url());
  });
  return requests;
}

/** Which soundtrack formats this browser's decoder handles. */
async function decodableFormats(page: Page, t: SoundtrackManifest): Promise<string[]> {
  return page.evaluate(async (t) => {
    const ok: string[] = [];
    for (const fmt of ['ogg', 'mp4']) {
      const bytes = await (await fetch(`audio/music/${t.id}/${t.chunks[0].file}.${fmt}`)).arrayBuffer();
      try {
        await new OfflineAudioContext(2, 128, 44100).decodeAudioData(bytes);
        ok.push(fmt);
      } catch {
        // Not supported here.
      }
    }
    return ok;
  }, t);
}

test('no audio before the first interaction; Play starts the music', async ({ page, browserName }) => {
  const errors = trackErrors(page);
  const requests = await watchAudio(page);
  await page.goto('/');
  await expect(page.locator('#overlay-menu')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __contexts: number }).__contexts)).toBe(0);
  await expect(page.locator('body')).toHaveAttribute('data-audio', 'locked');
  expect(requests).toEqual([]);

  if (!soundtrackPresent) {
    // Without the music files the game still unlocks audio (sound effects) and never requests music.
    await expect(page.locator('#menu-credits')).toBeHidden();
    await page.locator('#btn-play').click();
    await expect(page.locator('body')).not.toHaveAttribute('data-audio', 'locked');
    await expect(page.locator('body')).toHaveAttribute('data-music', 'unavailable');
    await page.waitForTimeout(1000);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    return;
  }

  const formats = await decodableFormats(page, SOUNDTRACK);
  test.skip(
    browserName === 'webkit' && formats.length === 0,
    'This Linux WebKit build has no Opus or AAC decoder (Safari has both); the music cannot be tested here.',
  );
  expect(formats.length).toBeGreaterThan(0);

  await page.locator('#btn-play').click();
  await expect(page.locator('body')).not.toHaveAttribute('data-audio', 'locked');
  await expect(page.locator('body')).toHaveAttribute('data-music', 'playing');
  expect(formats).toContain(await page.locator('body').getAttribute('data-music-format'));
  // Lazy loading: only the first chunks are fetched at the start, not the whole track.
  expect(requests.length).toBeLessThan(SOUNDTRACK.chunks.length / 2);

  // Back to the menu: the music stops.
  await page.keyboard.press('Escape');
  await page.locator('#btn-pause-menu').click();
  await expect(page.locator('body')).toHaveAttribute('data-music', 'off');
  expect(errors).toEqual([]);
});

test('volume sliders and mute persist across reloads, in the menu and the pause menu', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const music = page.locator('#vol-menu-music');
  const master = page.locator('#vol-menu-master');
  await expect(music).toHaveValue('75');
  await expect(master).toHaveValue('80');
  await music.focus();
  await page.keyboard.press('Home');
  await master.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(music).toHaveValue('0');
  await expect(master).toHaveValue('75');
  await expect(page.locator('#overlay-menu output').first()).toHaveText('75%');
  await page.locator('#btn-menu-mute').click();
  await expect(page.locator('#btn-menu-mute')).toHaveText('Sound: Off');

  await page.reload();
  await expect(page.locator('#vol-menu-music')).toHaveValue('0');
  await expect(page.locator('#vol-menu-master')).toHaveValue('75');
  await expect(page.locator('#vol-menu-sfx')).toHaveValue('100');
  await expect(page.locator('#btn-menu-mute')).toHaveText('Sound: Off');

  // The pause menu shows the same settings and can change them during a run.
  await startRun(page);
  await page.keyboard.press('p');
  await expect(page.locator('#overlay-pause')).toBeVisible();
  await expect(page.locator('#vol-pause-master')).toHaveValue('75');
  await expect(page.locator('#vol-pause-mute')).toHaveText('Sound: Off');
  await page.locator('#vol-pause-mute').click();
  await expect(page.locator('#btn-mute')).not.toHaveClass(/muted/);
  await page.locator('#vol-pause-sfx').focus();
  await page.keyboard.press('ArrowLeft'); // a slider keeps its arrow keys; the game is still paused
  await expect(page.locator('#vol-pause-sfx')).toHaveValue('99');
  await expect(page.locator('#overlay-pause')).toBeVisible();
  expect(errors).toEqual([]);
});

test('soundtrack chunks join seamlessly with this browser’s own decoders', async ({ page, browserName }) => {
  test.skip(!soundtrackPresent, WITHHELD);
  await page.goto('/');
  const formats = await decodableFormats(page, SOUNDTRACK);
  test.skip(browserName === 'webkit' && formats.length === 0, 'No Opus or AAC decoder in this WebKit build.');
  expect(formats.length).toBeGreaterThan(0);
  const t = SOUNDTRACK;
  const last = t.chunks.length - 1;
  // Intro into the loop, inside the loop, and the loop wrapping back to its start.
  const joins: [number, number][] = [
    [t.loopChunk - 1, t.loopChunk],
    [t.loopChunk, t.loopChunk + 1],
    [last, t.loopChunk],
  ];
  for (const fmt of formats) {
    const results = await page.evaluate(
      async ({ t, fmt, joins }) => {
        const SR = 44100;
        const X = 0.005;
        const margin = t.margin / SR;
        const out = [];
        for (const [a, b] of joins) {
          const ctx = new OfflineAudioContext(2, SR, SR); // 1 s around the join at 0.5 s
          const load = async (i: number) =>
            ctx.decodeAudioData(await (await fetch(`audio/music/${t.id}/${t.chunks[i].file}.${fmt}`)).arrayBuffer());
          const [ba, bb] = [await load(a), await load(b)];
          // Chunk a's core ends at 0.5 s and chunk b's core starts there, with the game's crossfade.
          const coreA = t.chunks[a].length / SR;
          const srcA = ctx.createBufferSource();
          srcA.buffer = ba;
          const gA = ctx.createGain();
          gA.gain.setValueAtTime(1, 0.5);
          gA.gain.linearRampToValueAtTime(0, 0.5 + X);
          srcA.connect(gA).connect(ctx.destination);
          srcA.start(0, margin + coreA - 0.5, 0.5 + X);
          const srcB = ctx.createBufferSource();
          srcB.buffer = bb;
          const gB = ctx.createGain();
          gB.gain.setValueAtTime(0, 0.5 - X);
          gB.gain.linearRampToValueAtTime(1, 0.5);
          srcB.connect(gB).connect(ctx.destination);
          srcB.start(0.5 - X, margin - X, 0.5 + X);
          const data = (await ctx.startRendering()).getChannelData(0);
          const d2 = (k: number) => Math.abs(data[k + 1] - 2 * data[k] + data[k - 1]);
          let join = 0;
          let elsewhere = 0;
          let zeroRun = 0;
          let gap = false;
          for (let k = 1; k < data.length - 1; k++) {
            if (Math.abs(k - SR / 2) < 300) join = Math.max(join, d2(k));
            else elsewhere = Math.max(elsewhere, d2(k));
            zeroRun = Math.abs(data[k]) < 1e-6 ? zeroRun + 1 : 0;
            if (zeroRun >= 32 && k > 2000 && k < data.length - 2000) gap = true;
          }
          // Alignment: just after the join, chunk b must match chunk a's own continuation (its trailing
          // margin is the same audio). Aligned: ~0.995; a 0.5 ms decoder offset drops this to ~0.6.
          const render = async (i: number, offset: number) => {
            const c = new OfflineAudioContext(1, SR / 5, SR);
            const src = c.createBufferSource();
            src.buffer = await c.decodeAudioData(await (await fetch(`audio/music/${t.id}/${t.chunks[i].file}.${fmt}`)).arrayBuffer());
            src.connect(c.destination);
            src.start(0, offset, 0.2);
            return (await c.startRendering()).getChannelData(0);
          };
          const x = await render(a, margin + coreA);
          const y = await render(b, margin);
          let xy = 0;
          let xx = 0;
          let yy = 0;
          for (let k = 0; k < x.length; k++) {
            xy += x[k] * y[k];
            xx += x[k] * x[k];
            yy += y[k] * y[k];
          }
          out.push({ a, b, join, elsewhere, gap, aligned: xy / Math.sqrt(xx * yy) });
        }
        return out;
      },
      { t, fmt, joins },
    );
    for (const r of results) {
      expect(r.gap, `${fmt} ${r.a}→${r.b}: silent gap`).toBe(false);
      expect(r.aligned, `${fmt} ${r.a}→${r.b}: continuation correlation`).toBeGreaterThan(0.95);
      // A click would stand out above everything else in that second of music.
      expect(r.join, `${fmt} ${r.a}→${r.b}: join ${r.join.toFixed(4)} vs music ${r.elsewhere.toFixed(4)}`).toBeLessThan(r.elsewhere * 1.25);
    }
  }
});
