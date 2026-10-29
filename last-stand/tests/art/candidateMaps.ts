import type { TileCoord } from '../../src/config/map';
import { MAPS } from '../../src/config/maps';

/**
 * Candidate map layouts for issue #4 (design phase, not in the game yet). Blocked tiles are terrain
 * nobody can build on: water (lakes, rivers) or cliffs (rock).
 */
export interface CandidateMap {
  id: string;
  name: string;
  tier: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  waypoints: readonly TileCoord[];
  blocked: { col: number; row: number; kind: 'water' | 'cliff' }[];
  seed: number;
}

const rect = (c0: number, r0: number, c1: number, r1: number, kind: 'water' | 'cliff', skip: (c: number, r: number) => boolean = () => false) => {
  const out: CandidateMap['blocked'] = [];
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (!skip(c, r)) out.push({ col: c, row: r, kind });
  return out;
};

export const CANDIDATES: CandidateMap[] = [
  {
    id: 'millbrook',
    name: 'Millbrook Meadows',
    tier: 'Beginner',
    waypoints: [{ col: -1, row: 1 }, { col: 17, row: 1 }, { col: 17, row: 4 }, { col: 2, row: 4 }, { col: 2, row: 7 }, { col: 17, row: 7 }, { col: 17, row: 10 }, { col: 20, row: 10 }],
    blocked: [],
    seed: 11,
  },
  {
    id: 'switchback',
    name: 'Switchback',
    tier: 'Intermediate',
    waypoints: MAPS.switchback.waypoints,
    blocked: [],
    seed: 7,
  },
  {
    id: 'ridge-pass',
    name: 'Ridge Pass',
    tier: 'Advanced',
    waypoints: [{ col: -1, row: 6 }, { col: 6, row: 6 }, { col: 6, row: 2 }, { col: 13, row: 2 }, { col: 13, row: 9 }, { col: 20, row: 9 }],
    blocked: [...rect(7, 3, 12, 4, 'cliff'), ...rect(12, 5, 12, 8, 'cliff'), ...rect(14, 3, 14, 8, 'cliff'), ...rect(0, 7, 5, 7, 'cliff')],
    seed: 23,
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
    tier: 'Expert',
    waypoints: [{ col: -1, row: 3 }, { col: 9, row: 3 }, { col: 9, row: 8 }, { col: 20, row: 8 }],
    blocked: [
      ...rect(0, 4, 8, 11, 'water', (c, r) => c >= 6 && r <= 6),
      ...rect(10, 0, 19, 7, 'cliff', (c, r) => c <= 12 && r >= 4),
    ],
    seed: 31,
  },
];
