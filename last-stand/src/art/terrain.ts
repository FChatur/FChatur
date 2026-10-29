import { blank, blit, ellipse, get, rect, set, type Bitmap } from './bitmap';
import { hash2, seeded, valueNoise } from './noise';
import { COLORS } from './palette';
import { bush, groundShadow, pine, rock, stump, tree } from './sprites/props';

/** Art pixels per tile (docs/VISUAL_PROTOTYPE.md: 16 × 16). */
export const ART_TILE = 16;

export interface TerrainSpec {
  cols: number;
  rows: number;
  /** Tiles of scenery painted around the playable map on every side. */
  margin: number;
  /**
   * The road's centreline in art pixels, relative to the map's top-left corner. The first point is
   * where enemies appear and the last where they leave; both normally lie just outside the map.
   */
  road: readonly { x: number; y: number }[];
  seed: number;
}

export interface Terrain {
  image: Bitmap;
  /** Position of the map's top-left corner within `image`, in art pixels. */
  originX: number;
  originY: number;
}

/** Half-width of the road in art pixels before edge noise. Path tiles are 16 wide. */
const ROAD_HALF = 6.5;

/**
 * Paints the battlefield: grass with patches and tufts, a worn dirt road along the path with uneven edges
 * and ruts, flowers in the clearing, and trees, bushes and rocks framing it outside the playable area.
 * The road's entrance gets a cave mouth and its exit a palisade gate. Map-agnostic: everything is derived
 * from the map size and the road, so any map gets the same treatment.
 */
export function paintTerrain(spec: TerrainSpec): Terrain {
  const { cols, rows, margin, seed } = spec;
  const ox = margin * ART_TILE;
  const oy = margin * ART_TILE;
  const W = (cols + margin * 2) * ART_TILE;
  const H = (rows + margin * 2) * ART_TILE;
  const img = blank(W, H);
  const road = spec.road.map((p) => ({ x: p.x + ox, y: p.y + oy }));
  const inMap = (x: number, y: number) => x >= ox && y >= oy && x < ox + cols * ART_TILE && y < oy + rows * ART_TILE;
  /** Pixels outside the playable map (0 inside), for fading the clearing into the forest floor. */
  const outside = (x: number, y: number) =>
    Math.max(0, ox - x, x - (ox + cols * ART_TILE - 1), oy - y, y - (oy + rows * ART_TILE - 1));
  const roadDist = (x: number, y: number) => distanceToPolyline(x + 0.5, y + 0.5, road);

  // Ground: grass everywhere, dirt where the road runs.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = roadDist(x, y);
      const half = ROAD_HALF + (valueNoise(x, y, 5, seed) - 0.5) * 2.2;
      if (d <= half) {
        set(img, x, y, dirtColor(x, y, d, half, seed));
      } else if (d <= half + 1) {
        set(img, x, y, COLORS.grass2);
      } else {
        set(img, x, y, grassColor(x, y, seed, outside(x, y)));
      }
    }
  }

  // Small, flat details: grass tufts everywhere off the road, flowers mostly in the clearing.
  const rnd = seeded(seed * 31 + 7);
  for (let ty = 0; ty < rows + margin * 2; ty++) {
    for (let tx = 0; tx < cols + margin * 2; tx++) {
      for (let i = 0; i < 3; i++) {
        const x = tx * ART_TILE + Math.floor(rnd() * 14) + 1;
        const y = ty * ART_TILE + Math.floor(rnd() * 13) + 2;
        if (roadDist(x, y) < ROAD_HALF + 3) continue;
        if (rnd() < 0.55) tuft(img, x, y);
      }
      const fx = tx * ART_TILE + Math.floor(rnd() * 10) + 3;
      const fy = ty * ART_TILE + Math.floor(rnd() * 10) + 3;
      if (roadDist(fx, fy) > ROAD_HALF + 4 && rnd() < (inMap(fx, fy) ? 0.22 : 0.1)) flowers(img, fx, fy, rnd);
    }
  }

  // Entrance and exit structures.
  if (road.length >= 2) {
    cave(img, road[0], road[1], seed);
    gate(img, road[road.length - 1], road[road.length - 2], W, H);
  }

  // Scenery props outside the clearing, painted back to front.
  const props: { x: number; y: number; art: Bitmap; shadow: number }[] = [];
  const pr = seeded(seed * 17 + 3);
  const mapRect = { x0: ox - 2, y0: oy - 2, x1: ox + cols * ART_TILE + 2, y1: oy + rows * ART_TILE + 2 };
  const step = 13;
  for (let gy = 0; gy < H + step; gy += step) {
    for (let gx = 0; gx < W + step; gx += step) {
      const x = gx + Math.floor(pr() * step);
      const y = gy + Math.floor(pr() * step);
      const outside = Math.max(mapRect.x0 - x, x - mapRect.x1, mapRect.y0 - y, y - mapRect.y1);
      if (outside < 6) continue;
      // Denser further from the clearing.
      if (pr() > Math.min(0.85, 0.25 + outside / 70)) continue;
      const roll = pr();
      const art =
        roll < 0.38 ? tree(Math.floor(pr() * 1000)) :
        roll < 0.6 ? pine(Math.floor(pr() * 1000)) :
        roll < 0.78 ? bush(Math.floor(pr() * 1000)) :
        roll < 0.93 ? rock(Math.floor(pr() * 1000), pr() < 0.5 ? 'small' : 'large') :
        stump(Math.floor(pr() * 1000));
      const left = x - Math.floor(art.w / 2);
      const top = y - art.h;
      // Keep the clearing and the road free.
      if (left < mapRect.x1 && left + art.w > mapRect.x0 && top < mapRect.y1 && y > mapRect.y0) continue;
      if (minRoadDistance(left, top, art.w, art.h, roadDist) < ROAD_HALF + 4) continue;
      props.push({ x: left, y: top, art, shadow: art.h > 14 ? COLORS.grass1 : COLORS.grass2 });
    }
  }
  props.sort((a, b) => a.y + a.art.h - (b.y + b.art.h));
  for (const p of props) {
    groundShadow(img, p.x + p.art.w / 2, p.y + p.art.h, p.art.w * 0.8, p.shadow);
    blit(img, p.art, p.x, p.y);
  }

  return { image: img, originX: ox, originY: oy };
}

function grassColor(x: number, y: number, seed: number, outside: number): number {
  // Gentle patches: mostly the base tone, with soft dithered borders instead of hard blobs.
  const patch = valueNoise(x, y, 14, seed + 1) + (hash2(x, y, seed + 6) - 0.5) * 0.12;
  const n = hash2(x, y, seed + 2);
  let tone = patch > 0.7 ? 2 : patch < 0.27 ? 4 : 3;
  // Beyond the playable clearing the forest floor darkens gradually (dithered over ~2 tiles).
  if (outside > 0 && hash2(x, y, seed + 8) < Math.min(1, outside / 28)) tone -= 1;
  if (n > 0.986) tone += 1;
  else if (n < 0.018) tone -= 1;
  return COLORS[`grass${Math.max(1, Math.min(5, tone))}`];
}

function dirtColor(x: number, y: number, d: number, half: number, seed: number): number {
  if (d > half - 1) return COLORS.dirt1;
  const n = hash2(x, y, seed + 4);
  if (n > 0.993) return COLORS.stone3;
  if (n < 0.006) return COLORS.dirt0;
  // Two worn ruts either side of the centre.
  if (Math.abs(d - 3.2) < 0.55 && hash2(x, y, seed + 5) > 0.35) return COLORS.dirt1;
  const q = valueNoise(x, y, 6, seed + 3);
  return q > 0.68 ? COLORS.dirt3 : q < 0.28 ? COLORS.dirt1 : COLORS.dirt2;
}

function tuft(b: Bitmap, x: number, y: number): void {
  if (get(b, x, y) < 0) return;
  set(b, x - 1, y + 1, COLORS.grass2);
  set(b, x, y + 1, COLORS.grass2);
  set(b, x + 1, y + 1, COLORS.grass2);
  set(b, x - 1, y, COLORS.grass4);
  set(b, x, y - 1, COLORS.grass5);
  set(b, x + 1, y, COLORS.grass4);
}

const PETALS = ['red3', 'gold3', 'white0', 'frost4', 'arcane3'];

function flowers(b: Bitmap, x: number, y: number, rnd: () => number): void {
  const color = COLORS[PETALS[Math.floor(rnd() * PETALS.length)]];
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const fx = x + Math.floor(rnd() * 5) - 2;
    const fy = y + Math.floor(rnd() * 4) - 2;
    set(b, fx, fy + 1, COLORS.grass2);
    set(b, fx, fy, color);
  }
}

/** A rocky outcrop with a dark cave mouth where the road begins. */
function cave(b: Bitmap, start: { x: number; y: number }, next: { x: number; y: number }, seed: number): void {
  const dx = Math.sign(next.x - start.x);
  const dy = Math.sign(next.y - start.y);
  // The mouth sits a little behind the first road point, facing along the road.
  const mx = Math.round(start.x - dx * 8);
  const my = Math.round(start.y - dy * 8);
  const r = seeded(seed + 99);
  // Rock mass: overlapping shaded boulders around (and behind) the mouth.
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const dist = 6 + r() * 12;
    const bx = mx + Math.cos(a) * dist - dx * 6;
    const by = my + Math.sin(a) * dist * 0.8 - dy * 6 - 4;
    const s = blank(16, 12);
    ellipse(s, 8, 6, 7 + r() * 1.5, 5 + r(), COLORS.stone1);
    ellipse(s, 7, 5, 5.5, 3.6, COLORS.stone2);
    ellipse(s, 6, 4, 3, 1.8, COLORS.stone3);
    blit(b, s, Math.round(bx - 8), Math.round(by - 6));
  }
  // The mouth: an arch of darkness.
  ellipse(b, mx, my - 1, 8, 9, COLORS.stone0);
  ellipse(b, mx, my, 6.5, 8, COLORS.ink1);
  ellipse(b, mx, my + 1, 5, 6.5, COLORS.ink0);
  rect(b, mx - 6, my + 5, 13, 3, COLORS.ink0);
}

/**
 * The town wall where the road leaves the map: a stone wall across the exit with a gatehouse of two
 * towers around a dark, open gateway. Enemies that reach it cost health.
 */
function gate(b: Bitmap, end: { x: number; y: number }, prev: { x: number; y: number }, W: number, H: number): void {
  const horizontal = Math.abs(end.x - prev.x) >= Math.abs(end.y - prev.y);
  const ex = Math.round(end.x);
  const ey = Math.round(end.y);
  if (horizontal) {
    // Wall band running top to bottom, battlements facing the battlefield.
    const dir = Math.sign(end.x - prev.x) || 1;
    const x0 = dir > 0 ? ex - 4 : ex - 8;
    wallBand(b, x0, 0, 12, H, 'vertical', dir);
    for (const ty of [ey - 25, ey + 9]) tower(b, x0 - 3, ty, 18, 16);
    rect(b, x0, ey - 9, 12, 18, COLORS.ink1);
    rect(b, x0 + (dir > 0 ? 3 : 0), ey - 8, 9, 16, COLORS.ink0);
    // Open gate leaves against the gateway sides.
    rect(b, x0 - 1, ey - 9, 2, 18, COLORS.wood2);
    rect(b, x0 - 1, ey - 9, 1, 18, COLORS.wood3);
  } else {
    const dir = Math.sign(end.y - prev.y) || 1;
    const y0 = dir > 0 ? ey - 4 : ey - 8;
    wallBand(b, 0, y0, W, 12, 'horizontal', dir);
    for (const tx of [ex - 26, ex + 10]) tower(b, tx, y0 - 4, 16, 18);
    rect(b, ex - 9, y0, 18, 12, COLORS.ink1);
  }
}

/** A stone wall seen from above: blocks along its length and merlons on the battlefield side. */
function wallBand(b: Bitmap, x: number, y: number, w: number, h: number, run: 'vertical' | 'horizontal', dir: number): void {
  rect(b, x, y, w, h, COLORS.stone2);
  if (run === 'vertical') {
    for (let yy = y; yy < y + h; yy++) {
      if ((yy - y) % 5 === 4) rect(b, x + 2, yy, w - 4, 1, COLORS.stone1);
      set(b, x + Math.floor(w / 2) + ((Math.floor((yy - y) / 5) % 2) * 2 - 1), yy, COLORS.stone1);
    }
    // Battlements on the side facing the map, a walkway shadow on the other.
    const face = dir > 0 ? x : x + w - 3;
    for (let yy = y; yy < y + h; yy += 4) {
      rect(b, face, yy, 3, 2, COLORS.stone3);
      rect(b, face, yy + 2, 3, 2, COLORS.stone1);
    }
    rect(b, dir > 0 ? x + w - 1 : x, y, 1, h, COLORS.stone0);
  } else {
    for (let xx = x; xx < x + w; xx++) {
      if ((xx - x) % 5 === 4) rect(b, xx, y + 2, 1, h - 4, COLORS.stone1);
    }
    const face = dir > 0 ? y : y + h - 3;
    for (let xx = x; xx < x + w; xx += 4) {
      rect(b, xx, face, 2, 3, COLORS.stone3);
      rect(b, xx + 2, face, 2, 3, COLORS.stone1);
    }
  }
}

/** A square gate tower seen from above: battlements around a dark roof hatch and a red banner. */
function tower(b: Bitmap, x: number, y: number, w: number, h: number): void {
  rect(b, x - 1, y - 1, w + 2, h + 2, COLORS.ink0);
  rect(b, x, y, w, h, COLORS.stone2);
  rect(b, x, y, w, 1, COLORS.stone3);
  rect(b, x, y, 1, h, COLORS.stone3);
  rect(b, x + w - 1, y, 1, h, COLORS.stone1);
  rect(b, x, y + h - 1, w, 1, COLORS.stone1);
  rect(b, x + 3, y + 3, w - 6, h - 6, COLORS.stone1);
  rect(b, x + 4, y + 4, w - 8, h - 8, COLORS.wood1);
  for (let i = 0; i < w; i += 3) set(b, x + i, y, COLORS.stone4);
  rect(b, x + Math.floor(w / 2) - 1, y + h - 1, 3, 4, COLORS.red2);
  set(b, x + Math.floor(w / 2), y + h + 3, COLORS.red1);
  set(b, x + Math.floor(w / 2), y + h, COLORS.gold3);
}

function distanceToPolyline(px: number, py: number, pts: readonly { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / len2));
    const d = Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
    if (d < best) best = d;
  }
  return best;
}

function minRoadDistance(x: number, y: number, w: number, h: number, dist: (x: number, y: number) => number): number {
  let best = Infinity;
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2], [x + w / 2, y + h]]) {
    best = Math.min(best, dist(px, py));
  }
  return best;
}
