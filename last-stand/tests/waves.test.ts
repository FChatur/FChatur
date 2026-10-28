import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { planWave, waveClearBonus } from '../src/core/waves';

const cfg = BALANCE.waves;

describe('wave planning', () => {
  it('starts at the base count and grows', () => {
    expect(planWave(1, cfg).spawns).toHaveLength(cfg.baseCount);
    expect(planWave(5, cfg).spawns.length).toBeGreaterThan(planWave(1, cfg).spawns.length);
  });

  it('spawns the first enemy immediately and never goes below the minimum interval', () => {
    const plan = planWave(100, cfg);
    expect(plan.spawns[0].delay).toBe(0);
    for (const s of plan.spawns.slice(1)) expect(s.delay).toBeGreaterThanOrEqual(cfg.spawnIntervalMin);
  });

  it('scales health from 1x at wave 1', () => {
    expect(planWave(1, cfg).hpMultiplier).toBe(1);
    expect(planWave(10, cfg).hpMultiplier).toBeGreaterThan(planWave(9, cfg).hpMultiplier);
  });

  it('pays a growing clear bonus', () => {
    expect(waveClearBonus(1, cfg)).toBe(cfg.clearBonusBase);
    expect(waveClearBonus(2, cfg)).toBe(cfg.clearBonusBase + cfg.clearBonusPerWave);
  });
});
