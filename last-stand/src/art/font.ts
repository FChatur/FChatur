import { blank, blit, outlined, set, type Bitmap } from './bitmap';
import { COLORS, INK } from './palette';

/**
 * An original 5 × 7 pixel font for text drawn on the battlefield (floating gold, level-ups, wave
 * banners). Glyphs are proportional (empty columns trimmed); text is rendered with an ink outline baked
 * in, so it reads on any background. Lowercase letters render as capitals.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
};

export const GLYPH_HEIGHT = 7;
const SPACE_WIDTH = 3;
const TRACKING = 1;

/** Trims empty columns so glyphs are proportional. */
function trimmed(rows: string[]): string[] {
  const w = rows[0].length;
  let left = 0;
  let right = w - 1;
  while (left < right && rows.every((r) => r[left] === '.')) left++;
  while (right > left && rows.every((r) => r[right] === '.')) right--;
  return rows.map((r) => r.slice(left, right + 1));
}

const TRIMMED: Record<string, string[]> = Object.fromEntries(Object.entries(GLYPHS).map(([k, v]) => [k, trimmed(v)]));

export function hasGlyph(ch: string): boolean {
  return ch === ' ' || ch.toUpperCase() in TRIMMED;
}

/** Width of `text` in art pixels before the outline. Unknown characters render as '?'. */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (ch === ' ' ? SPACE_WIDTH : (TRIMMED[ch.toUpperCase()] ?? TRIMMED['?'])[0].length) + TRACKING;
  return Math.max(0, w - TRACKING);
}

/** Renders text in `color` (0xRRGGBB, a palette colour) with an ink outline; 2 pixels larger each way. */
export function textBitmap(text: string, color: number = COLORS.white0): Bitmap {
  const b = blank(Math.max(1, textWidth(text)), GLYPH_HEIGHT);
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += SPACE_WIDTH + TRACKING;
      continue;
    }
    const rows = TRIMMED[ch.toUpperCase()] ?? TRIMMED['?'];
    rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') set(b, x + i, y, color);
    });
    x += rows[0].length + TRACKING;
  }
  return outlined(b, INK);
}

/** Text at `scale` (whole art pixels per font pixel), for large banners. */
export function scaledText(text: string, color: number, scale: number): Bitmap {
  const small = textBitmap(text, color);
  const big = blank(small.w * scale, small.h * scale);
  const tmp = blank(1, 1);
  void tmp;
  for (let y = 0; y < small.h; y++) {
    for (let x = 0; x < small.w; x++) {
      const i = (y * small.w + x) * 4;
      if (small.data[i + 3] === 0) continue;
      const c = (small.data[i] << 16) | (small.data[i + 1] << 8) | small.data[i + 2];
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) set(big, x * scale + xx, y * scale + yy, c);
    }
  }
  return blit(blank(big.w, big.h), big, 0, 0);
}
