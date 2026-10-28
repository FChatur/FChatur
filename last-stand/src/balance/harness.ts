/**
 * Headless balance harness: plays scripted strategies on any map and reports how far they get.
 * Map-agnostic by design (see docs/PLAN.md, "Balance principles"): bots choose build spots by
 * measuring path coverage on whatever map they are given, never from hardcoded tiles.
 * Not bundled into the game; run with `npm run balance`.
 */
import { BALANCE, type BalanceConfig } from '../config/balance';
import type { MapConfig } from '../config/maps';
import { TOWERS, type TowerTypeId } from '../config/towers';
import type { UpgradeId } from '../config/upgrades';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Simulation } from '../core/Simulation';

export interface Strategy {
  name: string;
  /** Tower type to build as the bot's nth tower (0-based). */
  towerFor: (n: number) => TowerTypeId;
  /** Spend on upgrades once this many towers exist (Infinity = never upgrade). */
  upgradeAfter: number;
  /** Draft picks, most wanted first. */
  draftPreference: readonly UpgradeId[];
}

export interface RunResult {
  map: string;
  strategy: string;
  seed: number;
  /** Last wave started (the one that ended the run, or the cap). */
  wavesReached: number;
  /** First wave in which any enemy leaked (null if none). */
  firstLeakWave: number | null;
  /** First wave that ended with health below 75% of the starting amount (null if never). */
  troubleWave: number | null;
  /** Health lost to each enemy type during the final wave, e.g. "basic:12 boss:6". */
  finalWaveLeaks: string;
  upgrades: string;
}

const STEP = 1 / 60;

/** Free tiles ordered by how much of the path lies within `rangeTiles` of them. */
export function rankBuildSpots(sim: Simulation, rangeTiles: number): { col: number; row: number }[] {
  const { cols, rows, tileSize } = sim.map.grid;
  const range = rangeTiles * tileSize;
  const samples: { x: number; y: number }[] = [];
  for (let d = 0; d <= sim.path.length; d += tileSize / 8) samples.push(sim.path.positionAt(d));
  const spots: { col: number; row: number; cover: number }[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (sim.path.isPathTile(col, row)) continue;
      const x = (col + 0.5) * tileSize;
      const y = (row + 0.5) * tileSize;
      let cover = 0;
      for (const p of samples) if (Math.hypot(p.x - x, p.y - y) <= range) cover++;
      if (cover > 0) spots.push({ col, row, cover });
    }
  }
  return spots.sort((a, b) => b.cover - a.cover || a.col - b.col || a.row - b.row);
}

export function runStrategy(
  map: MapConfig,
  strategy: Strategy,
  seed: number,
  options: { maxWave?: number; balance?: BalanceConfig } = {},
): RunResult {
  const maxWave = options.maxWave ?? 80;
  const bus = new EventBus<GameEvents>();
  const sim = new Simulation(bus, { map, seed, balance: options.balance ?? BALANCE });
  let firstLeakWave: number | null = null;
  let troubleWave: number | null = null;
  const startHealth = sim.health;
  let finalLeaks = new Map<string, number>();
  bus.on('waveStarted', () => (finalLeaks = new Map()));
  bus.on('enemyLeaked', ({ enemy }) => {
    finalLeaks.set(enemy.type, (finalLeaks.get(enemy.type) ?? 0) + enemy.leakDamage);
    firstLeakWave ??= sim.wave;
    if (sim.health < startHealth * 0.75) troubleWave ??= sim.wave;
  });
  const spotCache = new Map<number, { col: number; row: number }[]>();
  const spotsFor = (type: TowerTypeId) => {
    const range = TOWERS[type].levels[0].rangeTiles;
    if (!spotCache.has(range)) spotCache.set(range, rankBuildSpots(sim, range));
    return spotCache.get(range)!;
  };

  while (sim.phase !== 'gameover' && sim.wave < maxWave) {
    if (sim.phase === 'draft') {
      const pick = strategy.draftPreference.find((id) => sim.draftChoices.includes(id)) ?? sim.draftChoices[0];
      sim.chooseUpgrade(pick);
    }
    spend(sim, strategy, spotsFor);
    sim.startWave();
    let t = 0;
    while (sim.phase === 'wave' && t < 3600) {
      sim.step(STEP);
      t += STEP;
    }
  }

  const owned = sim.mods
    .owned()
    .map(([def, n]) => `${def.id}${n}`)
    .join(' ');
  const finalWaveLeaks = [...finalLeaks].map(([type, hp]) => `${type}:${hp}`).join(' ');
  return {
    map: map.name,
    strategy: strategy.name,
    seed,
    wavesReached: sim.wave,
    firstLeakWave,
    troubleWave,
    finalWaveLeaks,
    upgrades: owned,
  };
}

/** Greedy spending: upgrade the lowest-level tower when allowed, otherwise build on the best free spot. */
function spend(sim: Simulation, s: Strategy, spotsFor: (t: TowerTypeId) => { col: number; row: number }[]): void {
  for (let guard = 0; guard < 500; guard++) {
    if (sim.towers.length >= s.upgradeAfter) {
      const target = sim.towers
        .filter((t) => sim.canUpgradeTower(t).ok)
        .sort((a, b) => a.level - b.level || a.id - b.id)[0];
      if (target && sim.upgradeTower(target)) continue;
    }
    const type = s.towerFor(sim.towers.length);
    const spot = spotsFor(type).find((p) => !sim.towerAt(p.col, p.row));
    if (!spot || !sim.placeTower(type, spot.col, spot.row)) return;
  }
}

/** Draft preferences name upgrades by ID; unknown or ineligible IDs are simply skipped. */
const ALL_UPGRADES: readonly UpgradeId[] = [
  'overclock',
  'criticalStrike',
  'explosiveRounds',
  'chainLightning',
  'frostbite',
  'compoundInterest',
];

/** A spread of play styles, from naive to synergy-focused. */
export const STRATEGIES: readonly Strategy[] = [
  {
    name: 'Turrets, no tower upgrades',
    towerFor: () => 'basic',
    upgradeAfter: Infinity,
    draftPreference: ALL_UPGRADES,
  },
  {
    name: 'Turrets + upgrades',
    towerFor: () => 'basic',
    upgradeAfter: 4,
    draftPreference: ALL_UPGRADES,
  },
  {
    name: 'Sniper crit',
    towerFor: (n) => (n < 3 ? 'basic' : 'sniper'),
    upgradeAfter: 5,
    draftPreference: ['criticalStrike', 'overclock', 'explosiveRounds', 'chainLightning', 'compoundInterest', 'frostbite'],
  },
  {
    name: 'Frost + Rapid shred',
    towerFor: (n) => (n < 2 ? 'basic' : n % 2 === 0 ? 'rapid' : 'frost'),
    upgradeAfter: 5,
    draftPreference: ['frostbite', 'overclock', 'chainLightning', 'explosiveRounds', 'criticalStrike', 'compoundInterest'],
  },
  {
    name: 'Mixed',
    towerFor: (n) => (['basic', 'basic', 'basic', 'sniper', 'frost', 'rapid'] as const)[n % 6],
    upgradeAfter: 4,
    draftPreference: ['overclock', 'explosiveRounds', 'criticalStrike', 'frostbite', 'chainLightning', 'compoundInterest'],
  },
  {
    name: 'Economy (interest first)',
    towerFor: (n) => (n % 4 === 3 ? 'sniper' : 'basic'),
    upgradeAfter: 4,
    draftPreference: ['compoundInterest', 'overclock', 'criticalStrike', 'explosiveRounds', 'chainLightning', 'frostbite'],
  },
];

export function formatReport(results: RunResult[]): string {
  const rows = new Map<string, RunResult[]>();
  for (const r of results) {
    const key = `${r.map}|${r.strategy}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(r);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const lines = [
    '| Map | Strategy | Waves reached (median, range) | First leak | Health < 75% | Warning gap |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const runs of rows.values()) {
    const waves = runs.map((r) => r.wavesReached);
    const mw = median(waves);
    const ml = median(runs.map((r) => r.firstLeakWave ?? r.wavesReached));
    const mt = median(runs.map((r) => r.troubleWave ?? r.wavesReached));
    lines.push(
      `| ${runs[0].map} | ${runs[0].strategy} | ${mw} (${Math.min(...waves)}–${Math.max(...waves)}) | ${ml} | ${mt} | ${mw - mt} waves |`,
    );
  }
  return lines.join('\n');
}
