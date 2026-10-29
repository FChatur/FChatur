import { COLORS, INK } from './palette';

/**
 * A small RGBA image at art resolution (one element per art pixel). Pure data, no DOM: the game turns
 * bitmaps into textures, and Node tools turn them into PNGs for review.
 */
export interface Bitmap {
  readonly w: number;
  readonly h: number;
  /** RGBA, row-major, w * h * 4 bytes. */
  readonly data: Uint8ClampedArray;
}

export function blank(w: number, h: number): Bitmap {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function clone(b: Bitmap): Bitmap {
  return { w: b.w, h: b.h, data: new Uint8ClampedArray(b.data) };
}

/** Colour (0xRRGGBB) at a pixel, or -1 if transparent or outside. */
export function get(b: Bitmap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
  const i = (y * b.w + x) * 4;
  if (b.data[i + 3] === 0) return -1;
  return (b.data[i] << 16) | (b.data[i + 1] << 8) | b.data[i + 2];
}

/** Sets an opaque pixel (alpha 255) or clears it with color -1. Ignores pixels outside the bitmap. */
export function set(b: Bitmap, x: number, y: number, color: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  if (color < 0) {
    b.data[i] = b.data[i + 1] = b.data[i + 2] = b.data[i + 3] = 0;
    return;
  }
  b.data[i] = (color >> 16) & 255;
  b.data[i + 1] = (color >> 8) & 255;
  b.data[i + 2] = color & 255;
  b.data[i + 3] = 255;
}

export const opaque = (b: Bitmap, x: number, y: number): boolean => get(b, x, y) >= 0;

/** Legend: one character per palette colour name; '.' and ' ' are always transparent. */
export type Legend = Readonly<Record<string, string>>;

/** Shared legend entries every sprite may use. */
const BASE_LEGEND: Legend = { k: 'ink0', K: 'ink1', W: 'white0' };

/**
 * Parses a hand-drawn sprite: rows of characters, each mapped to a palette colour by the legend.
 * All rows must have the same length.
 */
export function fromRows(rows: readonly string[], legend: Legend = {}): Bitmap {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const b = blank(w, h);
  const map = { ...BASE_LEGEND, ...legend };
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Sprite row ${y} is ${row.length} wide, expected ${w}: "${row}"`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const name = map[ch];
      if (!name) throw new Error(`No legend entry for "${ch}" (row ${y}: "${row}")`);
      const color = COLORS[name];
      if (color === undefined) throw new Error(`Unknown palette colour "${name}"`);
      set(b, x, y, color);
    }
  });
  return b;
}

export function flipX(b: Bitmap): Bitmap {
  const out = blank(b.w, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) set(out, b.w - 1 - x, y, get(b, x, y));
  return out;
}

/** Copies the opaque pixels of `src` onto `dst` with its top-left corner at (x, y). */
export function blit(dst: Bitmap, src: Bitmap, x: number, y: number): Bitmap {
  for (let sy = 0; sy < src.h; sy++) {
    for (let sx = 0; sx < src.w; sx++) {
      const c = get(src, sx, sy);
      if (c >= 0) set(dst, x + sx, y + sy, c);
    }
  }
  return dst;
}

/** A new bitmap of the given size with `src` placed at (x, y). */
export function placed(src: Bitmap, w: number, h: number, x: number, y: number): Bitmap {
  return blit(blank(w, h), src, x, y);
}

/**
 * Adds a one-pixel outline around every opaque pixel (4-neighbourhood) in empty space.
 * The bitmap grows by one pixel on each side so the outline always fits.
 */
export function outlined(b: Bitmap, color: number = INK): Bitmap {
  const out = placed(b, b.w + 2, b.h + 2, 1, 1);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (opaque(out, x, y)) continue;
      // (x, y) in `out` is (x - 1, y - 1) in `b`; outline it if any 4-neighbour there is opaque.
      const bx = x - 1;
      const by = y - 1;
      if (opaque(b, bx - 1, by) || opaque(b, bx + 1, by) || opaque(b, bx, by - 1) || opaque(b, bx, by + 1)) {
        set(out, x, y, color);
      }
    }
  }
  return out;
}

/** Recolours every pixel of one colour to another (e.g. palette swaps for levels). */
export function recolor(b: Bitmap, from: number, to: number): Bitmap {
  const out = clone(b);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (get(b, x, y) === from) set(out, x, y, to);
  return out;
}

// ---------------------------------------------------------------- drawing primitives

export function rect(b: Bitmap, x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(b, xx, yy, color);
}

/** Bresenham line, endpoints included. */
export function line(b: Bitmap, x0: number, y0: number, x1: number, y1: number, color: number): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(b, x0, y0, color);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Filled ellipse centred at (cx, cy) (half-pixel centres allowed), radii rx, ry. */
export function ellipse(b: Bitmap, cx: number, cy: number, rx: number, ry: number, color: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) set(b, x, y, color);
    }
  }
}

/** One-pixel ring of radius r (midpoint circle) centred on pixel (cx, cy). */
export function ring(b: Bitmap, cx: number, cy: number, r: number, color: number): void {
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    for (const [px, py] of [
      [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y],
    ]) {
      set(b, cx + px, cy + py, color);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Number of opaque pixels (tests and tools). */
export function coverage(b: Bitmap): number {
  let n = 0;
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i] > 0) n++;
  return n;
}
