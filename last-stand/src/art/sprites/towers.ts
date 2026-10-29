import { blank, blit, ellipse, fromRows, line, outlined, rect, set, type Bitmap, type Legend } from '../bitmap';
import { COLORS } from '../palette';
import { shadedColumn } from '../shapes';
import { banner, bracing, crenellations, leafClump, planks, post, stoneWall } from './build';

/**
 * Towers: a base per level (static) plus an animated defender standing on it. Bases are 14 art pixels
 * wide before the outline (16 with it: exactly one tile). `top` is the y, within the outlined base, where
 * the defender's feet go.
 */
/** How far the defender's sprite overlaps the base's top (its outline sits on the platform). */
export const DEFENDER_SINK = 2;

export interface TowerBase {
  image: Bitmap;
  /** Feet line for the defender, in base pixels from the top. */
  top: number;
}

function base(w: number, h: number, top: number, draw: (b: Bitmap) => void): TowerBase {
  const b = blank(w, h);
  draw(b);
  return { image: outlined(b), top: top + 1 };
}

// ---------------------------------------------------------------- Archer Tower (Turret)

const ARCHER_BASES: TowerBase[] = [
  // Wooden watchtower on stone footings.
  base(14, 13, 0, (b) => {
    for (const x of [1, 11]) post(b, x, 2, 9);
    bracing(b, 3, 3, 10, 9);
    rect(b, 0, 11, 4, 2, COLORS.stone2);
    rect(b, 10, 11, 4, 2, COLORS.stone2);
    rect(b, 0, 11, 4, 1, COLORS.stone3);
    rect(b, 10, 11, 4, 1, COLORS.stone3);
    planks(b, 0, 0, 14, 2);
  }),
  // Stone base, wooden lookout.
  base(14, 15, 0, (b) => {
    stoneWall(b, 0, 6, 14, 9);
    rect(b, 6, 11, 2, 4, COLORS.wood1);
    set(b, 6, 11, COLORS.ink1);
    for (const x of [1, 11]) post(b, x, 2, 4);
    bracing(b, 3, 2, 10, 5);
    planks(b, 0, 0, 14, 2);
  }),
  // Stone tower with battlements, arrow slit, banner and a gold band.
  base(14, 17, 1, (b) => {
    stoneWall(b, 0, 2, 14, 15);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    crenellations(b, 0, 0, 14);
    rect(b, 6, 7, 1, 3, COLORS.ink0);
    banner(b, 9, 5, 6, 'red');
  }),
];

const ARCHER: Legend = {
  C: 'steel4', c: 'steel3', d: 'steel2', f: 'skin2', F: 'skin3', r: 'red2', R: 'red1', t: 'red3',
  b: 'wood1', w: 'wood3', v: 'wood2', s: 'steel3', S: 'stone4',
};

/** Defender frames facing right: [ready (aiming), loose (just shot)]. */
const ARCHER_FRAMES = [
  [
    '...CCc....',
    '..Ccccd...',
    '..fFFk..w.',
    '..ffff.S.v',
    '.rrtrfffsS',
    '.rRrrr.S.v',
    '..rRrr..w.',
    '..bbbb....',
    '..R..R....',
    '..b..b....',
  ],
  [
    '...CCc....',
    '..Ccccd...',
    '..fFFk...w',
    '..ffff...S',
    '.rrtrffffS',
    '.rRrrr...S',
    '..rRrr...w',
    '..bbbb....',
    '..R..R....',
    '..b..b....',
  ],
];

// ---------------------------------------------------------------- Ranger Tower (Rapid)

const RANGER_BASES: TowerBase[] = [
  // A stout tree trunk carrying a small platform.
  base(14, 13, 2, (b) => {
    shadedColumn(b, 5, 4, 4, 8, 'wood', 2);
    rect(b, 3, 11, 8, 2, COLORS.wood1);
    rect(b, 4, 11, 6, 1, COLORS.wood2);
    leafClump(b, 2.5, 3, 2.6, 2.2, 3);
    leafClump(b, 11.5, 3, 2.6, 2.2, 5);
    planks(b, 1, 2, 12, 2);
  }),
  base(14, 15, 2, (b) => {
    shadedColumn(b, 4, 4, 6, 10, 'wood', 2);
    rect(b, 2, 13, 10, 2, COLORS.wood1);
    rect(b, 3, 13, 8, 1, COLORS.wood2);
    leafClump(b, 2.5, 4, 3, 2.6, 7);
    leafClump(b, 11.5, 4, 3, 2.6, 11);
    planks(b, 0, 2, 14, 2);
    line(b, 10, 4, 10, 12, COLORS.wood3);
  }),
  base(14, 17, 2, (b) => {
    shadedColumn(b, 4, 4, 6, 12, 'wood', 2);
    rect(b, 1, 15, 12, 2, COLORS.wood1);
    rect(b, 2, 15, 10, 1, COLORS.wood2);
    leafClump(b, 2.5, 5, 3.2, 3, 13);
    leafClump(b, 11.5, 5, 3.2, 3, 17);
    planks(b, 0, 2, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    banner(b, 5, 7, 6, 'leaf', 'gold4');
  }),
];

const RANGER: Legend = {
  H: 'leaf4', h: 'leaf3', g: 'leaf2', G: 'leaf1', f: 'skin2', F: 'skin3', b: 'wood1', w: 'wood3', v: 'wood2',
  s: 'steel3', S: 'stone4',
};

const RANGER_FRAMES = [
  [
    '...hH.....',
    '..hHHh....',
    '..hFfk..w.',
    '..gfff.S.v',
    '.hgghfffsS',
    '.hggGg.S.v',
    '..gGgg..w.',
    '..bbbb....',
    '..G..G....',
    '..b..b....',
  ],
  [
    '...hH.....',
    '..hHHh....',
    '..hFfk...w',
    '..gfff...S',
    '.hgghffffS',
    '.hggGg...S',
    '..gGgg...w',
    '..bbbb....',
    '..G..G....',
    '..b..b....',
  ],
];

// ---------------------------------------------------------------- Frost Mage Tower (Frost)

const FROST_BASES: TowerBase[] = [
  // A short stone pillar with a rune band.
  base(14, 12, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 10, 'stone', 2);
    rect(b, 2, 0, 10, 2, COLORS.stone3);
    rect(b, 2, 1, 10, 1, COLORS.stone2);
    rect(b, 1, 10, 12, 2, COLORS.stone1);
    rect(b, 3, 6, 8, 1, COLORS.frost3);
    set(b, 5, 6, COLORS.frost5);
  }),
  base(14, 15, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 12, 'stone', 2);
    rect(b, 2, 0, 10, 2, COLORS.stone3);
    rect(b, 2, 1, 10, 1, COLORS.stone2);
    rect(b, 1, 12, 12, 3, COLORS.stone1);
    rect(b, 1, 12, 12, 1, COLORS.stone2);
    rect(b, 6, 4, 2, 4, COLORS.frost4);
    set(b, 6, 4, COLORS.frost5);
    rect(b, 6, 3, 2, 1, COLORS.ink0);
  }),
  base(14, 18, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 15, 'stone', 2);
    rect(b, 2, 0, 10, 2, COLORS.stone3);
    rect(b, 2, 1, 10, 1, COLORS.frost2);
    rect(b, 1, 15, 12, 3, COLORS.stone1);
    rect(b, 1, 15, 12, 1, COLORS.stone2);
    rect(b, 6, 4, 2, 5, COLORS.frost4);
    set(b, 6, 4, COLORS.frost5);
    rect(b, 6, 3, 2, 1, COLORS.ink0);
    banner(b, 1, 6, 6, 'frost', 'white0');
    banner(b, 10, 6, 6, 'frost', 'white0');
  }),
];

const MAGE: Legend = {
  B: 'frost3', b: 'frost2', n: 'frost1', f: 'skin2', F: 'skin3', w: 'white0', v: 'wood2', V: 'wood3',
  c: 'frost4', C: 'frost5', a: 'frost3',
};

/** [idle, casting]: the staff crystal flares when the mage casts. */
const MAGE_FRAMES = [
  [
    '...bB...c.',
    '..bBBb..V.',
    '..BfFk..V.',
    '..wwwf..V.',
    '.bBwwbffV.',
    '.bBBbb..V.',
    '.bbBbb..V.',
    '.nbbbbn.V.',
    '.nnbbnn...',
  ],
  [
    '...bB..cCc',
    '..bBBb..C.',
    '..BfFk.cVc',
    '..wwwf..V.',
    '.bBwwbffV.',
    '.bBBbb..V.',
    '.bbBbb..V.',
    '.nbbbbn.V.',
    '.nnbbnn...',
  ],
];

// ---------------------------------------------------------------- Ballista Tower (Sniper)

const BALLISTA_BASES: TowerBase[] = [
  base(14, 8, 1, (b) => {
    for (const x of [1, 6, 11]) post(b, x, 3, 4);
    rect(b, 0, 7, 14, 1, COLORS.stone2);
    planks(b, 0, 0, 14, 3);
  }),
  base(14, 10, 1, (b) => {
    stoneWall(b, 0, 3, 14, 7);
    planks(b, 0, 0, 14, 3);
  }),
  base(14, 12, 2, (b) => {
    stoneWall(b, 0, 4, 14, 8);
    crenellations(b, 0, 0, 14, 3);
    planks(b, 0, 2, 14, 2);
    rect(b, 0, 4, 14, 1, COLORS.gold2);
    for (const x of [2, 7, 11]) set(b, x, 8, COLORS.steel4);
    banner(b, 5, 6, 5, 'arcane', 'gold3');
  }),
];

/** Number of aiming directions for the ballista (0 = east, counter-clockwise in 45° steps... see below). */
export const BALLISTA_DIRECTIONS = 8;

/**
 * The ballista drawn aiming in direction `dir` (0 = east, then clockwise in 45° steps), loaded (string
 * drawn back, bolt in place) or just fired. Rasterised from a simple three-quarter-view model so every
 * direction is consistent: a turntable, a thick stock, a heavy bow with steel tips, and the bolt.
 */
function ballista(dir: number, loaded: boolean): Bitmap {
  const b = blank(19, 15);
  const a = (dir / BALLISTA_DIRECTIONS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.7;
  // Unit "across" vector in screen space (perpendicular to the aim), also foreshortened.
  const px = -Math.sin(a);
  const py = Math.cos(a) * 0.7;
  const cx = 9;
  const cy = 8;
  const at = (along: number, across = 0): [number, number] => [cx + dx * along + px * across, cy + dy * along + py * across];
  const seg = (a0: number, c0: number, a1: number, c1: number, color: number) => {
    const p0 = at(a0, c0);
    const p1 = at(a1, c1);
    line(b, p0[0], p0[1], p1[0], p1[1], color);
  };

  // Turntable.
  ellipse(b, cx, cy + 3, 4.5, 2.6, COLORS.wood1);
  ellipse(b, cx, cy + 2.4, 3.6, 1.9, COLORS.wood2);
  // Stock: three pixels thick, lit on its upper side.
  seg(-5, 1, 4, 1, COLORS.wood1);
  seg(-5, -1, 4, -1, COLORS.wood2);
  seg(-5, 0, 4, 0, COLORS.wood3);
  // Bow: two thick arms swept back from the front of the stock, steel-capped.
  for (const side of [-1, 1]) {
    seg(3, 0, 1, side * 6.5, COLORS.wood1);
    seg(3.6, 0, 1.6, side * 6.5, COLORS.wood2);
    const tip = at(1.2, side * 6.8);
    set(b, tip[0], tip[1], COLORS.steel4);
  }
  // String and bolt.
  const tipL = at(1.2, -6.8);
  const tipR = at(1.2, 6.8);
  const pull = loaded ? at(-3.5) : at(1.5);
  line(b, tipL[0], tipL[1], pull[0], pull[1], COLORS.stone4);
  line(b, tipR[0], tipR[1], pull[0], pull[1], COLORS.stone4);
  if (loaded) {
    seg(-3.5, 0, 6, 0, COLORS.steel2);
    const head = at(6.5);
    const head2 = at(7.4);
    set(b, head[0], head[1], COLORS.steel4);
    set(b, head2[0], head2[1], COLORS.steel4);
  }
  return outlined(b);
}

// ---------------------------------------------------------------- export

export interface TowerArt {
  bases: TowerBase[];
  /** Named defender animations; each frame faces right (archers) or a direction (ballista). */
  defender: Record<string, Bitmap[]>;
}

const framesOf = (rows: readonly (readonly string[])[], legend: Legend) => rows.map((r) => outlined(fromRows(r, legend)));

type TowerKind = 'basic' | 'sniper' | 'rapid' | 'frost';

let cache: Record<TowerKind, TowerArt> | null = null;

export function towerArt(): Record<TowerKind, TowerArt> {
  const aim = (loaded: boolean) => Array.from({ length: BALLISTA_DIRECTIONS }, (_, d) => ballista(d, loaded));
  cache ??= {
    basic: { bases: ARCHER_BASES, defender: { shoot: framesOf(ARCHER_FRAMES, ARCHER) } },
    sniper: { bases: BALLISTA_BASES, defender: { loaded: aim(true), fired: aim(false) } },
    rapid: { bases: RANGER_BASES, defender: { shoot: framesOf(RANGER_FRAMES, RANGER) } },
    frost: { bases: FROST_BASES, defender: { cast: framesOf(MAGE_FRAMES, MAGE) } },
  };
  return cache;
}

/** A complete tower at a level, for icons and previews: base with the defender's first frame on top. */
export function towerPortrait(type: TowerKind, level: number): Bitmap {
  const art = towerArt()[type];
  const b = art.bases[level - 1];
  const def = type === 'sniper' ? art.defender.loaded[1] : Object.values(art.defender)[0][0];
  // The defender's feet stand on the base's top line.
  const defTop = b.top + DEFENDER_SINK - def.h;
  const baseY = Math.max(0, -defTop);
  const out = blank(Math.max(b.image.w, def.w), baseY + b.image.h);
  blit(out, b.image, Math.floor((out.w - b.image.w) / 2), baseY);
  blit(out, def, Math.floor((out.w - def.w) / 2), baseY + defTop);
  return out;
}
