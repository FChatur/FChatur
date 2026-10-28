import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { TOWERS } from '../src/config/towers';
import { MAX_UPGRADE_RANK, UPGRADE_VALUES as V } from '../src/config/upgrades';
import {
  chainBounces,
  critChance,
  emptyRanks,
  fireRateMultiplier,
  frostbiteMultiplier,
  interestPayout,
  rollDraft,
  splashFraction,
} from '../src/core/modifiers';
import { createRng } from '../src/core/random';
import { makeSim, runUntil, STEP } from './helpers';

const draftEvery = BALANCE.roguelite.draftEvery;

/** Clears waves with a sturdy defence until the first draft opens. */
function reachDraft(seed = 1) {
  const ctx = makeSim({ startingGold: 5000 }, { seed });
  const { sim } = ctx;
  for (const [c, r] of [[3, 3], [5, 7], [8, 7], [10, 4], [13, 4], [15, 8], [5, 3], [10, 7]]) {
    const t = sim.placeTower('basic', c, r)!;
    sim.upgradeTower(t);
    sim.upgradeTower(t);
  }
  while (sim.phase !== 'draft' && sim.phase !== 'gameover') {
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
  }
  return ctx;
}

describe('upgrade draft', () => {
  it(`offers ${BALANCE.roguelite.draftChoices} distinct choices after every ${draftEvery}th wave`, () => {
    const { sim } = reachDraft();
    expect(sim.phase).toBe('draft');
    expect(sim.wave).toBe(draftEvery);
    expect(new Set(sim.draftChoices).size).toBe(BALANCE.roguelite.draftChoices);
  });

  it('blocks the next wave until a choice is made, and only accepts offered upgrades', () => {
    const { sim, bus } = reachDraft();
    const chosen: string[] = [];
    bus.on('upgradeChosen', ({ id, rank }) => chosen.push(`${id}:${rank}`));
    expect(sim.startWave()).toBe(false);
    const notOffered = (['overclock', 'frostbite', 'chainLightning', 'criticalStrike'] as const).find(
      (id) => !sim.draftChoices.includes(id),
    )!;
    expect(sim.chooseUpgrade(notOffered)).toBe(false);
    const pick = sim.draftChoices[0];
    expect(sim.chooseUpgrade(pick)).toBe(true);
    expect(sim.upgrades[pick]).toBe(1);
    expect(sim.phase).toBe('build');
    expect(sim.chooseUpgrade(pick)).toBe(false);
    expect(chosen).toEqual([`${pick}:1`]);
    expect(sim.startWave()).toBe(true);
  });

  it('is reproducible from the seed', () => {
    expect(reachDraft(42).sim.draftChoices).toEqual(reachDraft(42).sim.draftChoices);
  });

  it('never offers maxed upgrades, and offers fewer when few remain', () => {
    const ranks = emptyRanks();
    for (const id of Object.keys(ranks) as (keyof typeof ranks)[]) ranks[id] = MAX_UPGRADE_RANK;
    ranks.overclock = 1;
    ranks.frostbite = 2;
    const rng = createRng(7);
    for (let i = 0; i < 20; i++) {
      const offer = rollDraft(ranks, rng, 3);
      expect(offer.sort()).toEqual(['frostbite', 'overclock']);
    }
    ranks.overclock = MAX_UPGRADE_RANK;
    ranks.frostbite = MAX_UPGRADE_RANK;
    expect(rollDraft(ranks, rng, 3)).toEqual([]);
  });
});

describe('upgrade effects', () => {
  it('scale per rank', () => {
    const r = emptyRanks();
    expect(fireRateMultiplier(r)).toBe(1);
    expect(critChance(r)).toBe(0);
    expect(splashFraction(r)).toBe(0);
    expect(chainBounces(r)).toBe(0);
    r.overclock = 2;
    r.criticalStrike = 3;
    r.explosiveRounds = 2;
    r.chainLightning = 3;
    r.frostbite = 1;
    expect(fireRateMultiplier(r)).toBeCloseTo(1 + 2 * V.overclock.fireRatePerRank);
    expect(critChance(r)).toBeCloseTo(3 * V.criticalStrike.chancePerRank);
    expect(splashFraction(r)).toBeCloseTo(V.explosiveRounds.splashBase + V.explosiveRounds.splashPerRank);
    expect(chainBounces(r)).toBe(3 * V.chainLightning.bouncesPerRank);
    expect(frostbiteMultiplier(r)).toBeCloseTo(1 + V.frostbite.bonusPerRank);
  });

  it('compound interest pays a share of unspent gold, capped per rank', () => {
    const r = emptyRanks();
    expect(interestPayout(r, 500)).toBe(0);
    r.compoundInterest = 1;
    expect(interestPayout(r, 100)).toBe(Math.floor(100 * V.compoundInterest.ratePerRank));
    expect(interestPayout(r, 100000)).toBe(V.compoundInterest.capPerRank);
    r.compoundInterest = 2;
    expect(interestPayout(r, 100000)).toBe(2 * V.compoundInterest.capPerRank);
  });

  /** A run where enemies are effectively unkillable, so towers always have a target. */
  const tanky = () => {
    const ctx = makeSim();
    return makeSim({}, { map: { ...ctx.sim.map, modifiers: { ...ctx.sim.map.modifiers, enemyHp: 1000 } } });
  };

  it('overclock shortens the time between shots', () => {
    const interval = (overclock: number) => {
      const { sim, bus } = tanky();
      sim.upgrades.overclock = overclock;
      sim.placeTower('basic', 1, 3);
      const times: number[] = [];
      let t = 0;
      bus.on('towerFired', () => times.push(t));
      sim.startWave();
      for (; t < 6; t += STEP) sim.step(STEP);
      return (times.at(-1)! - times[0]) / (times.length - 1);
    };
    const base = 1 / TOWERS.basic.levels[0].fireRate;
    expect(interval(0)).toBeCloseTo(base, 1);
    expect(interval(2)).toBeCloseTo(base / (1 + 2 * V.overclock.fireRatePerRank), 1);
  });

  it('critical hits deal multiplied damage', () => {
    const { sim, bus } = tanky();
    sim.upgrades.criticalStrike = MAX_UPGRADE_RANK;
    sim.placeTower('sniper', 5, 5);
    const pending: { enemy: { hp: number }; before: number; crit: boolean }[] = [];
    const dealt = { crit: new Set<number>(), normal: new Set<number>() };
    bus.on('projectileHit', ({ enemy, crit }) => pending.push({ enemy, before: enemy.hp, crit }));
    sim.startWave();
    for (let t = 0; t < 40 && (dealt.crit.size === 0 || dealt.normal.size === 0); t += STEP) {
      sim.step(STEP);
      for (const p of pending.splice(0)) (p.crit ? dealt.crit : dealt.normal).add(Math.round(p.before - p.enemy.hp));
    }
    const dmg = TOWERS.sniper.levels[0].damage;
    expect([...dealt.normal]).toEqual([dmg]);
    expect([...dealt.crit]).toEqual([dmg * V.criticalStrike.damageMultiplier]);
  });

  it('frostbite adds damage against slowed enemies', () => {
    const run = (frostbite: number) => {
      const { sim } = makeSim();
      sim.upgrades.frostbite = frostbite;
      sim.startWave();
      sim.step(STEP);
      const e = sim.enemies[0];
      e.slowFactor = 0.5;
      e.slowTimer = 99;
      const hpBefore = e.hp;
      sim.placeTower('basic', 1, 3);
      runUntil(sim, () => e.hp < hpBefore, 10);
      return hpBefore - e.hp;
    };
    expect(run(0)).toBe(TOWERS.basic.levels[0].damage);
    expect(run(2)).toBeCloseTo(TOWERS.basic.levels[0].damage * (1 + 2 * V.frostbite.bonusPerRank));
  });

  it('explosive rounds splash nearby enemies, and chain lightning jumps between them', () => {
    const hitsWith = (setup: (s: ReturnType<typeof makeSim>['sim']) => void, event: 'splash' | 'chainArc') => {
      const { sim, bus } = makeSim({ startingGold: 1000 });
      setup(sim);
      let n = 0;
      bus.on(event, () => n++);
      sim.placeTower('basic', 3, 3);
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave', 120);
      return { n, kills: sim.stats.kills };
    };
    const splash = hitsWith((s) => (s.upgrades.explosiveRounds = 1), 'splash');
    const chain = hitsWith((s) => (s.upgrades.chainLightning = 1), 'chainArc');
    const plainSplash = hitsWith(() => {}, 'splash');
    const plainChain = hitsWith(() => {}, 'chainArc');
    expect(splash.n).toBeGreaterThan(0);
    expect(chain.n).toBeGreaterThan(0);
    expect(plainSplash.n).toBe(0);
    expect(plainChain.n).toBe(0);
    expect(splash.kills).toBeGreaterThanOrEqual(plainSplash.kills);
    expect(chain.kills).toBeGreaterThanOrEqual(plainChain.kills);
  });

  it('pays interest when a wave is cleared', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    sim.upgrades.compoundInterest = 1;
    for (const [c, r] of [[3, 3], [5, 3], [3, 1]]) sim.placeTower('basic', c, r);
    let interest = -1;
    bus.on('waveCleared', (e) => (interest = e.interest));
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
    expect(interest).toBe(V.compoundInterest.capPerRank);
  });
});

describe('map modifiers', () => {
  it('scale enemy health, speed, count and income per map', () => {
    const { sim: base } = makeSim();
    const { sim: hard } = makeSim(
      {},
      {
        map: {
          ...base.map,
          modifiers: { enemyHp: 2, enemySpeed: 1.5, enemyCount: 2, goldIncome: 0.5, startingGold: 0.5 },
        },
      },
    );
    expect(hard.gold).toBe(Math.round(base.gold * 0.5));
    let spawnedBase = 0;
    let spawnedHard = 0;
    for (const [sim, add] of [[base, () => spawnedBase++], [hard, () => spawnedHard++]] as const) {
      sim.startWave();
      sim.step(STEP);
      const e = sim.enemies[0];
      add();
      expect(e).toBeDefined();
    }
    const b = base.enemies[0];
    const h = hard.enemies[0];
    expect(h.maxHp).toBe(b.maxHp * 2);
    expect(h.speed).toBeCloseTo(b.speed * 1.5);
    expect(h.reward).toBe(Math.round(b.reward * 0.5));
    let leakedBase = 0;
    let leakedHard = 0;
    runUntil(base, () => { leakedBase = base.stats.leaks; return base.phase !== 'wave'; });
    runUntil(hard, () => { leakedHard = hard.stats.leaks; return hard.phase !== 'wave' && hard.phase !== 'gameover'; });
    expect(leakedHard).toBeGreaterThan(leakedBase);
  });
});
