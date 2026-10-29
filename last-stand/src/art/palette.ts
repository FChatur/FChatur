/**
 * The one palette every sprite is drawn from (docs/VISUAL_PROTOTYPE.md, "Palette and rendering rules").
 * Colours are grouped in ramps from dark to light; sprites name them as `<ramp><index>`, e.g. `stone2`.
 * A unit test checks that every sprite uses only these colours.
 */
const RAMPS = {
  /** Outline ink and the deepest shadow. */
  ink: [0x1a1424, 0x2c2438],
  stone: [0x3b3950, 0x565670, 0x77788f, 0x9c9db0, 0xc7c8d4],
  wood: [0x3d2421, 0x5c3628, 0x7c4e33, 0xa06b42, 0xc8945d],
  dirt: [0x5a3a26, 0x7e5432, 0xa57446, 0xc99a5e, 0xe6c389],
  /** Warm, saturated meadow greens; the last tone is sunlit grass. */
  grass: [0x1e4527, 0x2b6131, 0x3c7f38, 0x529e40, 0x72ba4c, 0xa3d765, 0xcfe88a],
  /** Cooler, deeper greens for tree canopies, so the forest frames the warmer clearing. */
  leaf: [0x0f2a24, 0x174536, 0x23643f, 0x368449, 0x59a653, 0x8fcb6a],
  /** Olive-khaki, so goblins stand out from the meadow greens. */
  goblin: [0x4f4a1f, 0x7f7a2a, 0xb3ac3f, 0xdfd76a],
  orc: [0x3a4430, 0x55623f, 0x738352, 0x95a46a],
  ogre: [0x5a3326, 0x87513a, 0xb27652, 0xd6a079],
  skin: [0x6b3f33, 0xa3664e, 0xd6987a, 0xf0c4a3],
  fur: [0x2f2a2e, 0x4a4448, 0x6b6466, 0x948b8a, 0xc4bbb3],
  steel: [0x2f3446, 0x4d5670, 0x7884a0, 0xaab6cc, 0xe1e8f2],
  red: [0x4a1628, 0x7a2032, 0xb03440, 0xde5d4f, 0xf59a73],
  gold: [0x6b3f12, 0xa3631c, 0xd9972f, 0xf2c94c, 0xfbe7a1],
  frost: [0x1d2b55, 0x28509a, 0x3b82d6, 0x6cbcf0, 0xb8e8ff, 0xeffaff],
  arcane: [0x2e1d45, 0x4b2d6e, 0x704199, 0x9a62c2],
  pink: [0x8f2f5a, 0xd65c86, 0xf59ab6],
  water: [0x1d3f6b, 0x2a6a9e, 0x4b9cc9, 0x96d6ee],
  white: [0xf4efe4],
} as const;

export type Ramp = keyof typeof RAMPS;

/** Every palette colour by name (`stone2`, `ink0`, `white0`, ...). */
export const COLORS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(RAMPS).flatMap(([ramp, shades]) => shades.map((c, i) => [`${ramp}${i}`, c])),
);

/** The ramp's colour at `index` (clamped), for code that shades procedurally. */
export function shade(ramp: Ramp, index: number): number {
  const shades = RAMPS[ramp];
  return shades[Math.max(0, Math.min(shades.length - 1, Math.round(index)))];
}

export function rampLength(ramp: Ramp): number {
  return RAMPS[ramp].length;
}

const RAMP_OF = new Map<number, { ramp: Ramp; index: number }>();
for (const [ramp, shades] of Object.entries(RAMPS)) shades.forEach((c, index) => RAMP_OF.set(c, { ramp: ramp as Ramp, index }));

/** The same colour `steps` lighter (+) or darker (-) within its ramp; unchanged if not a ramp colour. */
export function shift(color: number, steps: number): number {
  const at = RAMP_OF.get(color);
  return at ? shade(at.ramp, at.index + steps) : color;
}

/** Outline colour for sprites. */
export const INK: number = RAMPS.ink[0];

export const PALETTE_VALUES: ReadonlySet<number> = new Set(Object.values(COLORS));

/** `#rrggbb`, for CSS. */
export const cssHex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
