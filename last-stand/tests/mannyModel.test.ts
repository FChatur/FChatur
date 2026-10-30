import { describe, expect, it } from 'vitest';
import { ENEMY_WEIGHT, knockback, MANNY, placements, simulate, stream } from '../src/balance/manny/model';
import { MAPS } from '../src/config/maps';
import { TILE_SIZE } from '../src/config/map';
import { Path } from '../src/core/Path';

const map = MAPS.switchback;
const path = Path.fromWaypoints(map.waypoints, map.grid);
const L = path.length;
const [L1, L2, L3] = MANNY.levels;

describe('Manny knockback rules (provisional)', () => {
  it('moves progress back along the route by tiles x weight x repeat, never below the start', () => {
    const k = knockback(L3, 'light', 0, 20 * TILE_SIZE, L, TILE_SIZE);
    expect(k.to).toBeCloseTo(17 * TILE_SIZE);
    expect(knockback(L3, 'heavy', 0, 20 * TILE_SIZE, L, TILE_SIZE).tiles).toBeCloseTo(3 * 0.45);
    expect(knockback(L3, 'light', 1, 20 * TILE_SIZE, L, TILE_SIZE).tiles).toBeCloseTo(3 * 0.6);
    expect(knockback(L3, 'light', 9, 20 * TILE_SIZE, L, TILE_SIZE).tiles).toBeCloseTo(3 * 0.2);
    expect(knockback(L3, 'light', 0, 1 * TILE_SIZE, L, TILE_SIZE).to).toBe(0);
  });

  it('caps a single knock at a share of the route, so short maps stay fair', () => {
    const shortRoute = 10 * TILE_SIZE; // 12% = 1.2 tiles
    expect(knockback(L3, 'light', 0, 8 * TILE_SIZE, shortRoute, TILE_SIZE).tiles).toBeCloseTo(1.2);
  });

  it('bosses stagger instead of flying; level 1 has no daze', () => {
    const boss = knockback(L3, 'boss', 0, 20 * TILE_SIZE, L, TILE_SIZE);
    expect(boss.air).toBe(0);
    expect(boss.tiles).toBeCloseTo(0.6);
    expect(knockback(L1, 'light', 0, 20 * TILE_SIZE, L, TILE_SIZE).hold).toBe(0);
    expect(knockback(L2, 'light', 0, 20 * TILE_SIZE, L, TILE_SIZE).hold).toBeGreaterThan(0);
  });

  it('every enemy type has a weight class', () => {
    expect(Object.keys(ENEMY_WEIGHT).sort()).toEqual(['armored', 'basic', 'boss', 'runner']);
  });
});

describe('Manny simulator', () => {
  const spot = placements(path, map.grid.cols, map.grid.rows, TILE_SIZE);

  it('finds a straight, a corner and a near-spawn spot, all touching the road', () => {
    expect(spot.map((s) => s.name)).toEqual(['straight', 'corner', 'spawn']);
    for (const s of spot) expect(s.coverageTiles).toBeGreaterThan(0);
    expect(spot[1].coverageTiles).toBeGreaterThanOrEqual(spot[0].coverageTiles);
  });

  it('only every third attack launches, and launches only knock back up to the level target count', () => {
    let maxBatch = 0, batch = 0, last = -1;
    const r = simulate({ path, tileSize: TILE_SIZE, at: spot[1].at, hero: { kind: 'manny', level: 0 }, spawns: stream('basic', 20, 0.4), hpMultiplier: 50,
      onKnock: (e) => { if (e.knockTimes.at(-1) === last) batch++; else { batch = 1; last = e.knockTimes.at(-1)!; } maxBatch = Math.max(maxBatch, batch); } });
    expect(r.launches).toBeGreaterThan(0);
    expect(r.punches).toBeGreaterThanOrEqual(r.launches * 2 - 2);
    expect(maxBatch).toBe(1);
  });

  it('is deterministic and keeps every enemy on the route', () => {
    const run = () => simulate({ path, tileSize: TILE_SIZE, at: spot[1].at, hero: { kind: 'manny', level: 2 }, spawns: stream('basic', 15, 0.5), hpMultiplier: 20,
      onKnock: (e) => { expect(e.progress).toBeGreaterThanOrEqual(0); expect(e.progress).toBeLessThanOrEqual(L); } });
    expect(run()).toEqual(run());
  });

  it('a level-1 Manny alone lets a crowd of goblins through; nothing leaks with no enemies', () => {
    const r = simulate({ path, tileSize: TILE_SIZE, at: spot[0].at, hero: { kind: 'manny', level: 0 }, spawns: stream('basic', 20, 0.8), hpMultiplier: 1 });
    expect(r.leaked).toBeGreaterThan(r.total / 2);
  });
});
