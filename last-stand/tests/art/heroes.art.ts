/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { blank, blit, ellipse, set, type Bitmap } from '../../src/art/bitmap';
import { textBitmap } from '../../src/art/font';
import { COLORS } from '../../src/art/palette';
import { heroArt, heroTower, type HeroAnim, type TowerKind } from '../../src/art/sprites/characters';
import { hash2, valueNoise } from '../../src/art/noise';
import { combatStill } from './combat';
import { encodeApng, encodePng } from './png';

// `npm run art`: hero character mockups for issue #2 (lineup, upgrade stages, animations, portraits).

const KINDS: TowerKind[] = ['basic', 'sniper', 'rapid', 'frost'];
const NAMES: Record<TowerKind, string> = { basic: 'WREN  ARCHER', sniper: 'BRAKK  BALLISTA', rapid: 'FEN  RANGER', frost: 'OLD RIME  FROST MAGE' };

/** Calm meadow ground for presentation sheets: the base grass tone with light texture, no flowers. */
function meadow(w: number, h: number, seed = 3): Bitmap {
  const b = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x, y, seed);
      const patch = valueNoise(x, y, 18, seed);
      set(b, x, y, n > 0.97 ? COLORS.grass4 : n < 0.04 ? COLORS.grass2 : patch > 0.62 ? COLORS.grass4 : COLORS.grass3);
    }
  }
  return b;
}

function shadow(img: Bitmap, cx: number, base: number, w: number): void {
  const s = blank(img.w, img.h);
  ellipse(s, cx, base - 1, w / 2, Math.max(1.5, w / 6), 1);
  for (let i = 0; i < img.data.length; i += 4) {
    if (s.data[i + 3] === 0) continue;
    img.data[i] *= 0.66;
    img.data[i + 1] *= 0.66;
    img.data[i + 2] *= 0.74;
  }
}

/** Places a tower picture so its pedestal's bottom-centre is at (cx, base). */
function stand(img: Bitmap, art: Bitmap, cx: number, base: number): void {
  shadow(img, cx, base, 18);
  blit(img, art, Math.round(cx - art.w / 2), base - art.h);
}

function label(img: Bitmap, text: string, cx: number, y: number, color: number = COLORS.white0): void {
  const t = textBitmap(text, color);
  blit(img, t, Math.round(cx - t.w / 2), y);
}

/** One animation reel: idle, attack, alarm, victory. */
function reel(kind: TowerKind, level: number): { frames: Bitmap[]; delays: number[] } {
  const art = heroArt()[kind].frames[level - 1];
  const seq: [HeroAnim, number, number][] = [];
  for (let i = 0; i < 2; i++) art.idle.forEach((_, f) => seq.push(['idle', f, f === 2 ? 140 : 380]));
  const shot = kind === 'sniper' ? [420, 260, 520] : kind === 'rapid' ? [90, 110] : [300, 260];
  for (let i = 0; i < (kind === 'rapid' ? 4 : 2); i++) art.attack.forEach((_, f) => seq.push(['attack', f, shot[f] ?? 200]));
  for (let i = 0; i < 3; i++) art.alarm.forEach((_, f) => seq.push(['alarm', f, 120]));
  for (let i = 0; i < 3; i++) art.victory.forEach((_, f) => seq.push(['victory', f, 220]));
  const W = 36;
  const H = 46;
  const ground = meadow(W, H, 9);
  const frames = seq.map(([anim, f]) => {
    const img = blit(blank(W, H), ground, 0, 0);
    stand(img, heroTower(kind, level, anim, f, 1), W / 2, H - 4);
    return img;
  });
  return { frames, delays: seq.map(([, , d]) => d) };
}

it('hero mockups', () => {
  const out = process.env.ART_OUT ?? 'art-preview';
  mkdirSync(out, { recursive: true });

  // Lineup: the four heroes at level 3 side by side.
  const lineup = meadow(176, 56);
  KINDS.forEach((k, i) => {
    const cx = 22 + i * 44;
    stand(lineup, heroTower(k, 3), cx, 48);
    label(lineup, NAMES[k].split('  ')[0], cx, 1);
  });
  writeFileSync(`${out}/heroes-lineup-4x.png`, encodePng(lineup, 4));
  writeFileSync(`${out}/heroes-lineup-10x.png`, encodePng(lineup, 10));

  // Upgrade stages: one row per hero, levels 1 to 3.
  const ROW = 62;
  const stages = meadow(150, 4 * ROW);
  KINDS.forEach((k, r) => {
    const top = r * ROW;
    label(stages, NAMES[k], 75, top + 2);
    [1, 2, 3].forEach((level, i) => {
      const cx = 28 + i * 47;
      stand(stages, heroTower(k, level), cx, top + 50);
      label(stages, `LV ${level}`, cx, top + 52, COLORS.gold4);
    });
  });
  writeFileSync(`${out}/heroes-stages.png`, encodePng(stages, 5));

  // Every pose side by side at level 2: idle, attack, alarm, victory.
  const ANIMS: HeroAnim[] = ['idle', 'attack', 'alarm', 'victory'];
  const poses = meadow(4 * 42, 4 * 46);
  KINDS.forEach((k, r) => {
    ANIMS.forEach((anim, c) => {
      const n = heroArt()[k].frames[1][anim].length;
      stand(poses, heroTower(k, 2, anim, n - 1), c * 42 + 21, r * 46 + 42);
      if (r === 0) label(poses, anim.toUpperCase(), c * 42 + 21, 1);
    });
  });
  writeFileSync(`${out}/heroes-poses.png`, encodePng(poses, 6));

  // Animated reels (APNG) at level 1 and 3, enlarged.
  for (const k of KINDS) {
    for (const level of [1, 3]) {
      const { frames, delays } = reel(k, level);
      writeFileSync(`${out}/anim-${k}-lv${level}.png`, encodeApng(frames, delays, 8));
    }
  }

  writeFileSync(`${out}/heroes-combat-4x.png`, encodePng(combatStill(), 4));
  writeFileSync(`${out}/heroes-combat-wide-4x.png`, encodePng(combatStill(18), 4));

  // Shop card portraits: the hero at level 1 on a meadow tile, plus a small icon for the collapsed rail.
  for (const k of KINDS) {
    const p = meadow(34, 40, 21);
    stand(p, heroTower(k, 1), 17, 37);
    writeFileSync(`${out}/card-${k}.png`, encodePng(p, 3));
    writeFileSync(`${out}/mini-${k}.png`, encodePng(p, 2));
    writeFileSync(`${out}/ghost-${k}.png`, encodePng(heroTower(k, 1), 4));
    for (const level of [1, 2, 3]) {
      const q = meadow(34, 44, 21);
      stand(q, heroTower(k, level), 17, 41);
      writeFileSync(`${out}/lvl-${k}-${level}.png`, encodePng(q, 2));
    }
  }
});
