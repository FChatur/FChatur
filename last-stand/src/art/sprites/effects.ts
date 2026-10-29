import { blank, ellipse, fromRows, outlined, placed, ring, set, type Bitmap, type Legend } from '../bitmap';
import { hash2 } from '../noise';
import { COLORS } from '../palette';

/**
 * Short frame animations for combat feedback. They play in real time, so they stay readable at any
 * game speed, and are never scaled or rotated (consistent pixel size everywhere).
 */

const SPARK: Legend = { w: 'white0', y: 'gold4', o: 'gold3', d: 'gold2' };

const HIT_SPARK = [
  ['.......', '...w...', '..wyw..', '.wyWyw.', '..wyw..', '...w...', '.......'],
  ['...o...', '.o.y.o.', '..yWy..', 'oyW.Wyo', '..yWy..', '.o.y.o.', '...o...'],
  ['d..d..d', '.......', '.......', 'd.....d', '.......', '.......', 'd..d..d'],
];

const CRIT: Legend = { w: 'white0', r: 'red3', R: 'red2', y: 'gold3' };

const CRIT_SPARK = [
  ['.........', '....w....', '...wyw...', '..wrWrw..', '.wyW.Wyw.', '..wrWrw..', '...wyw...', '....w....', '.........'],
  ['r...y...r', '.r..r..r.', '..rRwRr..', '..RW.WR..', 'yrw...wry', '..RW.WR..', '..rRwRr..', '.r..r..r.', 'r...y...r'],
  ['R.......R', '....R....', '.........', '.........', 'R.......R', '.........', '.........', '....R....', 'R.......R'],
];

/** A puff of dust for deaths and building: expanding, thinning clouds. */
function dustPuff(w: number, h: number, frames: number, light: number, mid: number, seed: number): Bitmap[] {
  return Array.from({ length: frames }, (_, f) => {
    const b = blank(w, h);
    const t = (f + 1) / frames;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + hash2(i, 1, seed) * 0.6;
      const cx = w / 2 + Math.cos(a) * (w / 2 - 3) * t;
      const cy = h / 2 + Math.sin(a) * (h / 2 - 2) * t;
      const r = 2.6 * (1 - t * 0.55);
      ellipse(b, cx, cy, r, r * 0.85, mid);
      ellipse(b, cx - 0.5, cy - 0.6, r * 0.6, r * 0.5, light);
    }
    // Thin out the last frames with a dither so the cloud dissolves instead of popping.
    if (f >= frames - 2) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y + f) % (f === frames - 1 ? 2 : 3) === 0) set(b, x, y, -1);
    }
    return b;
  });
}

/** Frost burst: ice shards flying out from the hit point. */
function frostBurst(): Bitmap[] {
  const size = 13;
  return [0, 1, 2, 3].map((f) => {
    const b = blank(size, size);
    const c = (size - 1) / 2;
    if (f === 0) {
      ellipse(b, c + 0.5, c + 0.5, 3, 3, COLORS.frost4);
      ellipse(b, c + 0.5, c + 0.5, 1.6, 1.6, COLORS.frost5);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const d = 2 + f * 1.4;
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      set(b, x, y, f < 2 ? COLORS.frost5 : COLORS.frost4);
      if (f < 3) set(b, x - Math.cos(a), y - Math.sin(a), COLORS.frost3);
    }
    // Outlined frames grow by a pixel each side; pad the others so every frame is the same size.
    return f < 2 ? outlined(b, COLORS.frost1) : placed(b, b.w + 2, b.h + 2, 1, 1);
  });
}

/** Heavy ballista impact: a white flash, then a ring of dust and splinters. */
function heavyImpact(): Bitmap[] {
  const size = 17;
  const c = 8;
  return [0, 1, 2, 3].map((f) => {
    const b = blank(size, size);
    if (f === 0) {
      ellipse(b, c + 0.5, c + 0.5, 4, 3.4, COLORS.white0);
      ellipse(b, c + 0.5, c + 0.5, 2.2, 1.8, COLORS.gold4);
      return outlined(b, COLORS.gold2);
    }
    ring(b, c, c, 2 + f * 2, f === 1 ? COLORS.white0 : COLORS.dirt4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f;
      const d = 3 + f * 2.2;
      set(b, c + Math.cos(a) * d, c + Math.sin(a) * d * 0.8, f === 3 ? COLORS.dirt2 : COLORS.dirt3);
    }
    return placed(b, b.w + 2, b.h + 2, 1, 1);
  });
}

/** Explosion sized to a splash radius (art pixels): flash, fireball, smoke. */
export function explosionFrames(radius: number): Bitmap[] {
  const r = Math.max(4, Math.round(radius));
  const size = r * 2 + 3;
  const c = size / 2;
  const stages: [number, number, number][] = [
    [0.45, COLORS.white0, COLORS.gold4],
    [0.75, COLORS.gold3, COLORS.white0],
    [1, COLORS.red3, COLORS.gold3],
    [0.95, COLORS.stone2, COLORS.red3],
    [0.8, COLORS.stone2, COLORS.stone3],
  ];
  return stages.map(([scale, outer, inner], f) => {
    const b = blank(size, size);
    if (f < 3) {
      ellipse(b, c, c, r * scale, r * scale * 0.85, outer);
      ellipse(b, c - r * 0.15, c - r * 0.18, r * scale * 0.55, r * scale * 0.45, inner);
      return b;
    }
    // Smoke: a few round puffs drifting apart, not a dithered disc.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const d = r * (f === 3 ? 0.45 : 0.6);
      const pr = r * (f === 3 ? 0.42 : 0.3);
      const px = c + Math.cos(a) * d;
      const py = c + Math.sin(a) * d * 0.8;
      ellipse(b, px, py, pr, pr * 0.85, outer);
      ellipse(b, px - pr * 0.3, py - pr * 0.3, pr * 0.5, pr * 0.4, inner);
    }
    return b;
  });
}

const COIN: Legend = { y: 'gold3', Y: 'gold4', d: 'gold2', D: 'gold1' };

const COIN_FRAMES = [
  ['.yyy.', 'yYyyd', 'yYydd', 'yyddd', '.ddd.'],
  ['..yd.', '.yYd.', '.yYd.', '.yyd.', '..d..'],
  ['..y..', '..Y..', '..y..', '..d..', '..d..'],
  ['.dy..', '.dYy.', '.dYy.', '.dyy.', '..d..'],
];

const SPARKLE = [
  ['.....', '..w..', '.wWw.', '..w..', '.....'],
  ['..y..', '..w..', 'ywWwy', '..w..', '..y..'],
  ['y...y', '.....', '..w..', '.....', 'y...y'],
];

const SNOWFLAKE = ['.c.', 'cWc', '.c.'];

export function effectFrames(): Record<string, Bitmap[]> {
  return {
    'hit-spark': HIT_SPARK.map((rows) => fromRows(rows, SPARK)),
    'crit-spark': CRIT_SPARK.map((rows) => fromRows(rows, CRIT)),
    'heavy-impact': heavyImpact(),
    'frost-burst': frostBurst(),
    'death-dust': dustPuff(16, 12, 5, COLORS.stone4, COLORS.stone3, 3),
    'build-dust': dustPuff(22, 10, 4, COLORS.dirt4, COLORS.dirt3, 5),
    coin: COIN_FRAMES.map((rows) => outlined(fromRows(rows, COIN))),
    sparkle: SPARKLE.map((rows) => fromRows(rows, { w: 'white0', y: 'gold3' })),
    snowflake: [outlined(fromRows(SNOWFLAKE, { c: 'frost4' }), COLORS.frost1)],
  };
}
