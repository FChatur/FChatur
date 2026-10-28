import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { TOWERS } from '../src/config/towers';
import { mitigate } from '../src/core/Simulation';
import { makeSim, runUntil, STEP } from './helpers';

describe('armor', () => {
  it('subtracts flat armor but never below the minimum fraction', () => {
    const min = BALANCE.armorMinDamageFraction;
    expect(mitigate(10, 0, min)).toBe(10);
    expect(mitigate(10, 4, min)).toBe(6);
    expect(mitigate(4, 4, min)).toBe(4 * min);
    expect(mitigate(45, 6, min)).toBe(39);
  });
});

describe('frost', () => {
  it('slows enemies it hits, and the slow wears off', () => {
    const { sim } = makeSim();
    const frost = sim.placeTower('frost', 1, 3)!;
    sim.startWave();
    runUntil(sim, () => sim.enemies.some((e) => e.slowFactor < 1), 30);
    const slowed = sim.enemies.find((e) => e.slowFactor < 1)!;
    expect(slowed.slowFactor).toBe(TOWERS.frost.levels[0].slow!.factor);

    sim.sellTower(frost);
    const duration = TOWERS.frost.levels[0].slow!.duration;
    for (let t = 0; t < duration + 0.1; t += STEP) sim.step(STEP);
    if (slowed.alive) expect(slowed.slowFactor).toBe(1);
  });

  it('slowed enemies move proportionally slower', () => {
    const { sim } = makeSim();
    sim.startWave();
    sim.step(STEP);
    const e = sim.enemies[0];
    e.slowFactor = 0.5;
    e.slowTimer = 10;
    const before = e.distance;
    sim.step(STEP);
    expect(e.distance - before).toBeCloseTo(e.speed * 0.5 * STEP);
  });
});

describe('sniper targeting', () => {
  it('always shoots the toughest enemy in range', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 5, 5)!;
    let checked = 0;
    bus.on('towerFired', ({ tower, projectile }) => {
      if (tower !== sniper) return;
      const inRange = sim.enemies.filter(
        (e) => e.alive && Math.hypot(e.x - tower.x, e.y - tower.y) <= tower.range,
      );
      const maxHp = Math.max(...inRange.map((e) => e.hp));
      expect(projectile.target!.hp).toBe(maxHp);
      checked++;
    });
    // Wave 3 mixes Grunts and lower-health Runners.
    for (let w = 0; w < 3; w++) {
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave');
    }
    expect(checked).toBeGreaterThan(3);
  });
});
