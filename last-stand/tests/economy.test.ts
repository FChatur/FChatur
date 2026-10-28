import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { MAX_TOWER_LEVEL, TOWERS } from '../src/config/towers';
import { makeSim, runUntil } from './helpers';

describe('tower upgrades', () => {
  it('charges the next level cost and applies its stats', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const tower = sim.placeTower('basic', 2, 4)!;
    const events: number[] = [];
    bus.on('towerUpgraded', ({ cost }) => events.push(cost));
    const gold = sim.gold;
    expect(sim.upgradeTower(tower)).toBe(true);
    const lv2 = TOWERS.basic.levels[1];
    expect(tower.level).toBe(2);
    expect(tower.damage).toBe(lv2.damage);
    expect(tower.fireInterval).toBeCloseTo(1 / lv2.fireRate);
    expect(sim.gold).toBe(gold - lv2.upgradeCost);
    expect(tower.invested).toBe(TOWERS.basic.cost + lv2.upgradeCost);
    expect(events).toEqual([lv2.upgradeCost]);
  });

  it(`stops at level ${MAX_TOWER_LEVEL}`, () => {
    const { sim } = makeSim({ startingGold: 1000 });
    const tower = sim.placeTower('sniper', 2, 4)!;
    expect(sim.upgradeTower(tower)).toBe(true);
    expect(sim.upgradeTower(tower)).toBe(true);
    expect(tower.level).toBe(MAX_TOWER_LEVEL);
    const gold = sim.gold;
    expect(sim.canUpgradeTower(tower)).toEqual({ ok: false, reason: 'max-level' });
    expect(sim.upgradeTower(tower)).toBe(false);
    expect(sim.gold).toBe(gold);
  });

  it('refuses when gold is short', () => {
    const { sim } = makeSim({ startingGold: TOWERS.basic.cost });
    const tower = sim.placeTower('basic', 2, 4)!;
    expect(sim.canUpgradeTower(tower)).toEqual({ ok: false, reason: 'insufficient-gold' });
    expect(sim.upgradeTower(tower)).toBe(false);
    expect(tower.level).toBe(1);
  });
});

describe('selling towers', () => {
  it('refunds part of everything invested and frees the tile', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    const tower = sim.placeTower('frost', 2, 4)!;
    sim.upgradeTower(tower);
    const invested = TOWERS.frost.cost + TOWERS.frost.levels[1].upgradeCost;
    const refund = Math.floor(invested * BALANCE.sellRefundRatio);
    let emitted = 0;
    bus.on('towerSold', (e) => (emitted = e.refund));
    const gold = sim.gold;

    expect(sim.sellValue(tower)).toBe(refund);
    expect(sim.sellTower(tower)).toBe(true);
    expect(sim.gold).toBe(gold + refund);
    expect(emitted).toBe(refund);
    expect(sim.towers).not.toContain(tower);
    expect(sim.towerAt(2, 4)).toBeUndefined();
    expect(sim.stats.towersSold).toBe(1);
    expect(sim.canPlaceTower('basic', 2, 4).ok).toBe(true);
    // Selling twice does nothing.
    expect(sim.sellTower(tower)).toBe(false);
  });

  it('works during a wave', () => {
    const { sim } = makeSim();
    const tower = sim.placeTower('basic', 2, 4)!;
    sim.startWave();
    sim.step(1 / 60);
    expect(sim.phase).toBe('wave');
    expect(sim.sellTower(tower)).toBe(true);
  });

  it('is refused once the run is over', () => {
    const { sim } = makeSim({ startingHealth: 1 });
    // Far from the path, so it can't stop the leak that ends the run.
    const tower = sim.placeTower('basic', 19, 0)!;
    sim.startWave();
    runUntil(sim, () => sim.phase === 'gameover');
    expect(sim.sellTower(tower)).toBe(false);
    expect(sim.towers).toContain(tower);
  });
});
