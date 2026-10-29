import { blank, fromRows, line, outlined, set, type Bitmap } from '../bitmap';
import { COLORS } from '../palette';

/**
 * Projectiles. Arrows and bolts are rasterised in 16 directions (pixel art is never rotated freely);
 * direction 0 points east and directions go clockwise in 22.5° steps.
 */
export const PROJECTILE_DIRECTIONS = 16;

interface ShaftSpec {
  length: number;
  shaft: number;
  head: number;
  fletching: number;
  /** Shaft thickness: 1 for arrows, 2 for ballista bolts. */
  thickness: number;
  headLength: number;
}

function shaft(spec: ShaftSpec, dir: number): Bitmap {
  const size = spec.length + 3;
  const b = blank(size, size);
  const a = (dir / PROJECTILE_DIRECTIONS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const c = (size - 1) / 2;
  const half = (spec.length - 1) / 2;
  const tail = [c - dx * half, c - dy * half];
  const tip = [c + dx * half, c + dy * half];
  for (let t = 0; t < spec.thickness; t++) {
    // Offset thick shafts perpendicular to their direction.
    const ox = -dy * t * 0.8;
    const oy = dx * t * 0.8;
    line(b, tail[0] + ox, tail[1] + oy, tip[0] + ox, tip[1] + oy, t === 0 ? spec.shaft : COLORS.wood1);
  }
  for (let i = 0; i < spec.headLength; i++) set(b, tip[0] - dx * i, tip[1] - dy * i, spec.head);
  set(b, tail[0], tail[1], spec.fletching);
  set(b, tail[0] + dx, tail[1] + dy, spec.fletching);
  return outlined(b);
}

const ARROW: ShaftSpec = { length: 7, shaft: COLORS.wood3, head: COLORS.steel4, fletching: COLORS.white0, thickness: 1, headLength: 1 };
const RANGER_ARROW: ShaftSpec = { length: 6, shaft: COLORS.wood3, head: COLORS.steel4, fletching: COLORS.leaf4, thickness: 1, headLength: 1 };
const BOLT: ShaftSpec = { length: 11, shaft: COLORS.wood3, head: COLORS.steel4, fletching: COLORS.red3, thickness: 2, headLength: 3 };

const SHARD = [
  ['..c..', '.cCc.', 'cCWCc', '.cCc.', '..c..'],
  ['..C..', '.cWc.', 'CWWWC', '.cWc.', '..C..'],
];

export function projectileFrames(): Record<string, Bitmap[]> {
  const dirs = (spec: ShaftSpec) => Array.from({ length: PROJECTILE_DIRECTIONS }, (_, d) => shaft(spec, d));
  return {
    arrow: dirs(ARROW),
    'ranger-arrow': dirs(RANGER_ARROW),
    bolt: dirs(BOLT),
    shard: SHARD.map((rows) => outlined(fromRows(rows, { c: 'frost3', C: 'frost4' }), COLORS.frost1)),
  };
}

/** Index of the frame facing `angle` (radians, screen space). */
export function directionIndex(angle: number, directions: number): number {
  const turn = (angle / (Math.PI * 2)) * directions;
  return ((Math.round(turn) % directions) + directions) % directions;
}
