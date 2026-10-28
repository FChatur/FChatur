import { describe, expect, it } from 'vitest';
import { TARGETING, TARGETING_MODES, TOWER_ORDER, TOWERS, type TargetingMode } from '../src/config/towers';
import { isBetterTarget } from '../src/core/Simulation';
import type { Enemy } from '../src/core/types';
import { GameSession } from '../src/game/GameSession';
import { Persistence } from '../src/game/persistence';
import { makeSim, runUntil, STEP } from './helpers';

/** A minimal enemy for ranking tests; only the fields targeting reads matter. */
function enemy(id: number, distance: number, hp: number, speed: number, slowFactor = 1): Enemy {
  return {
    id, type: 'basic', hp, maxHp: hp, speed, armor: 0, incomingDamage: 0, slowFactor, slowTimer: slowFactor < 1 ? 1 : 0,
    reward: 1, leakDamage: 1, radius: 10, distance, x: 0, y: 0, prevX: 0, prevY: 0, alive: true,
  };
}

/** The target each mode picks from a list, by repeated comparison (as the simulation does). */
function pickTarget(mode: TargetingMode, list: Enemy[]): Enemy {
  return list.reduce((best, e) => (isBetterTarget(mode, e, best) ? e : best));
}

describe('targeting modes', () => {
  const lead = enemy(1, 500, 40, 72);
  const tank = enemy(2, 300, 200, 48);
  const wolf = enemy(3, 200, 20, 125);
  const rear = enemy(4, 50, 40, 72);
  const all = [lead, tank, wolf, rear];

  it('First picks the enemy closest to the exit', () => {
    expect(pickTarget('first', all)).toBe(lead);
  });

  it('Last picks the enemy furthest from the exit', () => {
    expect(pickTarget('last', all)).toBe(rear);
  });

  it('Strongest picks the most health left, ties go to the one further along', () => {
    expect(pickTarget('strongest', all)).toBe(tank);
    const twin = enemy(5, 400, 200, 48);
    expect(pickTarget('strongest', [tank, twin])).toBe(twin);
  });

  it('Fastest picks the highest current speed, counting slows', () => {
    expect(pickTarget('fastest', all)).toBe(wolf);
    // A wolf slowed to 40% of its speed is slower than an unslowed grunt.
    const slowedWolf = enemy(6, 200, 20, 125, 0.4);
    expect(pickTarget('fastest', [lead, slowedWolf])).toBe(lead);
  });

  it('every mode has a label and an explanation, and every tower starts with a valid mode', () => {
    for (const mode of TARGETING_MODES) {
      expect(TARGETING[mode].label.length).toBeGreaterThan(0);
      expect(TARGETING[mode].description.length).toBeGreaterThan(10);
    }
    for (const t of TOWER_ORDER) expect(TARGETING_MODES).toContain(TOWERS[t].targeting);
  });
});

describe('changing targeting on a built tower', () => {
  it('defaults come from the tower type and can be changed during a wave', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 19, 11)!;
    const turret = sim.placeTower('basic', 3, 3)!;
    expect(sniper.targeting).toBe('strongest');
    expect(turret.targeting).toBe('first');

    const changes: number[] = [];
    bus.on('towerTargetingChanged', ({ tower }) => changes.push(tower.id));
    sim.startWave();
    for (let t = 0; t < 2; t += STEP) sim.step(STEP);
    expect(sim.setTargeting(sniper, 'last')).toBe(true);
    expect(sniper.targeting).toBe('last');
    // Setting the current mode again is a no-op.
    expect(sim.setTargeting(sniper, 'last')).toBe(false);
    expect(changes).toEqual([sniper.id]);
  });

  it('a global-range tower on Last shoots the newest enemy anywhere on the map', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 19, 11)!;
    sim.setTargeting(sniper, 'last');
    let checked = 0;
    bus.on('towerFired', ({ tower, projectile }) => {
      if (tower !== sniper) return;
      const onMap = sim.enemies.filter((e) => e.alive && e.x >= 0 && e.x <= 960 && e.y >= 0 && e.y <= 576);
      const uncovered = onMap.filter((e) => e !== projectile.target && e.incomingDamage < e.hp);
      // Nothing uncovered was further back than the target.
      for (const e of uncovered) expect(e.distance).toBeGreaterThanOrEqual(projectile.target!.distance);
      expect(sniper.range).toBe(Number.POSITIVE_INFINITY);
      checked++;
    });
    for (let w = 0; w < 3; w++) {
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave');
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('a tower on Fastest prefers Runners over Grunts', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const sniper = sim.placeTower('sniper', 19, 11)!;
    sim.setTargeting(sniper, 'fastest');
    let runnerShots = 0;
    let shots = 0;
    bus.on('towerFired', ({ tower, projectile }) => {
      if (tower !== sniper) return;
      shots++;
      // The shot has already been counted against its target, so the target itself counts as uncovered.
      const runnerAvailable = sim.enemies.some(
        (e) =>
          e.alive && e.type === 'runner' && e.x >= 0 && e.x <= 960 && (e === projectile.target || e.incomingDamage < e.hp),
      );
      if (runnerAvailable && projectile.target!.type === 'runner') runnerShots++;
      if (runnerAvailable) expect(projectile.target!.type).toBe('runner');
    });
    // Runners join from wave 3.
    for (let w = 0; w < 4; w++) {
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave');
    }
    expect(shots).toBeGreaterThan(5);
    expect(runnerShots).toBeGreaterThan(0);
  });

  it('cannot change after the run is over, or on a tower that was sold', () => {
    const { sim } = makeSim({ startingGold: 1000 });
    const turret = sim.placeTower('basic', 3, 3)!;
    sim.sellTower(turret);
    expect(sim.setTargeting(turret, 'last')).toBe(false);
    const other = sim.placeTower('basic', 5, 5)!;
    sim.health = 0;
    sim.startWave();
    sim.step(STEP);
    expect(sim.phase).toBe('gameover');
    expect(sim.setTargeting(other, 'last')).toBe(false);
  });

  it('the session changes the selected tower and cycles through every mode', () => {
    const s = new GameSession(new Persistence(null));
    s.play();
    const t = s.sim.placeTower('basic', 3, 3)!;
    expect(s.setTargetingSelected('last')).toBe(false);
    s.selectBuiltTower(t);
    expect(s.setTargetingSelected('strongest')).toBe(true);
    const seen: TargetingMode[] = [];
    for (let i = 0; i < TARGETING_MODES.length; i++) {
      s.cycleTargetingSelected();
      seen.push(t.targeting);
    }
    expect([...seen].sort()).toEqual([...TARGETING_MODES].sort());
    expect(t.targeting).toBe('strongest');
  });
});

describe('damage hook (balance tools)', () => {
  it('reports exactly the health removed, with overkill separate', () => {
    let dealt = 0;
    let overkill = 0;
    const { sim, bus } = makeSim(
      { startingGold: 1000 },
      { onDamage: (_type, d, o) => ((dealt += d), (overkill += o)) },
    );
    const spawned: Enemy[] = [];
    bus.on('enemySpawned', ({ enemy: e }) => spawned.push(e));
    sim.placeTower('sniper', 5, 5);
    sim.placeTower('basic', 3, 3);
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
    const removed = spawned.reduce((sum, e) => sum + (e.maxHp - Math.max(0, e.hp)), 0);
    expect(dealt).toBeCloseTo(removed, 6);
    expect(overkill).toBeGreaterThan(0);
  });
});
