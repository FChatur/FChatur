import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { GameSession } from '../src/game/GameSession';
import { DEFAULT_SETTINGS, Persistence, type KeyValueStore } from '../src/game/persistence';
import { TUTORIAL_STEPS, TutorialProgress } from '../src/ui/tutorial';
import { runUntil } from './helpers';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('persistence', () => {
  it('returns defaults when nothing is stored, and round-trips settings', () => {
    const p = new Persistence(new MemoryStore());
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
    p.saveSettings({ muted: true, volume: 0.3, speed: 3, tutorialDone: true, autoWave: false, shopCollapsed: true });
    expect(p.loadSettings()).toEqual({ muted: true, volume: 0.3, speed: 3, tutorialDone: true, autoWave: false, shopCollapsed: true });
  });

  it('settings saved before the shop could collapse load with the shop expanded', () => {
    const store = new MemoryStore();
    store.setItem('lastStand.v1.settings', JSON.stringify({ muted: true, volume: 0.3, speed: 2, tutorialDone: true, autoWave: true }));
    expect(new Persistence(store).loadSettings().shopCollapsed).toBe(false);
  });

  it('ignores corrupt or invalid data', () => {
    const store = new MemoryStore();
    store.setItem('lastStand.v1.settings', '{not json');
    store.setItem('lastStand.v1.records', 'null');
    const p = new Persistence(store);
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(p.loadRecords()).toEqual({});
    store.setItem('lastStand.v1.settings', JSON.stringify({ muted: 'yes', volume: 7, speed: 5 }));
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps working when storage throws or is unavailable', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    for (const p of [new Persistence(broken), new Persistence(null)]) {
      expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => p.saveSettings(DEFAULT_SETTINGS)).not.toThrow();
      expect(p.recordRun('switchback', 12, 50).newBest).toBe(true);
    }
  });

  it('tracks best wave per map and flags new bests', () => {
    const p = new Persistence(new MemoryStore());
    expect(p.recordRun('switchback', 10, 40)).toEqual({ record: { bestWave: 10, bestKills: 40, runs: 1 }, newBest: true });
    expect(p.recordRun('switchback', 8, 60)).toEqual({ record: { bestWave: 10, bestKills: 60, runs: 2 }, newBest: false });
    expect(p.recordRun('switchback', 11, 10).newBest).toBe(true);
    expect(p.loadRecords().switchback?.bestWave).toBe(11);
  });
});

describe('session screens, pause and settings', () => {
  const session = () => new GameSession(new Persistence(new MemoryStore()));

  it('starts in the menu, and only advances time while playing and unpaused', () => {
    const s = session();
    expect(s.screen).toBe('menu');
    expect(s.running).toBe(false);
    s.setPaused(true);
    expect(s.paused).toBe(false); // can't pause the menu
    s.play();
    expect(s.screen).toBe('playing');
    expect(s.running).toBe(true);
    s.togglePause();
    expect(s.running).toBe(false);
    s.togglePause();
    expect(s.running).toBe(true);
  });

  it('play and main menu always start a fresh, unpaused run', () => {
    const s = session();
    s.play();
    s.sim.placeTower('basic', 2, 4);
    s.setPaused(true);
    s.toMenu();
    expect(s.screen).toBe('menu');
    expect(s.paused).toBe(false);
    expect(s.sim.towers).toHaveLength(0);
    s.play();
    expect(s.sim.towers).toHaveLength(0);
  });

  it('remembers mute and speed across sessions', () => {
    const store = new MemoryStore();
    const a = new GameSession(new Persistence(store));
    a.toggleMute();
    a.setSpeed(2);
    const b = new GameSession(new Persistence(store));
    expect(b.muted).toBe(true);
    expect(b.speed).toBe(2);
  });

  it('records the run and reports a new personal best at game over', () => {
    const s = session();
    s.play();
    s.sim.health = 1;
    s.startWave();
    runUntil(s.sim, () => s.sim.phase === 'gameover');
    expect(s.lastRun?.newBest).toBe(true);
    expect(s.record?.bestWave).toBe(1);
    expect(s.running).toBe(false);
    s.setPaused(true);
    expect(s.paused).toBe(false); // no pausing a finished run
  });
});

describe('tutorial', () => {
  it('advances one step per matching event and finishes once', () => {
    const bus = new EventBus<GameEvents>();
    let finished = 0;
    const t = new TutorialProgress(bus, TUTORIAL_STEPS, () => {}, () => finished++);
    expect(t.position).toEqual({ step: 1, total: TUTORIAL_STEPS.length });
    // Out-of-order events don't skip ahead.
    bus.emit('waveStarted', { wave: 1, enemyCount: 8 });
    expect(t.position.step).toBe(1);
    bus.emit('towerPlaced', { tower: {} as never });
    bus.emit('waveStarted', { wave: 1, enemyCount: 8 });
    expect(t.position.step).toBe(3);
    // Selecting nothing doesn't count; selecting a tower does.
    bus.emit('selectionChanged', { towerType: 'basic', towerId: null });
    expect(t.position.step).toBe(3);
    bus.emit('selectionChanged', { towerType: null, towerId: 7 });
    bus.emit('waveCleared', { wave: 1, bonus: 20, interest: 0 });
    bus.emit('upgradeChosen', { id: 'overclock', rank: 1 });
    expect(t.finished).toBe(true);
    expect(finished).toBe(1);
    bus.emit('towerPlaced', { tower: {} as never });
    expect(finished).toBe(1);
  });

  it('can be skipped, and disposing does not mark it done', () => {
    const bus = new EventBus<GameEvents>();
    let finished = 0;
    const a = new TutorialProgress(bus, TUTORIAL_STEPS, () => {}, () => finished++);
    a.dispose();
    expect(finished).toBe(0);
    const b = new TutorialProgress(bus, TUTORIAL_STEPS, () => {}, () => finished++);
    b.skip();
    expect(b.finished).toBe(true);
    expect(finished).toBe(1);
  });
});
