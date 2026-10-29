import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { TOWERS } from '../src/config/towers';
import { makeSim, runUntil, STEP } from './helpers';

const turretCost = TOWERS.basic.cost;

describe('tower placement', () => {
  // These check list prices, so the run's free starter Archer is switched off (see economy.test.ts).
  it('deducts gold and occupies the tile', () => {
    const { sim } = makeSim({ freeStarterTower: null });
    const tower = sim.placeTower('basic', 2, 4);
    expect(tower).not.toBeNull();
    expect(sim.gold).toBe(BALANCE.startingGold - turretCost);
    expect(sim.towerAt(2, 4)).toBe(tower);
    expect(sim.canPlaceTower('basic', 2, 4)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('rejects path tiles, out-of-bounds tiles and unaffordable towers', () => {
    const { sim } = makeSim({ startingGold: turretCost - 1, freeStarterTower: null });
    expect(sim.canPlaceTower('basic', 0, 2)).toEqual({ ok: false, reason: 'path' });
    expect(sim.canPlaceTower('basic', -1, 0)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(sim.canPlaceTower('basic', 0, 12)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(sim.canPlaceTower('basic', 2, 4)).toEqual({ ok: false, reason: 'insufficient-gold' });
    expect(sim.placeTower('basic', 2, 4)).toBeNull();
    expect(sim.gold).toBe(turretCost - 1);
  });
});

describe('waves', () => {
  it('only starts a wave during the build phase', () => {
    const { sim } = makeSim();
    expect(sim.startWave()).toBe(true);
    expect(sim.phase).toBe('wave');
    expect(sim.startWave()).toBe(false);
    expect(sim.wave).toBe(1);
  });

  it('spawns every enemy in the plan', () => {
    const { sim, bus } = makeSim();
    let leaked = 0;
    bus.on('enemyLeaked', () => leaked++);
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
    expect(leaked).toBe(BALANCE.waves.baseCount);
  });

  it('enemies leaking reduce health, and the run ends at zero', () => {
    const { sim, bus } = makeSim({ startingHealth: 3 });
    let over = 0;
    bus.on('gameOver', () => over++);
    sim.startWave();
    runUntil(sim, () => sim.phase === 'gameover');
    expect(sim.phase).toBe('gameover');
    expect(sim.health).toBe(0);
    expect(over).toBe(1);
    // A finished run ignores further input.
    sim.step(STEP);
    expect(sim.startWave()).toBe(false);
    expect(sim.placeTower('basic', 2, 4)).toBeNull();
  });

  it('pays the clear bonus and returns to build when a wave is beaten', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    // Ring the first corridor with turrets so nothing gets through wave 1.
    for (const [c, r] of [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3], [5, 3], [5, 4], [3, 5]]) {
      expect(sim.placeTower('basic', c, r)).not.toBeNull();
    }
    const cleared: number[] = [];
    bus.on('waveCleared', ({ bonus }) => cleared.push(bonus));
    sim.startWave();
    const goldBefore = sim.gold;
    runUntil(sim, () => sim.phase === 'build');
    expect(sim.phase).toBe('build');
    expect(sim.stats.leaks).toBe(0);
    expect(sim.stats.kills).toBe(BALANCE.waves.baseCount);
    expect(cleared).toEqual([BALANCE.waves.clearBonusBase]);
    expect(sim.gold).toBe(goldBefore + BALANCE.waves.baseCount * 4 + BALANCE.waves.clearBonusBase);
    expect(sim.enemies).toHaveLength(0);
  });
});

describe('combat', () => {
  it('towers fire at enemies in range and respect fire rate', () => {
    const { sim, bus } = makeSim();
    sim.placeTower('basic', 1, 3);
    let shots = 0;
    bus.on('towerFired', () => shots++);
    sim.startWave();
    const seconds = 3;
    for (let i = 0; i < seconds / STEP; i++) sim.step(STEP);
    expect(shots).toBeGreaterThan(0);
    expect(shots).toBeLessThanOrEqual(Math.ceil(seconds * TOWERS.basic.levels[0].fireRate) + 1);
  });

  it('a projectile whose target dies fizzles without dealing damage', () => {
    const { sim, bus } = makeSim();
    sim.placeTower('basic', 1, 3);
    sim.placeTower('basic', 2, 3);
    let hits = 0;
    bus.on('projectileHit', () => hits++);
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave', 120);
    // Every hit lands on a living enemy; overkill shots never register as hits.
    const shotsToKill = Math.ceil(BALANCE.waves.baseCount * 30 / TOWERS.basic.levels[0].damage);
    expect(hits).toBeLessThanOrEqual(shotsToKill);
  });
});

describe('balance smoke test', () => {
  it('an empty board loses, and a modest defence holds the early waves', () => {
    const { sim: empty } = makeSim();
    while (empty.phase !== 'gameover') {
      empty.startWave();
      runUntil(empty, () => empty.phase !== 'wave');
    }
    expect(empty.wave).toBeLessThanOrEqual(3);

    // A naive player: spend all gold on turrets near the path's inner corners, then start the wave.
    const { sim } = makeSim();
    const spots = [[3, 3], [5, 7], [8, 7], [10, 4], [13, 4], [15, 8], [5, 3], [10, 7], [13, 8], [3, 7], [8, 4], [15, 4]];
    let next = 0;
    for (let w = 0; w < 5; w++) {
      while (next < spots.length && sim.placeTower('basic', spots[next][0], spots[next][1])) next++;
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave');
    }
    // Clearing wave 5 opens the first upgrade pick.
    expect(sim.phase).toBe('draft');
    expect(sim.wave).toBe(5);
  });
});
