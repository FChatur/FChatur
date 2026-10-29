import { blank, blit, ellipse, get, line, rect, set, type Bitmap } from './bitmap';
import { hash2, seeded, valueNoise } from './noise';
import { COLORS, shift } from './palette';
import { bush, pine, rock, stump, tree } from './sprites/props';

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

export interface Point {
  x: number;
  y: number;
}

/** Where the renderer adds small ambient animations, in art pixels within `image`. */
export interface AmbientSpots {
  /** Flickering torch flames. */
  torches: Point[];
  /** Eyes that blink in the dark of the cave. */
  caveEyes: Point | null;
  /** Flower meadows, where butterflies flutter. */
  meadows: Point[];
  /** Tree canopies along the clearing's edge, where leaves fall from. */
  canopies: Point[];
  /** Grass and flower clumps that sway in the wind, along the clearing's edge. */
  sway: Point[];
}

export interface Terrain {
  image: Bitmap;
  /** Position of the map's top-left corner within `image`, in art pixels. */
  originX: number;
  originY: number;
  ambient: AmbientSpots;
}

/** Half-width of the road in art pixels before edge noise. Path tiles are 16 wide. */
const ROAD_HALF = 6.5;

/**
 * Paints the battlefield: a sunlit meadow with flower patches, a worn dirt road with a defined edge, a
 * composed forest edge whose canopies cast dappled shade, deeper forest with a pond beyond, a torch-lit
 * cave where enemies emerge and the walled gate they attack. Map-agnostic: everything is derived from the
 * map size and the road, so any map gets the same treatment. Ambient animation spots are returned for
 * the renderer.
 */
export function paintTerrain(spec: TerrainSpec): Terrain {
  const { cols, rows, margin, seed } = spec;
  const ox = margin * ART_TILE;
  const oy = margin * ART_TILE;
  const W = (cols + margin * 2) * ART_TILE;
  const H = (rows + margin * 2) * ART_TILE;
  const mapW = cols * ART_TILE;
  const mapH = rows * ART_TILE;
  const img = blank(W, H);
  const road = spec.road.map((p) => ({ x: p.x + ox, y: p.y + oy }));
  const ambient: AmbientSpots = { torches: [], caveEyes: null, meadows: [], canopies: [], sway: [] };
  const inMap = (x: number, y: number) => x >= ox && y >= oy && x < ox + mapW && y < oy + mapH;
  /** Pixels outside the playable map (0 inside). */
  const outside = (x: number, y: number) => Math.max(0, ox - x, x - (ox + mapW - 1), oy - y, y - (oy + mapH - 1));
  const roadDist = (x: number, y: number) => distanceToPolyline(x + 0.5, y + 0.5, road);

  // Ground: sunlit meadow, darker forest floor outside the clearing, dirt where the road runs.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = roadDist(x, y);
      const half = ROAD_HALF + (valueNoise(x, y, 5, seed) - 0.5) * 2.2;
      if (d <= half) set(img, x, y, dirtColor(x, y, d, half, seed));
      else if (d <= half + 1) set(img, x, y, COLORS.grass1);
      else set(img, x, y, grassColor(x, y, seed, outside(x, y), W, H));
    }
  }

  // Grass blades and tufts give the meadow texture; sunlit blades are lighter.
  const rnd = seeded(seed * 31 + 7);
  for (let ty = 0; ty < rows + margin * 2; ty++) {
    for (let tx = 0; tx < cols + margin * 2; tx++) {
      for (let i = 0; i < 3; i++) {
        const x = tx * ART_TILE + Math.floor(rnd() * 15);
        const y = ty * ART_TILE + Math.floor(rnd() * 14) + 1;
        if (roadDist(x, y) < ROAD_HALF + 2.5) continue;
        const roll = rnd();
        if (roll < 0.35) tuft(img, x, y);
        else if (roll < 0.6) blade(img, x, y);
      }
    }
  }

  // Flower meadows: clustered, in one or two colours each, so colour reads as patches, not noise.
  const fr = seeded(seed * 13 + 5);
  const meadowCount = Math.round((cols * rows) / 22) + 10;
  for (let i = 0; i < meadowCount * 3 && ambient.meadows.length < meadowCount; i++) {
    const x = Math.floor(fr() * W);
    const y = Math.floor(fr() * H);
    const clearing = inMap(x, y);
    if (roadDist(x, y) < ROAD_HALF + (clearing ? 12 : 8)) continue;
    if (!clearing && outside(x, y) > 40) continue;
    meadow(img, x, y, clearing ? 9 : 12, fr, (px, py) => roadDist(px, py) > ROAD_HALF + 3);
    ambient.meadows.push({ x, y });
  }

  // Entrance and exit structures.
  const blocked: { x0: number; y0: number; x1: number; y1: number }[] = [];
  if (road.length >= 2) {
    cave(img, road[0], road[1], seed, ambient, blocked);
    gate(img, road[road.length - 1], road[road.length - 2], W, H, ambient, blocked);
  }

  // A pond in the forest, somewhere off the road.
  pond(img, W, H, { ox, oy, mapW, mapH }, roadDist, seed, blocked);

  // Scenery props: a composed tree line just outside the clearing, then deeper forest.
  const props: { x: number; y: number; art: Bitmap; tall: boolean }[] = [];
  const mapRect = { x0: ox - 2, y0: oy - 2, x1: ox + mapW + 2, y1: oy + mapH + 2 };
  const fits = (left: number, top: number, art: Bitmap) => {
    if (left < mapRect.x1 && left + art.w > mapRect.x0 && top < mapRect.y1 && top + art.h > mapRect.y0) return false;
    if (blocked.some((r) => left < r.x1 && left + art.w > r.x0 && top < r.y1 && top + art.h > r.y0)) return false;
    return minRoadDistance(left, top, art.w, art.h, roadDist) >= ROAD_HALF + 4;
  };
  const pr = seeded(seed * 17 + 3);
  const place = (x: number, base: number, art: Bitmap, tall: boolean) => {
    const left = Math.round(x - art.w / 2);
    const top = Math.round(base - art.h);
    if (!fits(left, top, art)) return false;
    props.push({ x: left, y: top, art, tall });
    return true;
  };
  const treeArt = (k: number) => (pr() < 0.6 ? tree(k) : pine(k));
  // Tree line: trunks a few pixels beyond each edge, canopies overlapping into a continuous wall.
  for (let x = ox - 30; x < ox + mapW + 30; x += 10 + Math.floor(pr() * 5)) {
    const t = treeArt(Math.floor(pr() * 1000));
    if (place(x, oy - 3 - Math.floor(pr() * 5), t, true)) ambient.canopies.push({ x, y: oy - t.h + 6 });
    // Below the map a tree's canopy must stay out of the clearing.
    const b = treeArt(Math.floor(pr() * 1000));
    place(x, oy + mapH + b.h + 4 + Math.floor(pr() * 4), b, true);
  }
  for (let y = oy - 20; y < oy + mapH + 30; y += 9 + Math.floor(pr() * 5)) {
    const t = treeArt(Math.floor(pr() * 1000));
    if (place(ox - 12 - Math.floor(pr() * 5), y, t, true)) ambient.canopies.push({ x: ox - 12, y: y - t.h + 6 });
    place(ox + mapW + 14 + Math.floor(pr() * 5), y, treeArt(Math.floor(pr() * 1000)), true);
  }
  // Undergrowth between the tree line and the clearing: bushes and rocks.
  for (let i = 0; i < (cols + rows) * 3; i++) {
    const side = Math.floor(pr() * 4);
    const along = pr();
    const depth = 3 + pr() * 10;
    const x = side === 0 ? ox + along * mapW : side === 1 ? ox + along * mapW : side === 2 ? ox - depth : ox + mapW + depth;
    const y = side === 0 ? oy - depth : side === 1 ? oy + mapH + depth + 8 : oy + along * mapH;
    const art = pr() < 0.7 ? bush(Math.floor(pr() * 1000)) : rock(Math.floor(pr() * 1000), pr() < 0.6 ? 'small' : 'large');
    if (place(x, y, art, false)) ambient.sway.push({ x, y: y - 2 });
  }
  // Deeper forest: denser further out.
  const step = 12;
  for (let gy = 0; gy < H + step; gy += step) {
    for (let gx = 0; gx < W + step; gx += step) {
      const x = gx + Math.floor(pr() * step);
      const y = gy + Math.floor(pr() * step);
      const out = Math.max(mapRect.x0 - x, x - mapRect.x1, mapRect.y0 - y, y - mapRect.y1);
      if (out < 24 || pr() > Math.min(0.9, 0.35 + out / 60)) continue;
      const roll = pr();
      const art =
        roll < 0.42 ? tree(Math.floor(pr() * 1000)) :
        roll < 0.72 ? pine(Math.floor(pr() * 1000)) :
        roll < 0.86 ? bush(Math.floor(pr() * 1000)) :
        roll < 0.96 ? rock(Math.floor(pr() * 1000), pr() < 0.5 ? 'small' : 'large') :
        stump(Math.floor(pr() * 1000));
      place(x, y, art, art.h > 14);
    }
  }
  props.sort((a, b) => a.y + a.art.h - (b.y + b.art.h));
  // Shade first (light comes from the upper left, so shadows fall down and to the right), then props.
  for (const p of props) {
    const base = p.y + p.art.h;
    if (p.tall) dapple(img, p.x + p.art.w / 2 + 4, base - 4, p.art.w * 0.75, 8, seed, inMap);
    else dapple(img, p.x + p.art.w / 2 + 1, base - 1, p.art.w * 0.55, 2.5, seed, inMap);
  }
  for (const p of props) blit(img, p.art, p.x, p.y);
  sunlight(img, ox + mapW * 0.3, oy + mapH * 0.25, Math.hypot(W, H) * 0.5, seed);

  return { image: img, originX: ox, originY: oy, ambient };
}

/**
 * Meadow grass: a base tone with broad sunlit patches (stronger toward the upper left, where the light
 * comes from) and soft shaded hollows; the forest floor beyond the clearing is darker.
 */
function grassColor(x: number, y: number, seed: number, outside: number, W: number, H: number): number {
  const sun = valueNoise(x, y, 30, seed + 1) * 0.8 + (1 - (x / W + y / H) / 2) * 0.3 + (hash2(x, y, seed + 6) - 0.5) * 0.1;
  const hollow = valueNoise(x, y, 17, seed + 9) + (hash2(x, y, seed + 7) - 0.5) * 0.1;
  let tone = sun < 0.5 ? 2 : sun < 0.76 ? 3 : 4;
  // Warm sunlit glades: a light dither toward the brightest meadow tone.
  if (sun > 0.86 && hash2(x, y, seed + 3) < (sun - 0.86) * 3) tone = 5;
  if (hollow < 0.24) tone -= 1;
  if (outside > 0 && hash2(x, y, seed + 8) < Math.min(1, outside / 20)) tone -= 1;
  if (outside > 26 && hash2(x, y, seed + 10) < Math.min(1, (outside - 26) / 30)) tone -= 1;
  const n = hash2(x, y, seed + 2);
  if (n > 0.985) tone += 1;
  else if (n < 0.02) tone -= 1;
  return COLORS[`grass${Math.max(0, Math.min(5, tone))}`];
}

function dirtColor(x: number, y: number, d: number, half: number, seed: number): number {
  // A dark rim gives the road a crisp, readable edge against the grass.
  if (d > half - 1) return COLORS.dirt0;
  if (d > half - 2) return COLORS.dirt1;
  const n = hash2(x, y, seed + 4);
  if (n > 0.992) return COLORS.stone4;
  if (n > 0.984) return COLORS.stone3;
  if (n < 0.006) return COLORS.dirt0;
  // Two worn ruts either side of the centre.
  if (Math.abs(d - 3.2) < 0.55 && hash2(x, y, seed + 5) > 0.35) return COLORS.dirt1;
  const q = valueNoise(x, y, 6, seed + 3);
  return q > 0.7 ? COLORS.dirt4 : q > 0.45 ? COLORS.dirt3 : q < 0.2 ? COLORS.dirt1 : COLORS.dirt2;
}

function tuft(b: Bitmap, x: number, y: number): void {
  const base = get(b, x, y);
  if (base < 0) return;
  const dark = shift(base, -1);
  const light = shift(base, 1);
  set(b, x - 1, y + 1, dark);
  set(b, x, y + 1, dark);
  set(b, x + 1, y + 1, dark);
  set(b, x - 1, y, light);
  set(b, x, y - 1, shift(base, 2));
  set(b, x + 1, y, light);
}

/** A single two-pixel blade of grass, one tone lighter than the ground. */
function blade(b: Bitmap, x: number, y: number): void {
  const base = get(b, x, y);
  if (base < 0) return;
  set(b, x, y, shift(base, 1));
  set(b, x, y - 1, shift(base, 1));
  set(b, x + 1, y + 1, shift(base, -1));
}

const MEADOW_COLORS: [string, string][] = [
  ['pink2', 'white0'],
  ['gold3', 'white0'],
  ['frost4', 'white0'],
  ['red3', 'gold3'],
  ['arcane3', 'pink2'],
  ['gold4', 'gold3'],
];

/** A patch of flowers: single-pixel blooms and a few four-petal ones with gold centres. */
function meadow(b: Bitmap, cx: number, cy: number, radius: number, rnd: () => number, allowed: (x: number, y: number) => boolean): void {
  const [a, c] = MEADOW_COLORS[Math.floor(rnd() * MEADOW_COLORS.length)];
  const n = 14 + Math.floor(rnd() * 14);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    const x = Math.round(cx + Math.cos(ang) * r);
    const y = Math.round(cy + Math.sin(ang) * r * 0.7);
    if (!allowed(x, y) || get(b, x, y) < 0) continue;
    const color = COLORS[rnd() < 0.7 ? a : c];
    set(b, x, y + 1, COLORS.grass1);
    if (rnd() < 0.3) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(b, x + dx, y + dy, color);
      set(b, x, y, COLORS.gold3);
      set(b, x, y + 2, COLORS.grass1);
    } else {
      set(b, x, y, color);
    }
  }
}

/**
 * Warm sunlight from the upper left, baked into the picture: grass and dirt near the light are lifted
 * one tone, dithered so the falloff is soft. (Baked rather than drawn as a translucent overlay, which
 * would cost a full-screen blend every frame.)
 */
function sunlight(b: Bitmap, cx: number, cy: number, reach: number, seed: number): void {
  const warm = new Set(['grass', 'dirt'].flatMap((r) => [0, 1, 2, 3, 4, 5].map((i) => COLORS[`${r}${i}`])).filter((c) => c !== undefined));
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / reach;
      if (d >= 1) continue;
      const c = get(b, x, y);
      if (!warm.has(c)) continue;
      if (c !== COLORS.grass4 && c !== COLORS.grass5 && hash2(x, y, seed + 31) < (1 - d) * (1 - d) * 0.28) set(b, x, y, shift(c, 1));
    }
  }
}

/** Dappled shade: darkens the ground in an ellipse, solid at the centre and broken up toward the rim. */
function dapple(b: Bitmap, cx: number, cy: number, rx: number, ry: number, seed: number, inMap: (x: number, y: number) => boolean): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const c = get(b, x, y);
      if (c < 0) continue;
      // Inside the playable clearing shade stays light, so tiles keep their contrast.
      const strength = inMap(x, y) ? 0.75 : 1;
      const leafy = valueNoise(x, y, 3, seed + 20) * strength;
      if (leafy > 0.3 + d * 0.35) set(b, x, y, shift(c, d < 0.45 && strength === 1 ? -2 : -1));
    }
  }
}

/** A small pond with a sandy shore, lily pads and glints, placed in the forest away from the road. */
function pond(
  b: Bitmap,
  W: number,
  H: number,
  map: { ox: number; oy: number; mapW: number; mapH: number },
  roadDist: (x: number, y: number) => number,
  seed: number,
  blocked: { x0: number; y0: number; x1: number; y1: number }[],
): void {
  const r = seeded(seed + 77);
  const rx = 22;
  const ry = 11;
  // Try spots below and left of the clearing first (seen most often), then anywhere outside it.
  const candidates: [number, number][] = [
    [map.ox + map.mapW * 0.3, map.oy + map.mapH + 30],
    [map.ox - 34, map.oy + map.mapH * 0.75],
    [map.ox + map.mapW * 0.6, map.oy - 34],
  ];
  for (let i = 0; i < 20; i++) candidates.push([r() * W, r() * H]);
  for (const [cx, cy] of candidates) {
    const clear =
      cx - rx - 4 > 0 && cx + rx + 4 < W && cy - ry - 4 > 0 && cy + ry + 4 < H &&
      (cx + rx + 6 < map.ox || cx - rx - 6 > map.ox + map.mapW || cy + ry + 6 < map.oy || cy - ry - 6 > map.oy + map.mapH) &&
      roadDist(cx, cy) > rx + 16;
    if (!clear) continue;
    ellipse(b, cx, cy, rx + 2, ry + 2, COLORS.dirt3);
    ellipse(b, cx + 1, cy + 1, rx + 1, ry + 1, COLORS.dirt1);
    ellipse(b, cx, cy, rx, ry, COLORS.water1);
    ellipse(b, cx - 3, cy - 2, rx - 5, ry - 3, COLORS.water2);
    for (let i = 0; i < 6; i++) {
      const px = cx - rx + 6 + r() * (rx * 2 - 12);
      const py = cy - ry + 3 + r() * (ry * 2 - 6);
      ellipse(b, px, py, 2.2, 1.4, COLORS.leaf4);
      set(b, px + 1, py, COLORS.leaf2);
      if (r() < 0.4) set(b, px - 1, py - 1, COLORS.pink2);
    }
    for (let i = 0; i < 5; i++) line(b, cx - rx + 5 + r() * rx, cy - 3 + r() * 6, cx - rx + 8 + r() * rx, cy - 3 + r() * 6, COLORS.water3);
    // Reeds on the far bank.
    for (let i = 0; i < 7; i++) {
      const x = Math.round(cx + rx - 6 + r() * 8);
      const y = Math.round(cy - ry + r() * 5);
      line(b, x, y, x, y - 3 - Math.floor(r() * 3), COLORS.grass3);
      set(b, x, y - 4, COLORS.wood2);
    }
    blocked.push({ x0: cx - rx - 6, y0: cy - ry - 8, x1: cx + rx + 6, y1: cy + ry + 6 });
    return;
  }
}

/** A rocky outcrop with a timber-framed cave mouth and two torches where the road begins. */
function cave(
  b: Bitmap,
  start: Point,
  next: Point,
  seed: number,
  ambient: AmbientSpots,
  blocked: { x0: number; y0: number; x1: number; y1: number }[],
): void {
  const dx = Math.sign(next.x - start.x);
  const dy = Math.sign(next.y - start.y);
  // The mouth sits a little behind the first road point, facing along the road.
  const mx = Math.round(start.x - dx * 8);
  const my = Math.round(start.y - dy * 8);
  const r = seeded(seed + 99);
  // Rock mass: overlapping shaded boulders around (and behind) the mouth.
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const dist = 7 + r() * 13;
    const bx = mx + Math.cos(a) * dist - dx * 7;
    const by = my + Math.sin(a) * dist * 0.8 - dy * 7 - 4;
    const s = blank(18, 14);
    ellipse(s, 9, 7, 8 + r() * 1.5, 6 + r(), COLORS.stone0);
    ellipse(s, 8.5, 6.5, 7, 5, COLORS.stone1);
    ellipse(s, 7.5, 5.5, 5.5, 3.6, COLORS.stone2);
    ellipse(s, 6.5, 4.5, 3, 1.8, COLORS.stone3);
    if (r() < 0.5) set(s, 6, 3, COLORS.grass4);
    blit(b, s, Math.round(bx - 9), Math.round(by - 7));
  }
  // The mouth: an arch of darkness framed with timber posts and a lintel.
  ellipse(b, mx, my - 1, 9, 10, COLORS.stone0);
  ellipse(b, mx, my, 7, 9, COLORS.ink1);
  ellipse(b, mx, my + 1, 5.5, 7.5, COLORS.ink0);
  rect(b, mx - 7, my + 5, 15, 3, COLORS.ink0);
  for (const side of [-1, 1]) {
    const px = mx + side * 8 - (side > 0 ? 1 : 0);
    rect(b, px, my - 7, 2, 15, COLORS.wood2);
    rect(b, px, my - 7, 1, 15, COLORS.wood3);
    // Torch on a bracket beside the mouth.
    const tx = mx + side * 12;
    rect(b, tx, my - 4, 1, 4, COLORS.wood1);
    ambient.torches.push({ x: tx, y: my - 6 });
  }
  rect(b, mx - 9, my - 9, 19, 2, COLORS.wood2);
  rect(b, mx - 9, my - 9, 19, 1, COLORS.wood3);
  ambient.caveEyes = { x: mx, y: my - 2 };
  blocked.push({ x0: mx - 34, y0: my - 30, x1: mx + 20, y1: my + 24 });
}

/**
 * The town wall where the road leaves the map: a stone wall across the exit with a gatehouse of two
 * towers around a dark, open gateway, lit by torches. Enemies that reach it cost health.
 */
function gate(
  b: Bitmap,
  end: Point,
  prev: Point,
  W: number,
  H: number,
  ambient: AmbientSpots,
  blocked: { x0: number; y0: number; x1: number; y1: number }[],
): void {
  const horizontal = Math.abs(end.x - prev.x) >= Math.abs(end.y - prev.y);
  const ex = Math.round(end.x);
  const ey = Math.round(end.y);
  if (horizontal) {
    const dir = Math.sign(end.x - prev.x) || 1;
    const x0 = dir > 0 ? ex - 4 : ex - 8;
    wallBand(b, x0, 0, 12, H, 'vertical', dir);
    for (const ty of [ey - 25, ey + 9]) tower(b, x0 - 3, ty, 18, 16);
    rect(b, x0, ey - 9, 12, 18, COLORS.ink1);
    rect(b, x0 + (dir > 0 ? 3 : 0), ey - 8, 9, 16, COLORS.ink0);
    // Open gate leaves against the gateway sides, iron-banded.
    for (const gy of [ey - 9, ey + 7]) {
      rect(b, x0 - 1, gy, 6, 2, COLORS.wood2);
      rect(b, x0 - 1, gy, 6, 1, COLORS.wood3);
      set(b, x0 + 1, gy, COLORS.steel3);
    }
    for (const ty of [ey - 13, ey + 11]) {
      rect(b, x0 - 3, ty, 1, 3, COLORS.wood1);
      ambient.torches.push({ x: x0 - 3, y: ty - 2 });
    }
    blocked.push({ x0: x0 - 8, y0: 0, x1: x0 + 20, y1: H });
  } else {
    const dir = Math.sign(end.y - prev.y) || 1;
    const y0 = dir > 0 ? ey - 4 : ey - 8;
    wallBand(b, 0, y0, W, 12, 'horizontal', dir);
    for (const tx of [ex - 26, ex + 10]) tower(b, tx, y0 - 4, 16, 18);
    rect(b, ex - 9, y0, 18, 12, COLORS.ink1);
    for (const tx of [ex - 12, ex + 11]) ambient.torches.push({ x: tx, y: y0 - 3 });
    blocked.push({ x0: 0, y0: y0 - 8, x1: W, y1: y0 + 20 });
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
