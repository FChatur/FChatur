/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { ENEMIES } from '../src/config/enemies';
import { MAPS } from '../src/config/maps';
import { TOWER_ORDER, TOWERS, type TowerTypeId } from '../src/config/towers';
import type { UpgradeId } from '../src/config/upgrades';
import { runStrategy, STRATEGIES, type RunResult, type Strategy } from '../src/balance/harness';
import { mitigate } from '../src/core/Simulation';

/**
 * Tower comparison report (`npm run balance`): how much each tower type contributes per gold, on every
 * map, using the same bots as the balance report. Three views:
 *  1. Paper stats: damage per second per 100 gold at each level, against armor 0 / Brute / boss armor.
 *  2. Damage actually dealt per 100 gold in bot runs (overkill excluded), per tower type.
 *  3. Swap tests: the Mixed build with one tower slot replaced by another type, and
 *     Frostbite on/off, to measure what each choice is worth in waves survived.
 */

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAMES = Object.fromEntries(TOWER_ORDER.map((t) => [t, TOWERS[t].name])) as Record<TowerTypeId, string>;
const MIXED = STRATEGIES.find((s) => s.name === 'Mixed')!;
const MIXED_CYCLE: readonly TowerTypeId[] = ['basic', 'basic', 'basic', 'sniper', 'frost', 'rapid'];

function cycle(name: string, types: readonly TowerTypeId[], base: Strategy = MIXED): Strategy {
  return { ...base, name, towerFor: (n) => types[n % types.length] };
}

/** The Mixed cycle with the last slot of type `from` replaced by `to` (the opening stays the same). */
function swap(from: TowerTypeId, to: TowerTypeId): Strategy {
  const types = [...MIXED_CYCLE];
  types[types.lastIndexOf(from)] = to;
  return cycle(`Mixed, ${NAMES[from]} slot → ${NAMES[to]}`, types);
}

/** Early game: the given opening towers, then the Mixed cycle. */
function opening(first: readonly TowerTypeId[]): Strategy {
  return { ...cycle(`Opening ${first.map((t) => NAMES[t]).join(', ')}`, MIXED_CYCLE), towerFor: (n) => first[n] ?? MIXED_CYCLE[n % MIXED_CYCLE.length] };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const f1 = (n: number) => n.toFixed(1);

function paperTable(): string {
  const brute = ENEMIES.armored;
  const boss = ENEMIES.boss;
  const lines = [
    '| Tower | Level | Gold in | DPS | DPS per 100g | vs Brute (armor ' + brute.armor + ') | vs boss (armor ' + boss.armor + ') |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const t of TOWER_ORDER) {
    const cfg = TOWERS[t];
    let gold = cfg.cost;
    cfg.levels.forEach((l, i) => {
      if (i > 0) gold += l.upgradeCost;
      const dps = l.damage * l.fireRate;
      const vs = (armor: number) => (mitigate(l.damage, armor, BALANCE.armorMinDamageFraction) * l.fireRate * 100) / gold;
      lines.push(`| ${cfg.name} | ${i + 1} | ${gold} | ${f1(dps)} | ${f1((dps * 100) / gold)} | ${f1(vs(brute.armor))} | ${f1(vs(boss.armor))} |`);
    });
  }
  return lines.join('\n');
}

interface Row {
  name: string;
  runs: RunResult[];
}

function runAll(strategies: readonly Strategy[], maxWave?: number): Row[] {
  const rows: Row[] = [];
  for (const map of Object.values(MAPS)) {
    for (const s of strategies) {
      rows.push({ name: `${map.name} · ${s.name}`, runs: SEEDS.map((seed) => runStrategy(map, s, seed, { maxWave })) });
    }
  }
  return rows;
}

function wavesTable(rows: Row[], baseline?: number): string {
  const lines = ['| Build | Waves (median, range) | First leak (median) | vs baseline |', '| --- | --- | --- | --- |'];
  for (const r of rows) {
    const w = r.runs.map((x) => x.wavesReached);
    const m = median(w);
    const leak = median(r.runs.map((x) => x.firstLeakWave ?? x.wavesReached));
    const delta = baseline === undefined ? '' : `${m - baseline >= 0 ? '+' : ''}${m - baseline}`;
    lines.push(`| ${r.name} | ${m} (${Math.min(...w)}–${Math.max(...w)}) | ${leak} | ${delta} |`);
  }
  return lines.join('\n');
}

function earlyTable(rows: Row[], waves: number): string {
  const lines = [`| Opening | Health left after wave ${waves} (mean) | Runs without a leak | First leak (median) |`, '| --- | --- | --- | --- |'];
  for (const r of rows) {
    const clean = r.runs.filter((x) => x.firstLeakWave === null).length;
    const leak = median(r.runs.map((x) => x.firstLeakWave ?? waves + 1));
    lines.push(`| ${r.name} | ${f1(mean(r.runs.map((x) => x.healthLeft)))} | ${clean}/${r.runs.length} | ${leak > waves ? 'none' : leak} |`);
  }
  return lines.join('\n');
}

function damageTable(rows: Row[]): string {
  const lines = [
    '| Build | Tower | Share of gold | Share of damage | Damage per gold | Overkill |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const gold = (t: TowerTypeId) => mean(r.runs.map((x) => x.investedByTower[t]));
    const dmg = (t: TowerTypeId) => mean(r.runs.map((x) => x.damageByTower[t]));
    const over = (t: TowerTypeId) => mean(r.runs.map((x) => x.overkillByTower[t]));
    const totalGold = TOWER_ORDER.reduce((a, t) => a + gold(t), 0);
    const totalDmg = TOWER_ORDER.reduce((a, t) => a + dmg(t), 0);
    for (const t of TOWER_ORDER) {
      if (gold(t) === 0) continue;
      const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
      lines.push(
        `| ${r.name} | ${NAMES[t]} | ${pct(gold(t), totalGold)} | ${pct(dmg(t), totalDmg)} | ${Math.round(dmg(t) / gold(t))} | ${pct(over(t), dmg(t) + over(t))} |`,
      );
    }
  }
  return lines.join('\n');
}

const noFrostbite = (s: Strategy, name: string): Strategy => ({ ...s, name, draftAvoid: ['frostbite' as UpgradeId] });

it('tower report', { timeout: 900_000 }, () => {
  const official = runAll(STRATEGIES);
  const mixedBaseline = median(official.find((r) => r.name.endsWith('· Mixed'))!.runs.map((x) => x.wavesReached));

  const swaps = runAll(
    TOWER_ORDER.flatMap((from) => TOWER_ORDER.filter((to) => to !== from).map((to) => swap(from, to))),
  );

  const EARLY = 12;
  const openings = runAll(
    [
      ['basic', 'basic', 'basic'],
      ['basic', 'sniper', 'basic'],
      ['sniper', 'basic', 'basic'],
      ['basic', 'rapid', 'basic'],
      ['rapid', 'basic', 'basic'],
      ['basic', 'frost', 'basic'],
      ['basic', 'basic', 'sniper'],
      ['basic', 'basic', 'rapid'],
    ].map((o) => opening(o as TowerTypeId[])),
    EARLY,
  );

  const heavy = runAll([
    STRATEGIES.find((s) => s.name === 'Turrets + upgrades')!,
    cycle('2 Turrets, then only Snipers', ['sniper']),
    cycle('2 Turrets, then only Rapids', ['rapid']),
  ].map((s, i) => (i === 0 ? s : { ...s, towerFor: (n: number) => (n < 2 ? 'basic' : s.towerFor(n)) })));

  const frostRapid = STRATEGIES.find((s) => s.name === 'Frost + Rapid shred')!;
  const frostbite = runAll([
    frostRapid,
    noFrostbite(frostRapid, 'Frost + Rapid shred, never Frostbite'),
    MIXED,
    noFrostbite(MIXED, 'Mixed, never Frostbite'),
  ]);

  const report = [
    '# Tower report',
    '',
    `Seeds: ${SEEDS.join(', ')}. Bots and spending rules as in the balance report.`,
    '',
    '## 1. Paper stats (damage per second per 100 gold invested)',
    '',
    paperTable(),
    '',
    '## 2. Damage dealt in bot runs (averaged over seeds; overkill excluded)',
    '',
    damageTable(official),
    '',
    '## 3. Swap tests: the Mixed build with one slot changed',
    '',
    `Mixed cycle: ${MIXED_CYCLE.map((t) => NAMES[t]).join(', ')} (repeating). Baseline median: wave ${mixedBaseline}.`,
    '',
    wavesTable(swaps, mixedBaseline),
    '',
    `## 4. Early game: the first three towers, first ${EARLY} waves`,
    '',
    earlyTable(openings, EARLY),
    '',
    '## 5. One tower type after a two-Turret start',
    '',
    wavesTable(heavy),
    '',
    '## 6. Frostbite on and off',
    '',
    wavesTable(frostbite),
    '',
  ].join('\n');
  writeFileSync('tower-report.md', report);
  process.stdout.write(`\n${report}\n(also written to tower-report.md)\n`);
});
