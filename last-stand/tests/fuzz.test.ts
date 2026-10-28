import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { TARGETING_MODES, TOWER_ORDER } from '../src/config/towers';
import { UPGRADE_DEFS } from '../src/config/upgrades';
import { createRng } from '../src/core/random';
import { GameSession } from '../src/game/GameSession';
import { Persistence } from '../src/game/persistence';
import { makeSim, STEP } from './helpers';
import { checkDraftEligibility, checkInvariants } from './invariants';

const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

/**
 * Random play: thousands of arbitrary (including invalid) actions, checking every invariant after
 * each one. Seeds make any failure reproducible: rerun with the seed from the error message.
 */
describe('fuzz: random actions never reach an invalid state', () => {
  const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const rng = createRng(seed * 7919);
      const startGold = pick(rng, [120, 400, 2000]);
      const { sim, bus } = makeSim({ startingGold: startGold }, { seed, autoWave: rng() < 0.5 });
      const start = sim.health;
      let draftsSeen = 0;
      bus.on('draftOffered', () => {
        draftsSeen++;
        checkDraftEligibility(sim, `seed ${seed}`);
      });
      for (let i = 0; i < 2500 && sim.phase !== 'gameover'; i++) {
        const ctx = `seed ${seed}, action ${i}`;
        const roll = rng();
        if (roll < 0.25) {
          // Any tile, including out of bounds and path tiles.
          sim.placeTower(pick(rng, TOWER_ORDER), Math.floor(rng() * 24) - 2, Math.floor(rng() * 16) - 2);
        } else if (roll < 0.35 && sim.towers.length) {
          sim.upgradeTower(pick(rng, sim.towers));
        } else if (roll < 0.4 && sim.towers.length) {
          const t = pick(rng, sim.towers);
          sim.sellTower(t);
          expect(sim.sellTower(t), ctx).toBe(false);
        } else if (roll < 0.5) {
          const before = sim.wave;
          const ok = sim.startWave();
          expect(sim.wave, ctx).toBe(ok ? before + 1 : before);
        } else if (roll < 0.58) {
          const id = rng() < 0.8 && sim.draftChoices.length ? pick(rng, sim.draftChoices) : pick(rng, UPGRADE_DEFS).id;
          const offered = sim.phase === 'draft' && sim.draftChoices.includes(id);
          expect(sim.chooseUpgrade(id), ctx).toBe(offered);
        } else if (roll < 0.6) {
          sim.setAutoWave(!sim.autoWave);
        } else if (roll < 0.63 && sim.towers.length) {
          const t = pick(rng, sim.towers);
          const mode = pick(rng, TARGETING_MODES);
          const before = t.targeting;
          expect(sim.setTargeting(t, mode), ctx).toBe(before !== mode);
          expect(t.targeting, ctx).toBe(mode);
        } else {
          const frames = 1 + Math.floor(rng() * 240);
          for (let f = 0; f < frames && (sim.phase as string) !== 'gameover'; f++) sim.step(STEP);
        }
        checkInvariants(sim, start, ctx);
      }
      // Sanity: the fuzzer actually exercised the game.
      expect(sim.wave + sim.stats.towersBuilt + draftsSeen).toBeGreaterThan(0);
    });
  }
});

describe('fuzz: session commands in any order', () => {
  it('keeps screens, pause, selection and settings consistent', () => {
    const store = new Map<string, string>();
    const persistence = new Persistence({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    const s = new GameSession(persistence);
    const rng = createRng(4242);
    const actions: (() => void)[] = [
      () => s.play(),
      () => s.toMenu(),
      () => s.restart(),
      () => s.togglePause(),
      () => s.setPaused(rng() < 0.5),
      () => s.cycleSpeed(),
      () => s.toggleMute(),
      () => s.toggleAutoWave(),
      () => s.selectTower(pick(rng, TOWER_ORDER)),
      () => s.clearSelection(),
      () => s.selectBuiltTower(s.sim.towers.length ? pick(rng, s.sim.towers) : null),
      () => s.upgradeSelected(),
      () => s.sellSelected(),
      () => s.setTargetingSelected(pick(rng, TARGETING_MODES)),
      () => s.cycleTargetingSelected(),
      () => s.startWave(),
      () => s.sim.placeTower(pick(rng, TOWER_ORDER), Math.floor(rng() * 20), Math.floor(rng() * 12)),
      () => {
        for (let f = 0; f < 120; f++) if (s.running) s.sim.step(STEP);
      },
      () => s.sim.draftChoices.length && s.chooseUpgrade(s.sim.draftChoices[0]),
    ];
    for (let i = 0; i < 4000; i++) {
      pick(rng, actions)();
      const ctx = `session action ${i}`;
      // Paused only while playing a live run; never in the menu.
      if (s.paused) expect(s.screen === 'playing' && s.sim.phase !== 'gameover', ctx).toBe(true);
      expect(s.running, ctx).toBe(s.screen === 'playing' && !s.paused && s.sim.phase !== 'gameover');
      // Build selection and built-tower selection are exclusive, and a selected tower exists.
      expect(!(s.selectedTower && s.selectedTowerInstance), ctx).toBe(true);
      if (s.selectedTowerInstance) expect(s.sim.towers, ctx).toContain(s.selectedTowerInstance);
      // The run always follows the saved Auto Wave preference.
      expect(s.sim.autoWave, ctx).toBe(s.autoWave);
      checkInvariants(s.sim, BALANCE.startingHealth, ctx);
    }
  });
});
