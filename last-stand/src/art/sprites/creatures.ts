import { blank, blit, fromRows, line, outlined, rect, set, type Bitmap, type Legend } from '../bitmap';
import { COLORS } from '../palette';
import { shadedColumn, shadedEllipse } from '../shapes';

/**
 * Enemy creatures, drawn facing right (the renderer flips them when walking left). Each walk cycle has
 * four frames: contact, passing, contact (other leg), passing. Bodies are drawn without an outline;
 * `outlined` adds the ink outline so every creature gets an identical one.
 */

// ---------------------------------------------------------------- Goblin (Grunt)

const GOBLIN: Legend = {
  G: 'goblin3', g: 'goblin2', h: 'goblin1', H: 'goblin0',
  y: 'red4', r: 'red2', R: 'red1', b: 'wood1', B: 'wood2', s: 'steel4', w: 'wood3',
};

const GOBLIN_BODY = [
  '.....GGGG.....',
  'Gg..GGGGggg...',
  'hgg.GGgggggg..',
  '.hhgGgggggyKg.',
  '..hhgggggggggg',
  '...hgggggkkkW.',
  '....hhhhhhhh..',
  '....rRrrr.....',
  '...hrrrrrggsss',
  '....bbBbb.w...',
  '....RrrRR.....',
];

const GOBLIN_LEGS = [
  ['....hh..gg....', '...hh....gg...', '...hh....gh...', '..HH......hh..'],
  ['.....hgg......', '.....hgg......', '.....hgh......', '....HHhh......'],
  ['....gg..hh....', '...gg....hh...', '...gh....hh...', '..hh......HH..'],
  ['......ggh.....', '......ggh.....', '......ghh.....', '......hhHH....'],
];

// ---------------------------------------------------------------- Wolf (Runner)

const WOLF: Legend = { F: 'fur3', f: 'fur2', d: 'fur1', D: 'fur0', l: 'fur4', y: 'red4' };

const WOLF_BODY = [
  '.............dd...',
  'd...........dfd...',
  'dfd........dfffd..',
  '.dffDDDDDDDDdfyfd.',
  '..dffffffffffffllk',
  '...dffffffffffFkW.',
  '....ffffffffFFF...',
  '.....dlllllFFF....',
];

const WOLF_LEGS = [
  ['...dd........ff...', '..dd..........ff..', '.dd............ff.', 'DD..............DD'],
  ['...dd.......ff....', '..dd........ff....', '.dd.........ff....', 'DD..........DD....'],
  ['.....dd...ff......', '......dd.ff.......', '.......dff........', '.......DDD........'],
  ['....dd.......ff...', '...dd.........ff..', '..dd...........ff.', '.DD.............DD'],
];

// ---------------------------------------------------------------- Armored Orc (Brute)

const ORC: Legend = {
  S: 'steel4', s: 'steel3', t: 'steel2', T: 'steel1', U: 'steel0',
  O: 'orc3', o: 'orc2', p: 'orc1', P: 'orc0', e: 'red4', b: 'wood1', B: 'wood2', w: 'wood3', r: 'red2', R: 'red1',
  h: 'dirt4', H: 'white0',
};

const ORC_BODY = [
  '..h..SSSSs..h..',
  '..hHSSsssstHh..',
  '....TTTTtTT.SS.',
  '....poOOeOosSs.',
  '....poOOOOOotSt',
  '....ppoWoWoo.w.',
  '.SSSsppppoo..w.',
  'SSsssTttttTooO.',
  '.TsstttttTTb.w.',
  '..TTtttTTTbB.w.',
  '...bBbbbbBb..w.',
  'R..rRrrrRr...w.',
  'RR.RrrrrrR.....',
];

const ORC_LEGS = [
  ['...pp...oo.....', '..pp.....oo....', '..TT.....tt....', '.UTT.....tTt...'],
  ['.....ppoo......', '.....ppoo......', '.....TTtt......', '....UTTtTt.....'],
  ['...oo...pp.....', '..oo.....pp....', '..tt.....TT....', '.tTt.....UTT...'],
  ['......oopp.....', '......oopp.....', '......ttTT.....', '.....tTtUTT....'],
];

/** Vertical body offset per frame: the body dips on passing frames. */
const STEP_BOB = [0, 1, 0, 1];

function walkCycle(body: readonly string[], legs: readonly (readonly string[])[], legend: Legend, bob = STEP_BOB): Bitmap[] {
  const top = fromRows(body, legend);
  return legs.map((rows, i) => {
    const leg = fromRows(rows, legend);
    const frame = blank(top.w, top.h + leg.h);
    blit(frame, leg, 0, top.h);
    blit(frame, top, 0, bob[i]);
    return outlined(frame);
  });
}

// ---------------------------------------------------------------- Ogre Warlord (boss)

/** A separately outlined part, so overlapping parts stay readable (internal ink lines). */
function part(w: number, h: number, draw: (b: Bitmap) => void): Bitmap {
  const b = blank(w, h);
  draw(b);
  return outlined(b);
}

/** Built from shaded shapes (it is too large to hand-place every pixel), then detailed by hand. */
function ogreFrame(step: number): Bitmap {
  const W = 31;
  const H = 31;
  const out = blank(W, H);
  const bob = step % 2;
  const stride = step === 0 ? 2 : step === 2 ? -2 : 0;
  const sway = step === 1 ? 1 : step === 3 ? -1 : 0;
  const add = (p: Bitmap) => blit(out, p, -1, -1);

  // Back to front: far leg, far arm, near leg, loincloth, belly, head, near arm, club.
  add(part(W, H, (b) => {
    shadedColumn(b, 9 - stride, 21 + bob, 4, 6 - bob, 'ogre', 1);
    rect(b, 8 - stride, 26, 6, 2, COLORS.ogre0);
  }));
  add(part(W, H, (b) => shadedEllipse(b, 6.5, 14.5 + bob, 2.8, 5.2, 'ogre', 1)));
  add(part(W, H, (b) => {
    shadedColumn(b, 14 + stride, 21 + bob, 4, 6 - bob, 'ogre', 2);
    rect(b, 14 + stride, 26, 6, 2, COLORS.ogre1);
    rect(b, 14 + stride, 26, 6, 1, COLORS.ogre2);
  }));
  add(part(W, H, (b) => {
    shadedColumn(b, 8, 19 + bob, 12, 4, 'arcane', 2);
    rect(b, 8, 19 + bob, 12, 1, COLORS.gold2);
  }));
  add(part(W, H, (b) => {
    shadedEllipse(b, 14, 14 + bob, 8, 7.4, 'ogre', 2);
    // War paint: a red V across the chest.
    line(b, 10, 10 + bob, 12, 13 + bob, COLORS.red2);
    line(b, 12, 13 + bob, 14, 10 + bob, COLORS.red2);
  }));
  add(part(W, H, (b) => {
    shadedEllipse(b, 17.5, 6.5 + bob, 4.8, 4.3, 'ogre', 2);
    shadedEllipse(b, 18.5, 9.6 + bob, 4, 2.2, 'ogre', 2);
    // Heavy brow, eyes, nose and tusks.
    rect(b, 16, 5 + bob, 6, 1, COLORS.ogre0);
    set(b, 17, 6 + bob, COLORS.red4);
    set(b, 20, 6 + bob, COLORS.red4);
    set(b, 21, 8 + bob, COLORS.ogre1);
    for (const x of [16, 20]) {
      set(b, x, 9 + bob, COLORS.white0);
      set(b, x, 8 + bob, COLORS.white0);
    }
    rect(b, 17, 10 + bob, 3, 1, COLORS.ink1);
    // Iron crown with three spikes.
    rect(b, 14, 2 + bob, 7, 2, COLORS.gold2);
    rect(b, 14, 2 + bob, 7, 1, COLORS.gold3);
    for (const x of [14, 17, 20]) set(b, x, 1 + bob, COLORS.gold4);
  }));
  add(part(W, H, (b) => {
    shadedEllipse(b, 21.5, 13.5 + bob, 2.8, 3.8, 'ogre', 2);
    shadedEllipse(b, 23, 17.5 + bob, 2.6, 2.6, 'ogre', 2);
  }));
  add(part(W, H, (b) => {
    for (let w = 0; w < 2; w++) line(b, 23 + w, 19 + bob, 25 + w + sway, 24, COLORS.wood2);
    shadedEllipse(b, 26 + sway, 26, 2.7, 2.7, 'wood', 3);
    for (const [x, y] of [[24, 23], [28, 25], [26, 28], [27, 23]]) set(b, x + sway, y, COLORS.steel4);
  }));
  return out;
}

export function creatureFrames(): Record<string, Bitmap[]> {
  return {
    'goblin-walk': walkCycle(GOBLIN_BODY, GOBLIN_LEGS, GOBLIN),
    'wolf-run': walkCycle(WOLF_BODY, WOLF_LEGS, WOLF, [1, 1, 0, 0]),
    'orc-walk': walkCycle(ORC_BODY, ORC_LEGS, ORC),
    'ogre-walk': [0, 1, 2, 3].map(ogreFrame),
  };
}
