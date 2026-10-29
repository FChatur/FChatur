import { set, type Bitmap } from './bitmap';
import { shade, type Ramp } from './palette';

/**
 * Shaded primitives for building larger sprites. Light comes from the upper left (see the visual
 * specification); surfaces are banded into ramp steps, which reads as pixel-art shading rather than a
 * smooth gradient.
 */
const LIGHT = (() => {
  const l = [-0.55, -0.65, 0.52];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();

/** Ramp index for a surface normal (nx, ny pointing out of the shape in the image plane). */
function litIndex(nx: number, ny: number, base: number, spread: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  // dot ranges roughly -0.7..1; map to -spread..+spread steps around `base`.
  return base + Math.round((dot - 0.45) * spread * 1.6);
}

/** Filled ellipse shaded as a dome. `base` is the ramp index of the mid tone. */
export function shadedEllipse(b: Bitmap, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, base: number, spread = 1): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      set(b, x, y, shade(ramp, litIndex(nx * 0.9, ny * 0.9, base, spread)));
    }
  }
}

/** Filled box shaded as a cylinder lying along y (lit left edge, dark right edge). */
export function shadedColumn(b: Bitmap, x: number, y: number, w: number, h: number, ramp: Ramp, base: number): void {
  for (let xx = x; xx < x + w; xx++) {
    const t = w <= 1 ? 0 : (xx - x) / (w - 1); // 0 = left (lit), 1 = right (shadow)
    const index = t < 0.3 ? base + 1 : t > 0.75 ? base - 1 : base;
    for (let yy = y; yy < y + h; yy++) set(b, xx, yy, shade(ramp, index));
  }
}
