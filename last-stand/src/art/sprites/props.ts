import { blank, ellipse, outlined, rect, set, type Bitmap } from '../bitmap';
import { seeded } from '../noise';
import { COLORS } from '../palette';
import { shadedEllipse } from '../shapes';
import { leafClump } from './build';

/** Scenery around the playable clearing: trees, bushes, rocks and stumps. Never placed on the road. */

/** A broadleaf tree: trunk and a rounded canopy, outlined in deep green so foliage stays soft. */
export function tree(seed: number): Bitmap {
  const r = seeded(seed);
  const b = blank(22, 26);
  const trunkX = 9 + Math.round(r() * 2 - 1);
  rect(b, trunkX, 15, 4, 9, COLORS.wood2);
  rect(b, trunkX, 15, 1, 9, COLORS.wood3);
  rect(b, trunkX + 3, 15, 1, 9, COLORS.wood1);
  set(b, trunkX - 1, 23, COLORS.wood1);
  set(b, trunkX + 4, 23, COLORS.wood1);
  leafClump(b, 11, 9, 9.5 + r(), 8.5, seed * 3 + 1);
  leafClump(b, 7, 11, 5, 4, seed * 5 + 2);
  leafClump(b, 15, 11, 5, 4, seed * 7 + 3);
  // A few highlight leaves on the lit side.
  for (let i = 0; i < 6; i++) set(b, 6 + Math.floor(r() * 7), 3 + Math.floor(r() * 5), COLORS.leaf5);
  // Some trees carry fruit or blossom, for small dots of colour in the forest.
  const fruit = [COLORS.red3, COLORS.gold3, COLORS.pink2][Math.floor(r() * 3)];
  if (r() < 0.4) for (let i = 0; i < 4; i++) set(b, 5 + Math.floor(r() * 12), 6 + Math.floor(r() * 8), fruit);
  return outlined(b, COLORS.leaf0);
}

/** A pine: stacked triangular tiers of dark needles. */
export function pine(seed: number): Bitmap {
  const r = seeded(seed);
  const b = blank(15, 27);
  rect(b, 6, 21, 3, 5, COLORS.wood1);
  rect(b, 6, 21, 1, 5, COLORS.wood2);
  const tiers = [
    [7.5, 3, 3],
    [7.5, 8, 5],
    [7.5, 13, 6],
    [7.5, 18, 7],
  ];
  for (const [cx, top, half] of tiers) {
    for (let y = 0; y < 6; y++) {
      const w = Math.round((half * (y + 1)) / 6);
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w - 1); x++) {
        const lit = x < cx - w / 3 ? COLORS.leaf3 : x > cx + w / 3 ? COLORS.leaf1 : COLORS.leaf2;
        set(b, x, top + y, lit);
      }
    }
  }
  set(b, 7, 2, COLORS.leaf3);
  for (let i = 0; i < 4; i++) set(b, 4 + Math.floor(r() * 4), 6 + Math.floor(r() * 14), COLORS.leaf4);
  return outlined(b, COLORS.leaf0);
}

export function bush(seed: number): Bitmap {
  const r = seeded(seed);
  const b = blank(12, 9);
  leafClump(b, 6, 5, 5.5, 3.8, seed);
  if (r() < 0.5) for (let i = 0; i < 3; i++) set(b, 2 + Math.floor(r() * 8), 2 + Math.floor(r() * 5), r() < 0.5 ? COLORS.red3 : COLORS.white0);
  return outlined(b, COLORS.leaf0);
}

export function rock(seed: number, size: 'small' | 'large'): Bitmap {
  const r = seeded(seed);
  const [w, h] = size === 'small' ? [8, 6] : [14, 10];
  const b = blank(w, h);
  shadedEllipse(b, w / 2, h / 2 + 0.5, w / 2 - 0.2, h / 2 - 0.4, 'stone', 2, 1.4);
  // A crack and a bit of moss on top.
  if (size === 'large') {
    set(b, Math.floor(w / 2), Math.floor(h / 2), COLORS.stone0);
    set(b, Math.floor(w / 2) + 1, Math.floor(h / 2) + 1, COLORS.stone0);
  }
  for (let i = 0; i < (size === 'small' ? 2 : 4); i++) set(b, 2 + Math.floor(r() * (w - 5)), 1 + Math.floor(r() * 2), COLORS.grass4);
  return outlined(b);
}

export function stump(seed: number): Bitmap {
  const b = blank(8, 7);
  rect(b, 1, 2, 6, 4, COLORS.wood2);
  rect(b, 1, 2, 1, 4, COLORS.wood3);
  rect(b, 6, 2, 1, 4, COLORS.wood1);
  ellipse(b, 4, 2, 3, 1.5, COLORS.dirt3);
  set(b, 4, 2, COLORS.wood2);
  if (seed % 2) set(b, 0, 5, COLORS.wood1);
  return outlined(b);
}
