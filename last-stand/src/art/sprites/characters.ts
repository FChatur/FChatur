import { blank, blit, fromRows, line, outlined, rect, set, type Bitmap, type Legend } from '../bitmap';
import { COLORS } from '../palette';
import { shadedColumn } from '../shapes';
import { banner, bracing, crenellations, leafClump, planks, post, stoneWall } from './build';

/**
 * Tower characters (issue #2). Each tower is a named hero with big
 * head proportions so faces and poses read at gameplay scale, standing on a compact pedestal that
 * evolves with the upgrade level. Heroes are drawn in layers: a body, then arms/weapon per animation
 * frame, then per-level accessories, then one ink outline around the whole figure.
 */

/** `alarm`: a short reaction when a boss appears or the line is breached. */
export type HeroAnim = 'idle' | 'attack' | 'victory' | 'alarm';
export type TowerKind = 'basic' | 'sniper' | 'rapid' | 'frost';

export interface HeroArt {
  /** Pedestal per level (16 art pixels wide: one tile). */
  pedestals: Bitmap[];
  /** Hero frames per level and animation, facing right. */
  frames: Record<HeroAnim, Bitmap[]>[];
  /** Where the hero's feet stand on the pedestal (pixels from the pedestal's top). */
  stand: number[];
}

/** A layer of rows placed at a vertical offset within the hero canvas. */
interface Layer {
  rows: readonly string[];
  y: number;
  x?: number;
}

/** Composes layers (later ones on top) on a canvas, maps them through the legend and outlines the result. */
function compose(w: number, h: number, legend: Legend, layers: readonly Layer[]): Bitmap {
  const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (const layer of layers) {
    layer.rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        const gx = rx + (layer.x ?? 0);
        const gy = ry + layer.y;
        if (ch === '.' || gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
        // '_' erases (lets an accessory cut into the body).
        grid[gy][gx] = ch === '_' ? '.' : ch;
      }
    });
  }
  return outlined(fromRows(grid.map((r) => r.join('')), legend));
}

/** Replaces single characters in a copy of `rows`: [row, col, char]. */
function patch(rows: readonly string[], edits: readonly [number, number, string][]): string[] {
  const out = rows.map((r) => r.split(''));
  for (const [r, c, ch] of edits) out[r][c] = ch;
  return out.map((r) => r.join(''));
}

/** Pedestal helper: draws on a 14-wide interior and outlines to 16. */
function pedestal(h: number, draw: (b: Bitmap) => void): Bitmap {
  const b = blank(14, h);
  draw(b);
  return outlined(b);
}

// ================================================================ ARCHER: "Wren", the dependable defender
// Crimson hood with a trailing tail, confident grin, longbow. Red and leather, a familiar starter hero.

const ARCHER_LEGEND: Legend = {
  H: 'red3', h: 'red2', d: 'red1', f: 'skin2', F: 'skin3', s: 'skin1', v: 'wood2', V: 'wood3', b: 'wood1',
  y: 'gold3', Y: 'gold4', p: 'stone1', B: 'wood0', w: 'wood3', S: 'stone4', x: 'wood4', a: 'steel4', c: 'steel3',
  C: 'steel4', g: 'gold2',
};

const ARCHER_BODY = [
  '......dhh.......',
  '.....dhHHh......',
  '....dhHHHHh.....',
  '...ddhHfFFFh....',
  '..dd.hfFWkFh....',
  '..d..hffFFfh....',
  '.....hsfkkfh....',
  '......hsffh.....',
  '.....vvVVvv.....',
  '....vvVVyVvv....',
  '....vvVVVVvv....',
  '.....bbybbb.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '....BBB..BBB....',
];

const ARCHER_ARMS: Record<string, string[]> = {
  ready: [
    '................', '................', '................', '................', '................',
    '...........w....', '...........Sw...', '...........S.w..', '..........fS.w..', '..........fS.w..',
    '...........S.w..', '...........Sw...', '...........w....',
  ],
  draw: [
    '................', '................', '............w...', '...........S.w..', '..........S...w.',
    '.........S....w.', '........fxxxxxfa', '.........S....w.', '..........S...w.', '...........S.w..',
    '............w...',
  ],
  loose: [
    '................', '................', '............w...', '............Sw..', '............S.w.',
    '............S.w.', '.......ff...fSw.', '............S.w.', '............S.w.', '............Sw..',
    '............w...',
  ],
};

/** Raised bow and fist for the victory cheer (drawn from three rows above the head). */
const ARCHER_CHEER = ['........wwwwww..', '.........SSSS...', '..........ff....', '...........f....', '...........f....'];

const HEAD_ROOM = 3;

function archer(level: number): Record<HeroAnim, Bitmap[]> {
  const W = 16;
  const H = ARCHER_BODY.length + HEAD_ROOM;
  // Level accessories: a feather and a steel pauldron (2), then a gold-trimmed hood and a cape (3).
  const extras: Layer[] = [];
  let body = ARCHER_BODY;
  if (level >= 2) {
    extras.push({ y: HEAD_ROOM - 2, rows: ['...Y....', '..Yy....', '..y.....'] });
    extras.push({ y: HEAD_ROOM + 8, rows: ['....cCc.', '.....c..'] });
  }
  if (level >= 3) {
    body = patch(body, [[3, 11, 'Y'], [4, 11, 'Y'], [5, 11, 'y'], [2, 10, 'Y'], [9, 8, 'Y']]);
    extras.unshift({ y: HEAD_ROOM + 8, rows: ['...dd...', '..ddh...', '..dhh...', '.ddhh...', '.dd.....'] });
  }
  const blink = patch(body, [[4, 8, 'k'], [4, 9, 'k']]);
  const happy = patch(body, [[4, 8, 'k'], [4, 9, 'F'], [6, 8, 'k'], [6, 9, 'k'], [6, 10, 'k']]);
  const startled = patch(body, [[4, 7, 'W'], [4, 8, 'k'], [4, 9, 'W'], [4, 10, 'k'], [6, 8, 'f'], [6, 9, 'k'], [5, 2, '.'], [4, 2, '.'], [3, 3, '.'], [2, 2, 'd'], [1, 3, 'd'], [2, 3, 'd']]);
  const at = (rows: readonly string[]) => ({ rows, y: HEAD_ROOM });
  const bow = (arms: string[]) => (level >= 3 ? arms.map((r) => r.replace(/w/g, 'g')) : arms);
  const frame = (b: readonly string[], arms: string[], bob = 0, more: Layer[] = []) =>
    compose(W, H, ARCHER_LEGEND, [...extras.filter((e) => e.y > HEAD_ROOM + 7).map((e) => ({ ...e, y: e.y + bob })), { rows: b, y: HEAD_ROOM + bob }, ...extras.filter((e) => e.y <= HEAD_ROOM + 7).map((e) => ({ ...e, y: e.y + bob })), { ...at(bow(arms)), y: HEAD_ROOM + bob }, ...more]);
  return {
    idle: [frame(body, ARCHER_ARMS.ready), frame(body, ARCHER_ARMS.ready, 1), frame(blink, ARCHER_ARMS.ready)],
    attack: [frame(body, ARCHER_ARMS.draw), frame(body, ARCHER_ARMS.loose)],
    victory: [frame(happy, [], 0, [{ rows: bow(ARCHER_CHEER), y: 0 }]), frame(happy, [], 1, [{ rows: bow(ARCHER_CHEER), y: 1 }])],
    // Startled: wide eyes, open mouth, hood tail flicked up, an arrow nocked at once.
    alarm: [frame(startled, ARCHER_ARMS.draw), frame(startled, ARCHER_ARMS.draw, 1)],
  };
}

const ARCHER_PEDESTALS = [
  // Timber lookout: a stout plank deck on two posts with a cross brace.
  pedestal(7, (b) => {
    for (const x of [1, 11]) post(b, x, 2, 5);
    bracing(b, 3, 3, 10, 6);
    planks(b, 0, 0, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.red2);
  }),
  // Stone lookout with a red banner.
  pedestal(10, (b) => {
    stoneWall(b, 0, 2, 14, 8);
    planks(b, 0, 0, 14, 2);
    banner(b, 5, 4, 6, 'red');
  }),
  // Keep top: battlements, gold crest shield, twin banners.
  pedestal(13, (b) => {
    stoneWall(b, 0, 2, 14, 11);
    crenellations(b, 0, 0, 14);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    banner(b, 0, 5, 7, 'red');
    banner(b, 11, 5, 7, 'red');
    rect(b, 5, 5, 4, 4, COLORS.red2);
    rect(b, 6, 9, 2, 1, COLORS.red2);
    set(b, 6, 6, COLORS.gold4);
    set(b, 7, 6, COLORS.gold4);
    set(b, 6, 7, COLORS.gold3);
  }),
];

// ================================================================ RANGER: "Fen", the energetic sharpshooter
// A nimble elf: wind-swept green cloak, long pointed ear, blond hair, short bow, always on the balls of the
// feet. Leaner and more dynamic than the Archer; green and gold instead of red and leather.

const RANGER_LEGEND: Legend = {
  G: 'grass5', g: 'grass4', e: 'grass3', E: 'grass2', y: 'gold4', Y: 'gold3', f: 'skin2', F: 'skin3', s: 'skin1',
  v: 'wood3', V: 'wood2', b: 'wood1', B: 'wood0', w: 'wood4', S: 'stone4', x: 'wood4', a: 'steel4', L: 'leaf5',
  l: 'grass6',
};

const RANGER_BODY = [
  '.......yYy......',
  '......yYYyy.....',
  '.....YyFFfy.....',
  '..ff.YfFWkF.....',
  '...ffsfFFfF.....',
  '......sfkff.....',
  'EE.....sff......',
  '.Eeg.eggge......',
  '..EegeGgge......',
  '...EegVvVe......',
  '.....bbybb......',
  '......v..v......',
  '.....v....v.....',
  '....BB....BB....',
];

const RANGER_ARMS: Record<string, string[]> = {
  ready: [
    '................', '................', '................', '................', '................',
    '..........w.....', '..........Sw....', '.........fS.w...', '..........S.w...', '..........Sw....',
    '..........w.....',
  ],
  draw: [
    '................', '................', '................', '...........w....', '..........S.w...',
    '........fxxxxfa.', '..........S.w...', '...........w....',
  ],
  loose: [
    '................', '................', '................', '............w...', '............Sw..',
    '.......ff..fS.w.', '............Sw..', '............w...',
  ],
};

const RANGER_CHEER = ['..........w.....', '.........w.S....', '........ff.S....', '.........w.S....', '..........w.....'];

function ranger(level: number): Record<HeroAnim, Bitmap[]> {
  const W = 16;
  const H = RANGER_BODY.length + HEAD_ROOM;
  let body = RANGER_BODY;
  const extras: Layer[] = [];
  // Level 2: a leaf brooch and a second quiver; level 3: a longer gold-edged cloak and a glowing bow.
  if (level >= 2) {
    // A leaf circlet and a second quiver.
    body = patch(body, [[7, 6, 'y'], [1, 6, 'L'], [1, 10, 'L'], [2, 5, 'e']]);
    extras.push({ y: HEAD_ROOM + 6, rows: ['...BL...', '...BL...', '...B....'] });
  }
  if (level >= 3) {
    // A longer, gold-edged cloak and a falcon companion at her feet.
    extras.unshift({ y: HEAD_ROOM + 6, rows: ['EE......', 'eEE.....', 'yeEE....', '.yeE....', '..y.....'] });
  }
  // Level 3: a falcon companion circling above her shoulder, wings up or down.
  const wings = [
    ['V.....V', '.V...V.', '..VvkY.', '...WW..'],
    ['.......', '..VvkY.', '.VVWWV.', 'V.....V'],
  ];
  const falconAt = (i: number): Layer[] => (level >= 3 ? [{ y: 0, x: 0, rows: wings[i % 2] }] : []);
  let flap = 0;
  const bow = (arms: string[]) => (level >= 3 ? arms.map((r) => r.replace(/w/g, 'l')) : arms);
  const blink = patch(body, [[3, 8, 'k'], [3, 9, 'k']]);
  const happy = patch(body, [[3, 8, 'k'], [3, 9, 'F'], [5, 8, 'k'], [5, 9, 'k']]);
  const alert = patch(body, [[3, 2, '.'], [3, 3, '.'], [2, 3, 'f'], [1, 4, 'f'], [3, 7, 'W'], [5, 8, 'f'], [5, 9, 'k']]);
  const frame = (b: readonly string[], arms: string[], bob = 0, lean = 0, more: Layer[] = []) =>
    compose(W, H, RANGER_LEGEND, [
      ...extras.map((e) => ({ ...e, y: e.y + bob, x: (e.x ?? 0) + lean })),
      { rows: b, y: HEAD_ROOM + bob, x: lean },
      { rows: bow(arms), y: HEAD_ROOM + bob, x: lean },
      ...falconAt(flap++),
      ...more,
    ]);
  return {
    // Bouncing on its toes: up, down, and a blink.
    idle: [frame(body, RANGER_ARMS.ready), frame(body, RANGER_ARMS.ready, 1), frame(blink, RANGER_ARMS.ready, 1)],
    // Leans into each shot.
    attack: [frame(body, RANGER_ARMS.draw, 0, 1), frame(body, RANGER_ARMS.loose, 0, 0)],
    // A hop with the bow thrown up.
    victory: [frame(happy, [], 0, 0, [{ rows: bow(RANGER_CHEER), y: 1 }]), frame(happy, [], 1, 0, [{ rows: bow(RANGER_CHEER), y: 2 }])],
    // Ducks low with the ear pricked up and an arrow already drawn.
    alarm: [frame(alert, RANGER_ARMS.draw, 2, -1), frame(alert, RANGER_ARMS.draw, 1, -1)],
  };
}

const RANGER_PEDESTALS = [
  // A mossy stump.
  pedestal(7, (b) => {
    shadedColumn(b, 2, 2, 10, 5, 'wood', 2);
    rect(b, 2, 0, 10, 2, COLORS.dirt3);
    rect(b, 4, 0, 6, 1, COLORS.dirt4);
    set(b, 7, 1, COLORS.wood2);
    rect(b, 1, 6, 12, 1, COLORS.wood1);
    leafClump(b, 2.5, 1.5, 2.2, 1.6, 4);
  }),
  // A leafy platform in a sapling.
  pedestal(10, (b) => {
    shadedColumn(b, 5, 3, 4, 7, 'wood', 2);
    rect(b, 3, 9, 8, 1, COLORS.wood1);
    leafClump(b, 2, 3.5, 2.6, 2.4, 7);
    leafClump(b, 12, 3.5, 2.6, 2.4, 9);
    planks(b, 1, 0, 12, 2);
  }),
  // The great tree: wide trunk, lanterns, hanging vines.
  pedestal(13, (b) => {
    shadedColumn(b, 4, 3, 6, 10, 'wood', 2);
    rect(b, 1, 12, 12, 1, COLORS.wood1);
    leafClump(b, 2, 4, 3, 3, 13);
    leafClump(b, 12, 4, 3, 3, 15);
    planks(b, 0, 0, 14, 2);
    rect(b, 0, 2, 14, 1, COLORS.gold2);
    for (const x of [1, 12]) {
      set(b, x, 7, COLORS.gold4);
      set(b, x, 8, COLORS.gold2);
    }
    line(b, 4, 3, 4, 8, COLORS.leaf3);
    line(b, 9, 3, 9, 6, COLORS.leaf3);
  }),
];

// ================================================================ BALLISTA: "Brakk", the heavy hitter
// A stocky dwarf engineer with a ginger beard, steel helmet and brass goggles, cranking an oversized
// crossbow. Deliberate wind-up, a recoil that kicks the whole machine, a thumbs-up when the wave is won.

const DWARF_LEGEND: Legend = {
  c: 'steel3', C: 'steel4', t: 'steel2', g: 'gold3', l: 'frost4', f: 'skin2', F: 'skin3', n: 'skin1',
  u: 'gold2', U: 'gold3', r: 'gold1', o: 'water1', O: 'water2', y: 'gold4', B: 'wood0', w: 'wood3', W: 'white0',
  b: 'wood1', V: 'wood3', v: 'wood2',
};

const DWARF_BODY = [
  '....cCCc....',
  '...cCCCCc...',
  '..tccccccct.',
  '..FfkFFkfF..',
  '..fFFnnFFf..',
  '..uUuuuuUu..',
  '.ouuUuuUuuo.',
  'fouuuuuuuuof',
  'fOoruuuuroOf',
  '.OoOyyyyOoO.',
  '..oOOOOOOo..',
  '..oo....oo..',
  '.BBB....BBB.',
];

/** The wrench in his right hand: hanging (idle), raised for the wind-up, swung down on the shot. */
const DWARF_WRENCH = [
  ['............', '............', '............', '............', '............', '............', '............', '............', '............', '...........c', '...........C', '..........cc'],
  ['............', '............', '............', '...........c', '...........C', '...........c', '...........f', '............'],
  ['............', '............', '............', '............', '............', '............', '............', '...........f', '..........fc', '.........cCc'],
];

function dwarf(level: number): Record<HeroAnim, Bitmap[]> {
  const W = 13;
  const H = DWARF_BODY.length + HEAD_ROOM;
  let body = DWARF_BODY;
  const extras: Layer[] = [];
  // Level 1 wears brass goggles up on the helmet; level 2 pulls them down over the eyes and adds a leather
  // tool apron; level 3 has a gold-crested helmet and gold goggles.
  // Goggles always sit up on the helmet so his face stays readable: brass (1), with a leather tool
  // apron and a lamp (2), then gold goggles and a gold-crested helmet (3).
  const goggles = level >= 3 ? '...yllylly..' : '...gllglg...';
  const helmetGoggles: Layer = { y: HEAD_ROOM + 1, rows: [goggles] };
  if (level >= 2) {
    extras.push({ y: HEAD_ROOM + 9, rows: ['...bVVVVb...', '...bVvvVb...', '....bbbb....'] });
    extras.push({ y: HEAD_ROOM - 1, rows: ['........yW..'] });
  }
  if (level >= 3) {
    body = patch(body, [[0, 5, 'y'], [0, 6, 'y'], [1, 4, 'g'], [1, 7, 'g']]);
    extras.push({ y: HEAD_ROOM - 2, rows: ['.....yy.....', '....yggy....'] });
  }
  const blink = patch(body, [[3, 4, 'f'], [3, 7, 'f']]);
  const grin = patch(body, [[5, 4, 'k'], [5, 5, 'W'], [5, 6, 'W'], [5, 7, 'k']]);
  const frame = (b: readonly string[], tool: readonly string[], bob = 0, eyes: Layer = helmetGoggles) =>
    compose(W, H, DWARF_LEGEND, [{ rows: b, y: HEAD_ROOM + bob }, ...[eyes, ...extras].map((e) => ({ ...e, y: e.y + bob })), { rows: tool, y: HEAD_ROOM + bob }]);
  // Battle mode: goggles snapped down over the eyes.
  const battle: Layer = { y: HEAD_ROOM + 3, rows: [level >= 3 ? '..yllyylly..' : '..gllgglg...'] };
  const cheer = ['...........c', '..........cC', '...........f', '...........f'];
  return {
    idle: [frame(body, DWARF_WRENCH[0]), frame(blink, DWARF_WRENCH[0]), frame(body, DWARF_WRENCH[0], 1)],
    // Wind-up: wrench raised; the shot: swung down hard, the dwarf braced (a pixel lower).
    attack: [frame(body, DWARF_WRENCH[1]), frame(body, DWARF_WRENCH[1], -1), frame(grin, DWARF_WRENCH[2], 1)],
    victory: [frame(grin, cheer, 0), frame(grin, ['............', ...cheer], -1)],
    // Goggles down, wrench up: ready for a fight.
    alarm: [frame(grin, DWARF_WRENCH[1], 0, battle), frame(grin, DWARF_WRENCH[1], 1, battle)],
  };
}

const BALLISTA_DIRECTIONS = 8;

/**
 * The oversized crossbow (bigger than Brakk himself), aiming in one of 8 directions, at a level
 * (wood → iron-banded → steel and gold). 21×17 with its outline.
 */
function siegeBow(dir: number, state: 'loaded' | 'fired' | 'cocking', level: number): Bitmap {
  const b = blank(19, 15);
  const a = (dir / BALLISTA_DIRECTIONS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.7;
  const px = -Math.sin(a);
  const py = Math.cos(a) * 0.7;
  const cx = 9;
  const cy = 7;
  const at = (along: number, across = 0): [number, number] => [cx + dx * along + px * across, cy + dy * along + py * across];
  const seg = (a0: number, c0: number, a1: number, c1: number, color: number) => {
    const p0 = at(a0, c0);
    const p1 = at(a1, c1);
    line(b, p0[0], p0[1], p1[0], p1[1], color);
  };
  const metal = level >= 3;
  const arm = (i: number) => (metal ? [COLORS.steel1, COLORS.steel2, COLORS.steel3][i] : [COLORS.wood0, COLORS.wood1, COLORS.wood2][i]);
  // Wheeled carriage (level 1) or iron turntable.
  rect(b, cx - 5, cy + 3, 11, 3, level === 1 ? COLORS.wood1 : COLORS.steel1);
  rect(b, cx - 5, cy + 3, 11, 1, level === 1 ? COLORS.wood2 : COLORS.steel2);
  for (const wx of [cx - 5, cx + 3]) {
    rect(b, wx, cy + 5, 3, 3, COLORS.wood0);
    set(b, wx + 1, cy + 6, level >= 2 ? COLORS.steel3 : COLORS.wood2);
  }
  // Stock: four pixels thick; iron bands from level 2; gears from level 3.
  seg(-6, 1.5, 5, 1.5, COLORS.wood0);
  seg(-6, 0.5, 5, 0.5, COLORS.wood1);
  seg(-6, -0.5, 5, -0.5, COLORS.wood2);
  seg(-6, -1.5, 5, -1.5, COLORS.wood3);
  if (level >= 2) for (const along of [-4, -1, 2]) seg(along, -1.5, along, 1.5, COLORS.steel2);
  if (metal) {
    const g = at(-4, 0);
    for (const [ox, oy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) set(b, g[0] + ox, g[1] + oy, COLORS.gold3);
    set(b, g[0], g[1], COLORS.gold4);
  }
  // Huge bow arms; drawn further back while cocking.
  const pullBack = state === 'cocking' ? -1 : 0;
  const span = 8;
  for (const side of [-1, 1]) {
    seg(3.5, 0, 1 + pullBack, side * span, arm(0));
    seg(4.2, 0, 1.7 + pullBack, side * span, arm(1));
    seg(4.9, 0, 2.4 + pullBack, side * span, arm(2));
    const tip = at(1.4 + pullBack, side * (span + 0.3));
    set(b, tip[0], tip[1], metal ? COLORS.gold4 : COLORS.steel4);
  }
  const tipL = at(1.4 + pullBack, -(span + 0.3));
  const tipR = at(1.4 + pullBack, span + 0.3);
  const pull = state === 'fired' ? at(2.4) : at(state === 'cocking' ? -2.5 : -4.5);
  line(b, tipL[0], tipL[1], pull[0], pull[1], COLORS.stone4);
  line(b, tipR[0], tipR[1], pull[0], pull[1], COLORS.stone4);
  if (state === 'loaded') {
    seg(-4.5, 0, 7, 0, COLORS.wood3);
    seg(-4.5, 0.6, 7, 0.6, COLORS.wood1);
    for (const along of [7.2, 8, 8.8]) {
      const h = at(along);
      set(b, h[0], h[1], metal ? COLORS.gold4 : COLORS.steel4);
    }
    for (const side of [-1, 1]) {
      const barb = at(7.4, side * 1.2);
      set(b, barb[0], barb[1], COLORS.steel3);
    }
  }
  return outlined(b);
}

const BALLISTA_PEDESTALS = [
  // Plank deck on a low timber frame.
  pedestal(6, (b) => {
    planks(b, 0, 0, 14, 3);
    for (const x of [1, 6, 11]) post(b, x, 3, 3);
  }),
  // Stone emplacement with sandbags.
  pedestal(8, (b) => {
    stoneWall(b, 0, 2, 14, 6);
    planks(b, 0, 0, 14, 2);
    for (let x = 0; x < 14; x += 3) {
      rect(b, x, 2, 3, 2, COLORS.dirt3);
      rect(b, x, 2, 3, 1, COLORS.dirt4);
    }
  }),
  // Iron-plated bunker with a pennant and rivets.
  pedestal(11, (b) => {
    rect(b, 0, 2, 14, 9, COLORS.steel1);
    rect(b, 0, 2, 14, 1, COLORS.steel3);
    for (let x = 1; x < 14; x += 3) set(b, x, 5, COLORS.steel4);
    for (let x = 2; x < 14; x += 3) set(b, x, 8, COLORS.steel4);
    planks(b, 0, 0, 14, 2);
    rect(b, 0, 3, 14, 1, COLORS.gold2);
    banner(b, 5, 5, 5, 'arcane', 'gold3');
  }),
];

// ================================================================ FROST MAGE: "Old Rime", the mysterious spellcaster
// An enormous, crooked, star-spangled hat that is taller than he is; eyes glowing under the brim; a long
// white beard; a staff topped with a floating crystal that pulses and blazes when he casts.

const MAGE_LEGEND: Legend = {
  N: 'frost0', n: 'frost1', b: 'frost2', B: 'frost3', c: 'frost4', C: 'frost5', y: 'gold3', Y: 'gold4',
  e: 'frost5', w: 'white0', W: 'white0', s: 'stone4', v: 'wood2', V: 'wood3', i: 'ink1', a: 'arcane2', A: 'arcane3',
  f: 'skin2',
};

const MAGE_BODY = [
  '.......nn.....',
  '......nbbn....',
  '.....nbBbn....',
  '.....nbBBn....',
  '....nbbyBbn...',
  '....nbBBBbn...',
  '...nbbBBBBbn..',
  '.nnnnnnnnnnnnn',
  '...iieiieii...',
  '...iwwwwwwi...',
  '....wwswww....',
  '...bbwwswbb...',
  '..bbBwswBbbb..',
  '..bBBBwBBBbb..',
  '.bbBBBBBBBbbb.',
  '.nbbbbbbbbbbn.',
];

const MAGE_STAFF = ['..............', '..............', '..............', '..............', '..............', '..............', '..............', '..............', '............V.', '...........fV.', '............V.', '............V.', '............V.', '............V.', '............V.', '............V.'];

function frostMage(level: number): Record<HeroAnim, Bitmap[]> {
  const W = 16;
  const H = MAGE_BODY.length + HEAD_ROOM + 2;
  const top = HEAD_ROOM + 2;
  let body = MAGE_BODY;
  // The hat grows with each level; at level 3 it carries a crystal crown and the robe gets gold stars.
  if (level === 1) body = patch(body, [[0, 7, '.'], [0, 8, '.'], [1, 6, '.'], [1, 7, 'n'], [1, 8, 'n'], [1, 9, '.']]);
  if (level >= 3) body = patch(body, [[12, 4, 'y'], [13, 9, 'y'], [14, 6, 'Y'], [5, 6, 'Y']]);
  const hatTip: Layer[] = level >= 2 ? [{ y: top - 3, x: 0, rows: ['.........nn...', '........nbn...', '........nb....'] }] : [];
  if (level >= 3) hatTip.push({ y: top - 5, x: 0, rows: ['..........C...', '.........cCc..'] });
  const glow = (state: 0 | 1 | 2): Layer => {
    const crystal = [
      ['............c.', '...........cCc', '............c.'],
      ['............C.', '...........CWC', '............C.'],
      ['..........C.C.C', '...........CWC.', '..........CWWWC', '...........CWC.', '..........C.C.C'],
    ][state];
    return { y: top + 5 - (state === 2 ? 1 : 0), x: state === 2 ? -1 : 0, rows: crystal };
  };
  const blink = patch(body, [[8, 5, 'i'], [8, 8, 'i']]);
  const flare = patch(body, [[8, 5, 'W'], [8, 8, 'W']]);
  const frame = (b: readonly string[], state: 0 | 1 | 2, bob = 0, staffUp = 0) =>
    compose(W, H, MAGE_LEGEND, [
      ...hatTip.map((l) => ({ ...l, y: l.y + bob })),
      { rows: b, y: top + bob },
      { rows: MAGE_STAFF, y: top + bob - staffUp },
      { ...glow(state), y: glow(state).y + bob - staffUp },
    ]);
  return {
    // The hat sways and the crystal pulses.
    idle: [frame(body, 0), frame(body, 1, 1), frame(blink, 0)],
    attack: [frame(body, 1, 0, 1), frame(body, 2, 0, 2)],
    victory: [frame(body, 2, 0, 3), frame(body, 1, -1, 3)],
    // Eyes flare white under the brim, the hat jolts up and the crystal blazes.
    alarm: [frame(flare, 2, -1, 2), frame(flare, 1, 0, 1)],
  };
}

const FROST_PEDESTALS = [
  // A rune stone.
  pedestal(7, (b) => {
    shadedColumn(b, 2, 1, 10, 6, 'stone', 3);
    rect(b, 2, 0, 10, 1, COLORS.stone4);
    for (const x of [4, 7, 10]) set(b, x, 3, COLORS.frost4);
  }),
  // A frozen pillar with ice shards.
  pedestal(10, (b) => {
    shadedColumn(b, 3, 1, 8, 9, 'stone', 3);
    rect(b, 3, 0, 8, 1, COLORS.frost4);
    for (let y = 2; y < 9; y += 3) set(b, 6, y, COLORS.frost5);
    for (const x of [0, 12]) {
      line(b, x, 9, x, 5, COLORS.frost4);
      set(b, x, 4, COLORS.frost5);
      line(b, x + 1, 9, x + 1, 7, COLORS.frost3);
    }
  }),
  // A floating crystal dais: an ice platform hovering over a glowing rune circle.
  pedestal(13, (b) => {
    rect(b, 1, 0, 12, 3, COLORS.frost3);
    rect(b, 1, 0, 12, 1, COLORS.frost5);
    rect(b, 3, 3, 8, 2, COLORS.frost2);
    rect(b, 5, 5, 4, 2, COLORS.frost1);
    set(b, 6, 7, COLORS.frost1);
    rect(b, 0, 10, 14, 3, COLORS.stone2);
    rect(b, 0, 10, 14, 1, COLORS.stone3);
    for (let x = 1; x < 14; x += 2) set(b, x, 11, COLORS.frost4);
    for (const [x, y] of [[1, 5], [12, 6], [3, 8], [10, 8]]) set(b, x, y, COLORS.frost5);
  }),
];

// ================================================================ assembly

let heroCache: Record<TowerKind, HeroArt> | null = null;

/** Every hero's frames (built once; the result is shared, so don't modify it). */
export function heroArt(): Record<TowerKind, HeroArt> {
  heroCache ??= buildHeroArt();
  return heroCache;
}

function buildHeroArt(): Record<TowerKind, HeroArt> {
  const levels = [1, 2, 3];
  return {
    basic: { pedestals: ARCHER_PEDESTALS, frames: levels.map(archer), stand: [1, 1, 1] },
    rapid: { pedestals: RANGER_PEDESTALS, frames: levels.map(ranger), stand: [1, 1, 1] },
    sniper: { pedestals: BALLISTA_PEDESTALS, frames: levels.map(dwarf), stand: [2, 2, 2] },
    frost: { pedestals: FROST_PEDESTALS, frames: levels.map(frostMage), stand: [1, 1, 1] },
  };
}

export { siegeBow, BALLISTA_DIRECTIONS };

/**
 * How the Ballista's three parts stack, in art pixels: a 22-wide picture (the tile plus 3 on each side)
 * with the pedestal centred, Brakk at the left behind the crossbow, the crossbow right-aligned in front.
 * `...BelowDeck`: how far each part's bottom edge sits below the pedestal's top.
 */
export const BALLISTA_LAYOUT = { width: 22, pedestalX: 3, heroX: 0, heroBelowDeck: 3, bowBelowDeck: 9 } as const;

/** Little reaction marks drawn over a hero's head. */
export type Emote = 'alert' | 'sweat' | 'star';

export function heroEmotes(): Record<Emote, Bitmap> {
  const legend: Legend = { r: 'red3', R: 'red4', b: 'frost3', B: 'frost5', y: 'gold3', Y: 'gold4' };
  const make = (rows: string[]) => outlined(fromRows(rows, legend));
  return {
    // A boss is coming.
    alert: make(['RR', 'rr', 'rr', 'rr', '..', 'rr']),
    // Lives were lost.
    sweat: make(['.B.', '.b.', 'bBb', 'bbb', '.b.']),
    // A boss wave won.
    star: make(['..Y..', '.YyY.', 'YyyyY', '.yyy.', '.y.y.']),
  };
}


/**
 * A complete tower picture at a level for previews and UI portraits: pedestal with the hero on top
 * (and, for the Ballista, the engineer behind his crossbow aiming at `dir`).
 */
export function heroTower(kind: TowerKind, level: number, anim: HeroAnim = 'idle', frame = 0, dir = 1): Bitmap {
  const art = heroArt()[kind];
  const ped = art.pedestals[level - 1];
  const hero = art.frames[level - 1][anim][frame % art.frames[level - 1][anim].length];
  if (kind !== 'sniper') {
    const heroTop = Math.max(0, hero.h - art.stand[level - 1] - 1);
    const out = blank(Math.max(ped.w, hero.w), heroTop + ped.h);
    blit(out, ped, Math.floor((out.w - ped.w) / 2), heroTop);
    blit(out, hero, Math.floor((out.w - hero.w) / 2) + (kind === 'frost' ? 0 : 0), heroTop - hero.h + art.stand[level - 1] + 1);
    return out;
  }
  // Ballista: Brakk stands behind his crossbow, which is bigger than he is and sits in front on the deck.
  const state = anim === 'attack' ? (['cocking', 'cocking', 'fired'] as const)[frame % 3] : 'loaded';
  const bow = siegeBow(dir, state, level);
  const recoil = anim === 'attack' && frame % 3 === 2 ? -1 : 0;
  const L = BALLISTA_LAYOUT;
  const H = ped.h + 22;
  const out = blank(L.width, H);
  const deck = H - ped.h;
  blit(out, ped, L.pedestalX, deck);
  blit(out, hero, L.heroX, deck - hero.h + L.heroBelowDeck);
  blit(out, bow, L.width - bow.w + recoil, deck - bow.h + L.bowBelowDeck);
  return out;
}
