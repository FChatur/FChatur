import { fromRows, outlined, type Bitmap } from '../bitmap';
import { COLORS } from '../palette';

/** Small looping sprites that make the battlefield feel alive. All tiny, cheap, and never in the way. */

const FLAME = [
  ['..y..', '.yoy.', '.ory.', 'orWro', '.rRr.', '..b..'],
  ['.y...', '.oy..', '.oryo', 'orWro', '.rRr.', '..b..'],
  ['...y.', '..yo.', 'oyro.', 'orWro', '.rRr.', '..b..'],
];

const BUTTERFLY = [
  ['a.a', 'aka', 'a.a'],
  ['...', 'aka', '...'],
];

const LEAF = [
  ['.g.', 'gGg', '.g.'],
  ['g..', '.G.', '..g'],
  ['..g', '.G.', 'g..'],
];

const GRASS = [
  ['.l...l.', '.l..l..', '..l.lg.', 'g.lglg.', 'ggggggg'],
  ['..l...l', '..l..l.', '..lgl..', 'g.lglg.', 'ggggggg'],
];

const EYES = [['r.r']];

export function ambientFrames(): Record<string, Bitmap[]> {
  const out: Record<string, Bitmap[]> = {
    torch: FLAME.map((rows) => fromRows(rows, { y: 'gold4', o: 'gold3', r: 'red3', R: 'red2', b: 'wood1' })),
    leaf: LEAF.map((rows) => fromRows(rows, { g: 'gold2', G: 'gold3' })),
    'leaf-green': LEAF.map((rows) => fromRows(rows, { g: 'leaf3', G: 'leaf5' })),
    'sway-grass': GRASS.map((rows) => fromRows(rows, { l: 'grass5', g: 'grass3' })),
    'cave-eyes': EYES.map((rows) => fromRows(rows, { r: 'red4' })),
  };
  for (const [name, wing] of [['orange', 'gold3'], ['blue', 'frost4'], ['white', 'white0'], ['pink', 'pink2']] as const) {
    out[`butterfly-${name}`] = BUTTERFLY.map((rows) => outlined(fromRows(rows, { a: wing }), COLORS.ink1));
  }
  return out;
}
