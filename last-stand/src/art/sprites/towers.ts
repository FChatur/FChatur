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
// Red, rectangular and martial: timber and stone, pennants and banners.

const ARCHER_BASES: TowerBase[] = [
  // Timber watchtower on stone footings, red trim.
  base(14, 13, 0, (b) => {
    for (const x of [1, 11]) post(b, x, 2, 9);
    bracing(b, 3, 3, 10, 9);
    rect(b, 0, 11, 4, 2, COLORS.stone2);
    rect(b, 10, 11, 4, 2, COLORS.stone2);
    rect(b, 0, 11, 4, 1, COLORS.stone3);
    rect(b, 10, 11, 4, 1, COLORS.stone3);
    planks(b, 0, 0, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.red2);
    for (let x = 1; x < 14; x += 3) set(b, x, 3, COLORS.red1);
  }),
  // Stone base, timber lookout with a red scalloped skirt and a shield.
  base(14, 16, 0, (b) => {
    stoneWall(b, 0, 7, 14, 9);
    rect(b, 6, 12, 2, 4, COLORS.wood1);
    set(b, 6, 12, COLORS.ink1);
    for (const x of [1, 11]) post(b, x, 2, 5);
    bracing(b, 3, 3, 10, 6);
    planks(b, 0, 0, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.red3);
    for (let x = 0; x < 14; x += 2) set(b, x, 3, COLORS.red2);
    rect(b, 2, 9, 3, 3, COLORS.red2);
    set(b, 3, 10, COLORS.gold3);
  }),
  // Stone keep with battlements, arrow slit, twin red banners and a gold band.
  base(14, 18, 1, (b) => {
    stoneWall(b, 0, 2, 14, 16);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    crenellations(b, 0, 0, 14);
    rect(b, 6, 6, 1, 3, COLORS.ink0);
    rect(b, 6, 13, 2, 5, COLORS.wood1);
    banner(b, 1, 5, 7, 'red');
    banner(b, 10, 5, 7, 'red');
  }),
];

const ARCHER: Legend = {
  C: 'steel4', c: 'steel3', d: 'steel2', f: 'skin2', F: 'skin3', r: 'red2', R: 'red1', t: 'red3', y: 'gold3',
  b: 'wood1', w: 'wood3', v: 'wood2', q: 'wood2', S: 'stone4', a: 'steel4',
};

/** Archer facing right in a steel kettle helmet and red tabard: [ready (arrow drawn), loose]. */
const ARCHER_FRAMES = [
  [
    '....dCCCd...',
    '...dcCCccd..',
    '....fFFk..w.',
    '.W..ffff.S.v',
    '.qrrtrffwwwa',
    '.qrRytrr.S.v',
    '..rRrrrr..w.',
    '..rrRRrr....',
    '...bbbb.....',
    '...R..R.....',
    '...b..b.....',
  ],
  [
    '....dCCCd...',
    '...dcCCccd..',
    '....fFFk..Sw',
    '.W..ffff..Sv',
    '.qrrtrfffffv',
    '.qrRytrr..Sv',
    '..rRrrrr..Sw',
    '..rrRRrr....',
    '...bbbb.....',
    '...R..R.....',
    '...b..b.....',
  ],
];

// ---------------------------------------------------------------- Ranger Tower (Rapid)
// Green and organic: a treehouse in a leafy crown, a hooded ranger with a longbow.

const RANGER_BASES: TowerBase[] = [
  // A stout trunk carrying a platform, leafy boughs either side.
  base(14, 13, 2, (b) => {
    shadedColumn(b, 5, 4, 4, 8, 'wood', 2);
    rect(b, 3, 11, 8, 2, COLORS.wood1);
    rect(b, 4, 11, 6, 1, COLORS.wood2);
    leafClump(b, 2.2, 3.5, 2.8, 2.6, 3);
    leafClump(b, 11.8, 3.5, 2.8, 2.6, 5);
    planks(b, 1, 2, 12, 2);
  }),
  base(14, 16, 2, (b) => {
    shadedColumn(b, 4, 4, 6, 10, 'wood', 2);
    rect(b, 2, 14, 10, 2, COLORS.wood1);
    rect(b, 3, 14, 8, 1, COLORS.wood2);
    leafClump(b, 2.2, 4, 3.2, 3, 7);
    leafClump(b, 11.8, 4, 3.2, 3, 11);
    planks(b, 0, 2, 14, 2);
    // Rope ladder and a lantern.
    for (let y = 5; y < 14; y += 2) rect(b, 10, y, 3, 1, COLORS.wood3);
    line(b, 10, 5, 10, 13, COLORS.wood2);
    line(b, 12, 5, 12, 13, COLORS.wood2);
    set(b, 2, 7, COLORS.gold4);
    set(b, 2, 8, COLORS.gold2);
  }),
  base(14, 18, 2, (b) => {
    shadedColumn(b, 4, 4, 6, 12, 'wood', 2);
    rect(b, 1, 16, 12, 2, COLORS.wood1);
    rect(b, 2, 16, 10, 1, COLORS.wood2);
    leafClump(b, 2, 5, 3.4, 3.4, 13);
    leafClump(b, 12, 5, 3.4, 3.4, 17);
    planks(b, 0, 2, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    banner(b, 5, 7, 7, 'grass', 'gold4');
    set(b, 1, 8, COLORS.gold4);
    set(b, 12, 8, COLORS.gold4);
  }),
];

const RANGER: Legend = {
  H: 'grass6', h: 'grass5', g: 'grass4', G: 'grass2', f: 'skin1', F: 'skin2', c: 'wood2', C: 'wood1', b: 'wood0',
  w: 'wood4', v: 'wood3', S: 'stone4', a: 'steel4',
};

/** Ranger facing right: green hood, brown cloak, tall longbow: [ready, loose]. */
const RANGER_FRAMES = [
  [
    '..GhH.....w.',
    '.GhHHh....Sv',
    '.GgfFk...S.v',
    '.cgfff..S..v',
    '.cggGgffwwwa',
    '.ccgGgg.S..v',
    '.cCggGg..S.v',
    '..CggGg...Sw',
    '...bbbb...w.',
    '...b..b.....',
    '...C..C.....',
  ],
  [
    '..GhH.....w.',
    '.GhHHh....Sv',
    '.GgfFk....Sv',
    '.cgfff....Sv',
    '.cggGgffffSv',
    '.ccgGgg...Sv',
    '.cCggGg...Sv',
    '..CggGg...Sw',
    '...bbbb...w.',
    '...b..b.....',
    '...C..C.....',
  ],
];

// ---------------------------------------------------------------- Frost Mage Tower (Frost)
// Magical: pale stone with glowing runes, a wizard whose staff crystal pulses and flares.

function runes(b: Bitmap, y: number): void {
  for (let x = 3; x < 11; x += 2) set(b, x, y, COLORS.frost4);
  set(b, 5, y, COLORS.frost5);
  set(b, 9, y, COLORS.frost5);
}

/** Small ice crystals growing at the foot of the tower. */
function iceShards(b: Bitmap, x: number, y: number): void {
  line(b, x, y, x, y - 3, COLORS.frost4);
  set(b, x, y - 3, COLORS.frost5);
  line(b, x + 1, y, x + 1, y - 1, COLORS.frost3);
}

const FROST_BASES: TowerBase[] = [
  base(14, 14, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 11, 'stone', 3);
    rect(b, 2, 0, 10, 2, COLORS.stone4);
    rect(b, 2, 1, 10, 1, COLORS.frost3);
    rect(b, 1, 12, 12, 2, COLORS.stone2);
    runes(b, 6);
    iceShards(b, 1, 12);
    iceShards(b, 11, 12);
  }),
  base(14, 17, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 13, 'stone', 3);
    rect(b, 2, 0, 10, 2, COLORS.stone4);
    rect(b, 2, 1, 10, 1, COLORS.frost3);
    rect(b, 1, 14, 12, 3, COLORS.stone2);
    rect(b, 1, 14, 12, 1, COLORS.stone3);
    rect(b, 6, 4, 2, 4, COLORS.frost4);
    set(b, 6, 4, COLORS.frost5);
    rect(b, 6, 3, 2, 1, COLORS.ink0);
    runes(b, 10);
    iceShards(b, 0, 14);
    iceShards(b, 12, 14);
  }),
  base(14, 20, 1, (b) => {
    shadedColumn(b, 3, 1, 8, 16, 'stone', 3);
    rect(b, 2, 0, 10, 2, COLORS.stone4);
    rect(b, 2, 1, 10, 1, COLORS.frost4);
    rect(b, 1, 17, 12, 3, COLORS.stone2);
    rect(b, 1, 17, 12, 1, COLORS.stone3);
    rect(b, 6, 4, 2, 5, COLORS.frost4);
    set(b, 6, 4, COLORS.frost5);
    rect(b, 6, 3, 2, 1, COLORS.ink0);
    runes(b, 11);
    runes(b, 14);
    banner(b, 0, 6, 7, 'frost', 'white0');
    banner(b, 11, 6, 7, 'frost', 'white0');
    iceShards(b, 0, 17);
    iceShards(b, 12, 17);
  }),
];

const MAGE: Legend = {
  B: 'frost3', b: 'frost2', n: 'frost1', y: 'gold3', f: 'skin2', F: 'skin3', w: 'white0', V: 'wood3',
  c: 'frost4', C: 'frost5',
};

const MAGE_BODY = [
  '.nbbbbbn.V..',
  '...fFk...V..',
  '...wwwf..V..',
  '..bwwwbffV..',
  '..bBwBbb.V..',
  '.bbBbbbb.V..',
  '.nbbBbbbn.V.',
  '.nnbbbbnn.V.',
];

/** [idle, idle (crystal glows brighter), casting (the crystal flares)]: hat and staff top change. */
const MAGE_FRAMES = [
  ['....b.......', '...bB....c..', '...bBb..cCc.', '..bByBb..c..', ...MAGE_BODY],
  ['....b.......', '...bB....C..', '...bBb..CWC.', '..bByBb..C..', ...MAGE_BODY],
  ['....b..C.C.C', '...bB...CWC.', '...bBb.CWWWC', '..bByBb.CWC.', ...MAGE_BODY],
];

// ---------------------------------------------------------------- Ballista Tower (Sniper)
// Heavy artillery: low and wide, sandbags and iron, a big crossbow on a turntable.

/** A row of sandbags along the front edge. */
function sandbags(b: Bitmap, y: number): void {
  for (let x = 0; x < 14; x += 3) {
    rect(b, x, y, 3, 2, COLORS.dirt3);
    rect(b, x, y, 3, 1, COLORS.dirt4);
    set(b, x + 2, y + 1, COLORS.dirt1);
  }
}

const BALLISTA_BASES: TowerBase[] = [
  base(14, 10, 1, (b) => {
    for (const x of [1, 6, 11]) post(b, x, 3, 5);
    rect(b, 0, 8, 14, 2, COLORS.stone2);
    planks(b, 0, 0, 14, 3);
    sandbags(b, 3);
  }),
  base(14, 12, 1, (b) => {
    stoneWall(b, 0, 3, 14, 9);
    planks(b, 0, 0, 14, 3);
    rect(b, 0, 3, 14, 1, COLORS.steel2);
    sandbags(b, 4);
    // A rack of spare bolts.
    for (const y of [8, 10]) {
      rect(b, 9, y, 4, 1, COLORS.wood3);
      set(b, 13, y, COLORS.steel4);
    }
  }),
  base(14, 14, 2, (b) => {
    stoneWall(b, 0, 4, 14, 10);
    crenellations(b, 0, 0, 14, 3);
    planks(b, 0, 2, 14, 2);
    rect(b, 0, 4, 14, 1, COLORS.gold2);
    rect(b, 0, 5, 14, 1, COLORS.steel2);
    for (const x of [1, 4, 9, 12]) set(b, x, 9, COLORS.steel4);
    banner(b, 5, 7, 6, 'arcane', 'gold3');
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
  const b = blank(22, 17);
  const a = (dir / BALLISTA_DIRECTIONS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.7;
  // Unit "across" vector in screen space (perpendicular to the aim), also foreshortened.
  const px = -Math.sin(a);
  const py = Math.cos(a) * 0.7;
  const cx = 11;
  const cy = 9;
  const at = (along: number, across = 0): [number, number] => [cx + dx * along + px * across, cy + dy * along + py * across];
  const seg = (a0: number, c0: number, a1: number, c1: number, color: number) => {
    const p0 = at(a0, c0);
    const p1 = at(a1, c1);
    line(b, p0[0], p0[1], p1[0], p1[1], color);
  };

  // Iron-rimmed turntable.
  ellipse(b, cx, cy + 3.5, 5.5, 3, COLORS.steel1);
  ellipse(b, cx, cy + 3, 4.6, 2.4, COLORS.wood1);
  ellipse(b, cx, cy + 2.6, 3.4, 1.6, COLORS.wood2);
  // Stock: four pixels thick, iron-banded.
  seg(-6, 1.5, 5, 1.5, COLORS.wood0);
  seg(-6, 0.5, 5, 0.5, COLORS.wood1);
  seg(-6, -0.5, 5, -0.5, COLORS.wood2);
  seg(-6, -1.5, 5, -1.5, COLORS.wood3);
  for (const along of [-4, 0, 3]) seg(along, -1.5, along, 1.5, COLORS.steel2);
  // Heavy bow: thick arms swept back, steel-banded, with steel tips.
  for (const side of [-1, 1]) {
    seg(3.5, 0, 1.2, side * 8, COLORS.wood0);
    seg(4.2, 0, 1.8, side * 8, COLORS.wood1);
    seg(4.8, 0, 2.4, side * 8, COLORS.wood2);
    const band = at(3, side * 3.5);
    set(b, band[0], band[1], COLORS.steel3);
    const tip = at(1.6, side * 8.3);
    set(b, tip[0], tip[1], COLORS.steel4);
  }
  const tipL = at(1.6, -8.3);
  const tipR = at(1.6, 8.3);
  const pull = loaded ? at(-4.5) : at(2);
  line(b, tipL[0], tipL[1], pull[0], pull[1], COLORS.stone4);
  line(b, tipR[0], tipR[1], pull[0], pull[1], COLORS.stone4);
  if (loaded) {
    seg(-4.5, 0, 7, 0, COLORS.wood3);
    seg(-4.5, 0.5, 7, 0.5, COLORS.wood1);
    for (const along of [7.2, 8, 8.8]) {
      const h = at(along);
      set(b, h[0], h[1], COLORS.steel4);
    }
    const barbL = at(7.4, -1);
    const barbR = at(7.4, 1);
    set(b, barbL[0], barbL[1], COLORS.steel3);
    set(b, barbR[0], barbR[1], COLORS.steel3);
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
