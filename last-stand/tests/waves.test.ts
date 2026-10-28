import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { isBossWave, planWave, waveClearBonus } from '../src/core/waves';

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

describe('wave composition', () => {
  const types = (wave: number) => planWave(wave, cfg).spawns.map((s) => s.enemy);

  it('introduces Runners and Brutes at their configured waves', () => {
    expect(types(cfg.runners.fromWave - 1)).not.toContain('runner');
    expect(types(cfg.runners.fromWave)).toContain('runner');
    expect(types(cfg.armored.fromWave - 1)).not.toContain('armored');
    expect(types(cfg.armored.fromWave)).toContain('armored');
  });

  it('adds exactly one boss, last, on boss waves only', () => {
    for (let w = 1; w <= 30; w++) {
      const list = types(w);
      const bosses = list.filter((t) => t === 'boss').length;
      expect(bosses).toBe(isBossWave(w, cfg) ? 1 : 0);
      if (bosses) {
        expect(list[list.length - 1]).toBe('boss');
        expect(planWave(w, cfg).spawns.at(-1)!.delay).toBe(cfg.bossDelay);
      }
    }
    expect(isBossWave(10, cfg)).toBe(true);
  });

  it('keeps the regular enemy count and mixes types roughly by share', () => {
    const wave = 20;
    const list = types(wave).filter((t) => t !== 'boss');
    expect(list).toHaveLength(Math.min(cfg.maxCount, cfg.baseCount + Math.floor((wave - 1) * cfg.countPerWave)));
    const runners = list.filter((t) => t === 'runner').length;
    const expected = Math.min(cfg.runners.maxShare, cfg.runners.startShare + cfg.runners.sharePerWave * (wave - cfg.runners.fromWave));
    expect(Math.abs(runners - expected * list.length)).toBeLessThanOrEqual(1);
  });

  it('caps regular enemies per wave, scales by the map count modifier, and still adds the boss', () => {
    for (const w of [30, 60, 100]) {
      const regular = planWave(w, cfg).spawns.filter((s) => s.enemy !== 'boss');
      expect(regular.length).toBeLessThanOrEqual(cfg.maxCount);
    }
    expect(planWave(60, cfg, 1.5).spawns.filter((s) => s.enemy !== 'boss')).toHaveLength(Math.round(cfg.maxCount * 1.5));
    expect(planWave(60, cfg, 1.5).spawns.at(-1)!.enemy).toBe('boss');
  });

  it('grows health with both the compounding and linear terms', () => {
    const n = 9;
    expect(planWave(n + 1, cfg).hpMultiplier).toBeCloseTo((1 + cfg.hpLinearPerWave * n) * cfg.hpGrowthPerWave ** n);
  });

  it('is deterministic', () => {
    expect(planWave(17, cfg)).toEqual(planWave(17, cfg));
  });
});
