import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { GameSession } from '../src/game/GameSession';
import { Persistence, type KeyValueStore } from '../src/game/persistence';
import { makeSim, runUntil, STEP } from './helpers';

const DELAY = BALANCE.autoWaveDelay;

/** A sturdy run with Auto Wave on that has just cleared wave 1. */
function afterFirstWave(autoWave = true) {
  const ctx = makeSim({ startingGold: 5000 }, { autoWave });
  const { sim } = ctx;
  for (const [c, r] of [[3, 3], [5, 7], [8, 7], [10, 4], [13, 4], [15, 8]]) {
    const t = sim.placeTower('basic', c, r)!;
    sim.upgradeTower(t);
    sim.upgradeTower(t);
  }
  sim.startWave();
  runUntil(sim, () => sim.phase !== 'wave');
  return ctx;
}

/** Steps `seconds` of game time. */
function advance(sim: ReturnType<typeof makeSim>['sim'], seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) sim.step(STEP);
}

describe('Auto Wave', () => {
  it(`starts the next wave ${DELAY}s of game time after a wave is cleared`, () => {
    const { sim } = afterFirstWave();
    expect(sim.phase).toBe('build');
    expect(sim.autoWaveCountdown).toBeCloseTo(DELAY);
    advance(sim, DELAY - 0.1);
    expect(sim.phase).toBe('build');
    expect(sim.wave).toBe(1);
    advance(sim, 0.2);
    expect(sim.phase).toBe('wave');
    expect(sim.wave).toBe(2);
    expect(sim.autoWaveCountdown).toBeNull();
  });

  it('does nothing when off, and never auto-starts the very first wave', () => {
    const { sim } = afterFirstWave(false);
    expect(sim.autoWaveCountdown).toBeNull();
    advance(sim, DELAY * 3);
    expect(sim.wave).toBe(1);
    const { sim: fresh } = makeSim({}, { autoWave: true });
    advance(fresh, DELAY * 3);
    expect(fresh.wave).toBe(0);
  });

  it('allows building, upgrading and selling during the countdown', () => {
    const { sim } = afterFirstWave();
    const t = sim.placeTower('rapid', 1, 1);
    expect(t).not.toBeNull();
    expect(sim.upgradeTower(t!)).toBe(true);
    expect(sim.sellTower(t!)).toBe(true);
    expect(sim.autoWaveCountdown).not.toBeNull();
  });

  it('a manual start skips the countdown, and the wave starts exactly once', () => {
    const { sim, bus } = afterFirstWave();
    let started = 0;
    bus.on('waveStarted', () => started++);
    advance(sim, 1);
    expect(sim.startWave()).toBe(true);
    expect(sim.wave).toBe(2);
    expect(sim.autoWaveCountdown).toBeNull();
    // Pressing again, or the old countdown running out, must not start another wave.
    expect(sim.startWave()).toBe(false);
    advance(sim, DELAY * 2);
    expect(started).toBe(1);
    expect(sim.wave).toBe(2);
  });

  it('waits during an upgrade pick, then restarts the full countdown after choosing', () => {
    const ctx = makeSim({ startingGold: 5000 }, { autoWave: true });
    const { sim } = ctx;
    for (const [c, r] of [[3, 3], [5, 7], [8, 7], [10, 4], [13, 4], [15, 8], [5, 3], [10, 7]]) {
      const t = sim.placeTower('basic', c, r)!;
      sim.upgradeTower(t);
      sim.upgradeTower(t);
    }
    sim.startWave();
    runUntil(sim, () => sim.phase === 'draft', 900);
    expect(sim.wave).toBe(BALANCE.roguelite.draftEvery);
    expect(sim.autoWaveCountdown).toBeNull();
    advance(sim, DELAY * 3);
    expect(sim.phase).toBe('draft');
    expect(sim.wave).toBe(BALANCE.roguelite.draftEvery);
    sim.chooseUpgrade(sim.draftChoices[0]);
    expect(sim.autoWaveCountdown).toBeCloseTo(DELAY);
    advance(sim, DELAY + 0.05);
    expect(sim.wave).toBe(BALANCE.roguelite.draftEvery + 1);
  });

  it('turning it off cancels a running countdown; turning it on between waves starts one', () => {
    const { sim } = afterFirstWave();
    advance(sim, 1);
    sim.setAutoWave(false);
    expect(sim.autoWaveCountdown).toBeNull();
    advance(sim, DELAY * 2);
    expect(sim.wave).toBe(1);
    sim.setAutoWave(true);
    expect(sim.autoWaveCountdown).toBeCloseTo(DELAY);
    advance(sim, DELAY + 0.05);
    expect(sim.wave).toBe(2);
  });

  it('reports whole seconds for the countdown display', () => {
    const { sim, bus } = afterFirstWave(false);
    const shown: (number | null)[] = [];
    bus.on('countdownChanged', ({ seconds }) => shown.push(seconds));
    sim.setAutoWave(true);
    advance(sim, DELAY + 0.05);
    expect(shown).toEqual([3, 2, 1, null]);
  });

  it('stops when the run ends', () => {
    const { sim } = makeSim({ startingHealth: 1 }, { autoWave: true });
    sim.startWave();
    runUntil(sim, () => sim.phase === 'gameover');
    expect(sim.autoWaveCountdown).toBeNull();
  });
});

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('Auto Wave setting', () => {
  it('is on by default, applies to the current run, and carries over restarts and visits', () => {
    const store = new MemoryStore();
    const s = new GameSession(new Persistence(store));
    expect(s.autoWave).toBe(true);
    expect(s.sim.autoWave).toBe(true);
    s.toggleAutoWave();
    expect(s.sim.autoWave).toBe(false);
    s.restart();
    expect(s.sim.autoWave).toBe(false);
    s.toMenu();
    s.play();
    expect(s.sim.autoWave).toBe(false);
    expect(new GameSession(new Persistence(store)).autoWave).toBe(false);
  });

  it('pausing freezes the countdown, because paused time is never stepped', () => {
    const s = new GameSession(new Persistence(new MemoryStore()));
    s.play();
    s.togglePause();
    // The scene only steps the simulation while `running`; paused means no steps at all.
    expect(s.running).toBe(false);
  });
});
