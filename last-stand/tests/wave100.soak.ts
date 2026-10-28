import { describe, expect, it } from 'vitest';
import { TOWER_ORDER } from '../src/config/towers';
import { UPGRADE_DEFS } from '../src/config/upgrades';
import { makeSim, STEP } from './helpers';
import { checkInvariants } from './invariants';

/**
 * Late-game stress: a full board of max-level towers with every upgrade at max, played to wave 100.
 * Catches numeric blow-ups (health scaling, overflow, NaN) and simulation performance regressions.
 */
describe('soak: wave 100 with a maxed-out board', () => {
  it('stays valid and fast', { timeout: 120_000 }, () => {
    const startHealth = 1_000_000;
    const { sim } = makeSim({ startingGold: 10_000_000, startingHealth: startHealth }, { seed: 7 });
    let i = 0;
    for (let c = 0; c < 20; c++) {
      for (let r = 0; r < 12; r++) {
        const t = sim.placeTower(TOWER_ORDER[i++ % TOWER_ORDER.length], c, r);
        if (t) {
          sim.upgradeTower(t);
          sim.upgradeTower(t);
        }
      }
    }
    for (const d of UPGRADE_DEFS) sim.grantUpgrade(d.id, d.maxStacks);

    let steps = 0;
    let simMs = 0;
    while (sim.wave < 100 && sim.phase !== 'gameover') {
      if (sim.phase === 'draft') sim.chooseUpgrade(sim.draftChoices[0]);
      expect(sim.startWave()).toBe(true);
      let guard = 0;
      while (sim.phase === 'wave' && guard++ < 60 * 600) {
        const t0 = performance.now();
        sim.step(STEP);
        simMs += performance.now() - t0;
        steps++;
      }
      expect(sim.phase, `wave ${sim.wave} never ended`).not.toBe('wave');
      checkInvariants(sim, startHealth, `soak wave ${sim.wave}`);
      for (const e of sim.enemies) expect(Number.isFinite(e.maxHp)).toBe(true);
    }
    expect(sim.wave).toBe(100);
    // ~0.1 ms per step locally; the budget is very generous so slow CI machines don't flake.
    expect(simMs / steps).toBeLessThan(2);
  });
});
