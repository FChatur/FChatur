import { line, rect, set, type Bitmap } from '../bitmap';
import { COLORS } from '../palette';

/**
 * Building blocks for structures (towers, gate, fences). Regular materials like bricks and planks are
 * generated so they stay consistent; light comes from the upper left.
 */

/** Stone wall: 4 × 2 bricks with mortar lines, a lit top edge and a shaded right edge. */
export function stoneWall(b: Bitmap, x: number, y: number, w: number, h: number, light = true): void {
  rect(b, x, y, w, h, COLORS.stone2);
  for (let row = 0; row < h; row++) {
    const yy = y + row;
    const course = Math.floor(row / 3);
    if (row % 3 === 2) {
      rect(b, x, yy, w, 1, COLORS.stone1);
      continue;
    }
    for (let xx = x + (course % 2 ? 2 : 0); xx < x + w; xx += 4) {
      set(b, xx, yy, COLORS.stone1);
      // Each brick's top-left pixel catches the light.
      if (row % 3 === 0 && xx + 1 < x + w) set(b, xx + 1, yy, COLORS.stone3);
    }
  }
  if (light) rect(b, x, y, w, 1, COLORS.stone3);
  for (let yy = y; yy < y + h; yy++) {
    set(b, x, yy, COLORS.stone3);
    set(b, x + w - 1, yy, COLORS.stone1);
  }
  rect(b, x, y + h - 1, w, 1, COLORS.stone1);
}

/** Horizontal planks, two pixels each, with dark seams. */
export function planks(b: Bitmap, x: number, y: number, w: number, h: number): void {
  for (let row = 0; row < h; row++) rect(b, x, y + row, w, 1, row % 2 ? COLORS.wood2 : COLORS.wood3);
  for (let yy = y; yy < y + h; yy++) set(b, x + w - 1, yy, COLORS.wood1);
}

/** A vertical wooden post, lit on its left side. */
export function post(b: Bitmap, x: number, y: number, h: number, w = 2): void {
  rect(b, x, y, w, h, COLORS.wood2);
  rect(b, x, y, 1, h, COLORS.wood3);
  if (w > 2) rect(b, x + w - 1, y, 1, h, COLORS.wood1);
}

/** Diagonal cross bracing between two posts. */
export function bracing(b: Bitmap, x0: number, y0: number, x1: number, y1: number): void {
  line(b, x0, y0, x1, y1, COLORS.wood1);
  line(b, x0, y1, x1, y0, COLORS.wood1);
}

/** Merlons along the top of a wall: `size` wide, two pixels tall, with equal gaps. */
export function crenellations(b: Bitmap, x: number, y: number, w: number, size = 2): void {
  for (let xx = x; xx < x + w; xx += size * 2) {
    const mw = Math.min(size, x + w - xx);
    rect(b, xx, y, mw, 2, COLORS.stone2);
    rect(b, xx, y, mw, 1, COLORS.stone3);
  }
}

/** A small hanging banner with a pointed bottom and an emblem pixel. */
export function banner(b: Bitmap, x: number, y: number, h: number, cloth: string, emblem = 'gold3'): void {
  rect(b, x, y, 3, h - 1, COLORS[`${cloth}2`]);
  rect(b, x + 2, y, 1, h - 1, COLORS[`${cloth}1`]);
  set(b, x + 1, y + h - 1, COLORS[`${cloth}1`]);
  set(b, x + 1, y + 1, COLORS[emblem]);
  rect(b, x - 1, y - 1, 5, 1, COLORS.wood1);
}

/** Leafy clump (bushes, canopies): a rough blob shaded with the leaf ramp. */
export function leafClump(b: Bitmap, cx: number, cy: number, rx: number, ry: number, seed = 1): void {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1 + (rnd() - 0.5) * 0.35) continue;
      const lit = -nx * 0.6 - ny * 0.8;
      const noise = rnd() * 0.5 - 0.25;
      const v = lit + noise;
      set(b, x, y, v > 0.75 ? COLORS.leaf5 : v > 0.4 ? COLORS.leaf4 : v > 0 ? COLORS.leaf3 : v > -0.45 ? COLORS.leaf2 : COLORS.leaf1);
    }
  }
}
