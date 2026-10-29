import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { TOWERS, type TowerTypeId } from '../src/config/towers';
import {
  describeUpgrade,
  getUpgrade,
  RARITIES,
  UPGRADE_DEFS,
  UPGRADES,
  type UpgradeDef,
  type UpgradeEffectKind,
} from '../src/config/upgrades';
import { isEligible, rollDraft, RunModifiers, type DraftContext } from '../src/core/modifiers';
import { createRng } from '../src/core/random';
import { makeSim, runUntil, STEP } from './helpers';

const { draftEvery, draftChoices, rarityWeights } = BALANCE.roguelite;
const KNOWN_EFFECTS: readonly UpgradeEffectKind[] = ['fireRate', 'crit', 'damageVsSlowed', 'splash', 'chain', 'interest'];

/** Builds a test registry from ad-hoc definitions. */
function registry(...defs: UpgradeDef[]) {
  return new Map(defs.map((d) => [d.id, d]));
}

function def(id: string, extra: Partial<UpgradeDef> = {}): UpgradeDef {
  return { id, name: id, rarity: 'common', maxStacks: 3, effects: [{ kind: 'fireRate', perStack: 0.1 }], color: 0xffffff, ...extra };
}

function ctx(mods: RunModifiers, wave = 5, towers: TowerTypeId[] = ['basic']): DraftContext {
  return { mods, wave, builtTowers: new Set(towers) };
}

describe('upgrade registry', () => {
  it('has unique IDs, valid rarities, stacks, references and known effect kinds', () => {
    expect(new Set(UPGRADE_DEFS.map((d) => d.id)).size).toBe(UPGRADE_DEFS.length);
    for (const d of UPGRADE_DEFS) {
      expect(RARITIES).toContain(d.rarity);
      expect(d.maxStacks).toBeGreaterThanOrEqual(1);
      expect(d.effects.length).toBeGreaterThan(0);
      for (const e of d.effects) expect(KNOWN_EFFECTS).toContain(e.kind);
      for (const t of [...(d.towers ?? []), ...(d.requires?.towers ?? [])]) expect(TOWERS[t]).toBeDefined();
      for (const id of d.requires?.upgrades ?? []) expect(UPGRADES.has(id)).toBe(true);
      for (let n = 1; n <= d.maxStacks; n++) expect(describeUpgrade(d, n)).toMatch(/\.$/);
    }
  });

  it('describes upgrades from their effects', () => {
    expect(describeUpgrade(getUpgrade('overclock'), 2)).toBe('Towers fire 30% faster.');
    expect(describeUpgrade(def('x', { towers: ['sniper'] }), 1, (t) => TOWERS[t].name)).toBe('Ballista Towers fire 10% faster.');
    expect(describeUpgrade(def('x', { towers: ['sniper'] }), 1)).toBe('sniper towers fire 10% faster.');
    expect(describeUpgrade(getUpgrade('compoundInterest'), 1)).toBe('Clearing a wave pays 10% of unspent gold (max 40).');
  });
});

describe('eligibility', () => {
  it('excludes maxed upgrades', () => {
    const mods = new RunModifiers(registry(def('a', { maxStacks: 2 })));
    expect(isEligible(def('a', { maxStacks: 2 }), ctx(mods))).toBe(true);
    mods.add('a');
    mods.add('a');
    expect(mods.add('a')).toBe(false);
    expect(isEligible(def('a', { maxStacks: 2 }), ctx(mods))).toBe(false);
  });

  it('respects required upgrades, minimum wave and required towers', () => {
    const a = def('a');
    const b = def('b', { requires: { upgrades: ['a'], minWave: 10 } });
    const sniperOnly = def('s', { towers: ['sniper'] });
    const mods = new RunModifiers(registry(a, b, sniperOnly));
    expect(isEligible(b, ctx(mods, 10))).toBe(false); // a not owned
    mods.add('a');
    expect(isEligible(b, ctx(mods, 9))).toBe(false); // too early
    expect(isEligible(b, ctx(mods, 10))).toBe(true);
    // Tower-scoped upgrades need that tower on the board (scope doubles as the requirement).
    expect(isEligible(sniperOnly, ctx(mods, 5, ['basic']))).toBe(false);
    expect(isEligible(sniperOnly, ctx(mods, 5, ['basic', 'sniper']))).toBe(true);
    // Frostbite waits for a Frost tower.
    expect(isEligible(getUpgrade('frostbite'), ctx(new RunModifiers(UPGRADES), 5, ['basic']))).toBe(false);
    expect(isEligible(getUpgrade('frostbite'), ctx(new RunModifiers(UPGRADES), 5, ['frost']))).toBe(true);
  });
});

describe('draft rolls', () => {
  it('offers distinct eligible upgrades and handles any pool size', () => {
    const many = Array.from({ length: 40 }, (_, i) => def(`u${i}`, { rarity: RARITIES[i % 4] }));
    const mods = new RunModifiers(registry(...many));
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const offer = rollDraft(ctx(mods), rng, draftChoices, rarityWeights);
      expect(offer).toHaveLength(draftChoices);
      expect(new Set(offer).size).toBe(draftChoices);
    }
    const tiny = new RunModifiers(registry(def('only')));
    expect(rollDraft(ctx(tiny), rng, 3, rarityWeights)).toEqual(['only']);
    expect(rollDraft(ctx(new RunModifiers(registry())), rng, 3, rarityWeights)).toEqual([]);
  });

  it('weights draws by rarity', () => {
    const pool = RARITIES.map((r) => def(r, { rarity: r }));
    const mods = new RunModifiers(registry(...pool));
    const rng = createRng(11);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    const draws = 20000;
    for (let i = 0; i < draws; i++) counts[rollDraft(ctx(mods), rng, 1, rarityWeights)[0]]++;
    const total = RARITIES.reduce((s, r) => s + rarityWeights[r], 0);
    for (const r of RARITIES) expect(counts[r] / draws).toBeCloseTo(rarityWeights[r] / total, 1);
  });

  it('is deterministic for a seed', () => {
    const mods = new RunModifiers(UPGRADES);
    const a = rollDraft(ctx(mods, 5, ['frost']), createRng(99), 3, rarityWeights);
    const b = rollDraft(ctx(mods, 5, ['frost']), createRng(99), 3, rarityWeights);
    expect(a).toEqual(b);
  });
});

/** Clears waves with a sturdy defence until the first draft opens. */
function reachDraft(seed = 1) {
  const c = makeSim({ startingGold: 5000 }, { seed });
  const { sim } = c;
  for (const [col, row] of [[3, 3], [5, 7], [8, 7], [10, 4], [13, 4], [15, 8], [5, 3], [10, 7]]) {
    const t = sim.placeTower('basic', col, row)!;
    sim.upgradeTower(t);
    sim.upgradeTower(t);
  }
  while (sim.phase !== 'draft' && sim.phase !== 'gameover') {
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
  }
  return c;
}

describe('draft in a run', () => {
  it(`opens after every ${draftEvery}th wave with ${draftChoices} distinct, eligible choices`, () => {
    const { sim } = reachDraft();
    expect(sim.phase).toBe('draft');
    expect(sim.wave).toBe(draftEvery);
    expect(new Set(sim.draftChoices).size).toBe(draftChoices);
    // Only Turrets are built, so Frostbite (needs a Frost tower) is never offered.
    expect(sim.draftChoices).not.toContain('frostbite');
  });

  it('blocks the next wave until a choice is made, and only accepts offered upgrades', () => {
    const { sim, bus } = reachDraft();
    const chosen: string[] = [];
    bus.on('upgradeChosen', ({ id, rank }) => chosen.push(`${id}:${rank}`));
    expect(sim.startWave()).toBe(false);
    expect(sim.chooseUpgrade('frostbite')).toBe(false);
    const pick = sim.draftChoices[0];
    expect(sim.chooseUpgrade(pick)).toBe(true);
    expect(sim.mods.stacksOf(pick)).toBe(1);
    expect(sim.phase).toBe('build');
    expect(sim.chooseUpgrade(pick)).toBe(false);
    expect(chosen).toEqual([`${pick}:1`]);
    expect(sim.startWave()).toBe(true);
  });

  it('is reproducible from the seed', () => {
    expect(reachDraft(42).sim.draftChoices).toEqual(reachDraft(42).sim.draftChoices);
  });
});

describe('upgrade effects', () => {
  it('aggregate across upgrades and stacks, per tower type', () => {
    const reg = registry(
      def('fast', { effects: [{ kind: 'fireRate', perStack: 0.1 }] }),
      def('fastSniper', { towers: ['sniper'], effects: [{ kind: 'fireRate', perStack: 0.5 }] }),
      def('crit', { effects: [{ kind: 'crit', perStack: 0.2, multiplier: 2 }] }),
      def('bigCrit', { effects: [{ kind: 'crit', perStack: 0.1, multiplier: 3 }] }),
    );
    const mods = new RunModifiers(reg);
    mods.add('fast');
    mods.add('fast');
    mods.add('fastSniper');
    mods.add('crit');
    mods.add('bigCrit');
    expect(mods.forTower('basic').fireRateMultiplier).toBeCloseTo(1.2);
    expect(mods.forTower('sniper').fireRateMultiplier).toBeCloseTo(1.7);
    expect(mods.forTower('basic').critChance).toBeCloseTo(0.3);
    expect(mods.forTower('basic').critMultiplier).toBe(3);
  });

  it('compound interest pays a share of unspent gold, capped per stack', () => {
    const mods = new RunModifiers(UPGRADES);
    expect(mods.interestPayout(500)).toBe(0);
    mods.add('compoundInterest');
    expect(mods.interestPayout(100)).toBe(10);
    expect(mods.interestPayout(100000)).toBe(40);
    mods.add('compoundInterest');
    expect(mods.interestPayout(100000)).toBe(80);
  });

  /** A run where enemies are effectively unkillable, so towers always have a target. */
  const tanky = (options: Parameters<typeof makeSim>[1] = {}) => {
    const base = makeSim().sim.map;
    return makeSim({}, { ...options, map: { ...base, modifiers: { ...base.modifiers, enemyHp: 1000 } } });
  };

  it('fire-rate upgrades shorten the time between shots', () => {
    const interval = (stacks: number) => {
      const { sim, bus } = tanky();
      sim.grantUpgrade('overclock', stacks);
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
    expect(interval(2)).toBeCloseTo(base / 1.3, 1);
  });

  it('tower-specific upgrades affect only their towers', () => {
    const shots = (type: TowerTypeId) => {
      const { sim, bus } = tanky({ upgradeRegistry: registry(def('turretOnly', { towers: ['basic'], effects: [{ kind: 'fireRate', perStack: 1 }] })) });
      sim.grantUpgrade('turretOnly');
      const tower = sim.placeTower(type, 1, 3)!;
      let n = 0;
      bus.on('towerFired', (e) => e.tower === tower && n++);
      sim.startWave();
      for (let t = 0; t < 6; t += STEP) sim.step(STEP);
      return n * (1 / TOWERS[type].levels[0].fireRate);
    };
    // Normalised by base fire rate: the boosted Turret fires about twice as often as a plain Rapid.
    expect(shots('basic') / shots('rapid')).toBeGreaterThan(1.6);
  });

  it('critical hits deal multiplied damage', () => {
    const { sim, bus } = tanky();
    sim.grantUpgrade('criticalStrike', 3);
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
    expect([...dealt.crit]).toEqual([dmg * 2]);
  });

  it('frostbite adds damage against slowed enemies', () => {
    const run = (stacks: number) => {
      const { sim } = makeSim();
      sim.grantUpgrade('frostbite', stacks);
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
    expect(run(2)).toBeCloseTo(TOWERS.basic.levels[0].damage * 1.5);
  });

  it('explosive rounds splash nearby enemies, and chain lightning jumps between them', () => {
    const count = (id: string | null, event: 'splash' | 'chainArc') => {
      const { sim, bus } = makeSim({ startingGold: 1000 });
      if (id) sim.grantUpgrade(id);
      let n = 0;
      bus.on(event, () => n++);
      sim.placeTower('basic', 3, 3);
      sim.startWave();
      runUntil(sim, () => sim.phase !== 'wave', 120);
      return n;
    };
    expect(count('explosiveRounds', 'splash')).toBeGreaterThan(0);
    expect(count('chainLightning', 'chainArc')).toBeGreaterThan(0);
    expect(count(null, 'splash')).toBe(0);
    expect(count(null, 'chainArc')).toBe(0);
  });

  it('pays interest when a wave is cleared', () => {
    const { sim, bus } = makeSim({ startingGold: 1000 });
    sim.grantUpgrade('compoundInterest');
    for (const [c, r] of [[3, 3], [5, 3], [3, 1]]) sim.placeTower('basic', c, r);
    let interest = -1;
    bus.on('waveCleared', (e) => (interest = e.interest));
    sim.startWave();
    runUntil(sim, () => sim.phase !== 'wave');
    expect(interest).toBe(40);
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
