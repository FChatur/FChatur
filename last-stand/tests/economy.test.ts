import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { MAX_TOWER_LEVEL, TOWERS } from '../src/config/towers';
import { GameSession } from '../src/game/GameSession';
import { makeSim, runUntil } from './helpers';

describe('tower upgrades', () => {
  it('charges the next level cost and applies its stats', () => {
    const { sim, bus } = makeSim({ startingGold: 1000, freeStarterTower: null });
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
    const { sim } = makeSim({ startingGold: TOWERS.basic.cost, freeStarterTower: null });
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

describe('free starter Archer', () => {
  const ARCHER = TOWERS.basic.cost;

  it('the first Archer of a run costs nothing; later ones cost the normal price', () => {
    const { sim } = makeSim({ startingGold: 200 });
    expect(BALANCE.freeStarterTower).toBe('basic');
    expect(sim.buildCost('basic')).toBe(0);
    const first = sim.placeTower('basic', 2, 4)!;
    expect(sim.gold).toBe(200);
    expect(first.free).toBe(true);
    expect(first.invested).toBe(0);
    expect(sim.buildCost('basic')).toBe(ARCHER);
    const second = sim.placeTower('basic', 3, 4)!;
    expect(sim.gold).toBe(200 - ARCHER);
    expect(second.free).toBe(false);
  });

  it('can be built with no gold at all', () => {
    const { sim } = makeSim({ startingGold: 0 });
    expect(sim.canPlaceTower('basic', 2, 4)).toEqual({ ok: true });
    expect(sim.placeTower('basic', 2, 4)).not.toBeNull();
    expect(sim.canPlaceTower('basic', 3, 4)).toEqual({ ok: false, reason: 'insufficient-gold' });
  });

  it('sells for 0 gold, and selling it does not give the free build back', () => {
    const { sim, bus } = makeSim({ startingGold: 200 });
    const refunds: number[] = [];
    bus.on('towerSold', ({ refund }) => refunds.push(refund));
    const free = sim.placeTower('basic', 2, 4)!;
    expect(sim.sellValue(free)).toBe(0);
    expect(sim.sellTower(free)).toBe(true);
    expect(refunds).toEqual([0]);
    expect(sim.gold).toBe(200);
    expect(sim.buildCost('basic')).toBe(ARCHER);
    const again = sim.placeTower('basic', 2, 4)!;
    expect(again.free).toBe(false);
    expect(sim.gold).toBe(200 - ARCHER);
  });

  it('still sells for 0 gold after upgrades, including the gold spent upgrading it', () => {
    const { sim } = makeSim({ startingGold: 1000 });
    const free = sim.placeTower('basic', 2, 4)!;
    while (sim.upgradeTower(free));
    expect(free.level).toBe(MAX_TOWER_LEVEL);
    const spent = TOWERS.basic.levels.slice(1).reduce((n, l) => n + l.upgradeCost, 0);
    expect(free.invested).toBe(spent);
    expect(sim.gold).toBe(1000 - spent);
    expect(sim.sellValue(free)).toBe(0);
    sim.sellTower(free);
    expect(sim.gold).toBe(1000 - spent);
  });

  it('later Archers use the normal resale rules', () => {
    const { sim } = makeSim({ startingGold: 1000 });
    sim.placeTower('basic', 2, 4);
    const paid = sim.placeTower('basic', 3, 4)!;
    sim.upgradeTower(paid);
    const invested = ARCHER + TOWERS.basic.levels[1].upgradeCost;
    expect(paid.invested).toBe(invested);
    expect(sim.sellValue(paid)).toBe(Math.floor(invested * BALANCE.sellRefundRatio));
  });

  it('other towers are never free and do not use up the free Archer', () => {
    const { sim } = makeSim({ startingGold: 1000 });
    for (const [type, col, row] of [['sniper', 3, 3], ['rapid', 5, 5], ['frost', 5, 7]] as const) {
      expect(sim.buildCost(type)).toBe(TOWERS[type].cost);
      expect(sim.placeTower(type, col, row)!.free).toBe(false);
    }
    expect(sim.gold).toBe(1000 - TOWERS.sniper.cost - TOWERS.rapid.cost - TOWERS.frost.cost);
    expect(sim.buildCost('basic')).toBe(0);
  });

  it('is once per run: a new run has its own free Archer', () => {
    const session = new GameSession();
    session.sim.placeTower('basic', 2, 4);
    expect(session.sim.buildCost('basic')).toBe(ARCHER);
    session.restart();
    expect(session.sim.buildCost('basic')).toBe(0);
  });

  it('can be switched off per balance config', () => {
    const { sim } = makeSim({ startingGold: 200, freeStarterTower: null });
    expect(sim.placeTower('basic', 2, 4)!.free).toBe(false);
    expect(sim.gold).toBe(200 - ARCHER);
  });
});
