import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';

describe('GameSession', () => {
  it('cycles game speed 1x → 2x → 3x → 1x and keeps it across restarts', () => {
    const session = new GameSession();
    const seen: number[] = [];
    session.bus.on('speedChanged', ({ speed }) => seen.push(speed));
    expect(session.speed).toBe(1);
    session.cycleSpeed();
    session.cycleSpeed();
    expect(session.speed).toBe(3);
    session.restart();
    expect(session.speed).toBe(3);
    session.cycleSpeed();
    expect(session.speed).toBe(1);
    expect(seen).toEqual([2, 3, 1]);
  });

  it('build selection and built-tower selection are mutually exclusive', () => {
    const session = new GameSession();
    const tower = session.sim.placeTower('basic', 2, 4)!;
    session.selectTower('sniper');
    session.selectBuiltTower(tower);
    expect(session.selectedTower).toBeNull();
    expect(session.selectedTowerInstance).toBe(tower);
    session.selectTower('rapid');
    expect(session.selectedTowerInstance).toBeNull();
    expect(session.selectedTower).toBe('rapid');
  });

  it('upgrades and sells the selected tower, clearing the selection when sold', () => {
    const session = new GameSession();
    const tower = session.sim.placeTower('basic', 2, 4)!;
    session.selectBuiltTower(tower);
    expect(session.upgradeSelected()).toBe(true);
    expect(tower.level).toBe(2);
    expect(session.sellSelected()).toBe(true);
    expect(session.selectedTowerInstance).toBeNull();
    expect(session.sellSelected()).toBe(false);
  });
});
