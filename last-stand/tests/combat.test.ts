import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { GLOBAL_RANGE, TOWERS } from '../src/config/towers';
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

describe('hit events', () => {
  it('report the damage each hit deals its target', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    sim.placeTower('basic', 3, 3);
    let checked = 0;
    bus.on('projectileHit', ({ enemy, damage }) => {
      // The event fires just before the damage lands, so `hp` is still the health before the hit.
      if (enemy.hp > damage) {
        expect(damage).toBe(mitigate(TOWERS.basic.levels[0].damage, enemy.armor, BALANCE.armorMinDamageFraction));
        checked++;
      }
    });
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
    expect(checked).toBeGreaterThan(3);
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
      // Global range: every living enemy that is on the map is a candidate.
      const inRange = sim.enemies.filter((e) => e.alive && e.x >= 0 && e.y >= 0 && e.x <= 960 && e.y <= 576);
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

describe('global range (Sniper)', () => {
  it('is global at every upgrade level', () => {
    for (const level of TOWERS.sniper.levels) expect(level.rangeTiles).toBe(GLOBAL_RANGE);
    const { sim } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 19, 11)!;
    expect(sniper.range).toBe(Number.POSITIVE_INFINITY);
    sim.upgradeTower(sniper);
    sim.upgradeTower(sniper);
    expect(sniper.level).toBe(3);
    expect(sniper.range).toBe(Number.POSITIVE_INFINITY);
  });

  it('hits enemies anywhere on the map, where a ranged tower in the same spot cannot', () => {
    const firstShotAt = (type: 'sniper' | 'basic') => {
      const { sim, bus } = makeSim({ startingGold: 1000 });
      // Far bottom-right corner: the path entrance is at the top-left.
      const tower = sim.placeTower(type, 19, 11)!;
      let target: { x: number; y: number } | null = null;
      bus.on('towerFired', ({ tower: t, projectile }) => {
        if (t === tower && !target) target = { x: projectile.target!.x, y: projectile.target!.y };
      });
      sim.startWave();
      for (let t = 0; t < 5 && !target; t += STEP) sim.step(STEP);
      return target as { x: number; y: number } | null;
    };
    const hit = firstShotAt('sniper');
    expect(hit).not.toBeNull();
    // The target is still near the entrance, far outside any normal range.
    expect(Math.hypot(hit!.x - 19.5 * 48, hit!.y - 11.5 * 48)).toBeGreaterThan(15 * 48);
    expect(firstShotAt('basic')).toBeNull();
  });

  it('picks the toughest enemy on the map regardless of distance', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    sim.startWave();
    for (let t = 0; t < 4; t += STEP) sim.step(STEP);
    const onMap = sim.enemies.filter((e) => e.x >= 0);
    expect(onMap.length).toBeGreaterThanOrEqual(2);
    // Make the enemy furthest from the sniper the toughest.
    const sniperX = 19.5 * 48;
    const sniperY = 11.5 * 48;
    const far = onMap.reduce((a, b) => (Math.hypot(a.x - sniperX, a.y - sniperY) > Math.hypot(b.x - sniperX, b.y - sniperY) ? a : b));
    far.hp = far.maxHp = 10_000;
    const sniper = sim.placeTower('sniper', 19, 11)!;
    let target: unknown = null;
    bus.on('towerFired', ({ tower, projectile }) => tower === sniper && (target ??= projectile.target));
    for (let t = 0; t < 1 && !target; t += STEP) sim.step(STEP);
    expect(target).toBe(far);
  });

  it('never targets enemies that are still off the map', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 19, 11)!;
    // A Turret right at the entrance could reach the spawn point just off the left edge.
    const turret = sim.placeTower('basic', 0, 1)!;
    const offMapTargets: number[] = [];
    const shots = new Map<unknown, number>();
    bus.on('towerFired', ({ tower, projectile }) => {
      shots.set(tower, (shots.get(tower) ?? 0) + 1);
      if ((tower === sniper || tower === turret) && projectile.target!.x < 0) offMapTargets.push(projectile.target!.x);
    });
    sim.startWave();
    for (let t = 0; t < 10; t += STEP) sim.step(STEP);
    expect(shots.get(sniper)).toBeGreaterThan(0);
    expect(shots.get(turret)).toBeGreaterThan(0);
    expect(offMapTargets).toEqual([]);
  });
});
