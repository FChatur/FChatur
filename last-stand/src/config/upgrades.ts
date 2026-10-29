import type { TowerTypeId } from './towers';

/**
 * Run upgrades ("roguelite upgrades") as data. Adding content means adding an entry to UPGRADE_DEFS;
 * the draft, stacking, descriptions, UI and tests pick it up automatically.
 * Design goals: docs/PLAN.md section 7.
 */

/** Unique, stable identifier. Never rename one that has shipped. */
export type UpgradeId = string;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export const RARITY_INFO: Record<Rarity, { label: string; color: number }> = {
  common: { label: 'Common', color: 0x9ca3af },
  uncommon: { label: 'Uncommon', color: 0x4ade80 },
  rare: { label: 'Rare', color: 0x60a5fa },
  legendary: { label: 'Legendary', color: 0xf59e0b },
};

/**
 * Effect primitives. Numeric ones aggregate in core/modifiers.ts; mechanic ones (splash, chain, ...)
 * each have one handler in the simulation. To add a new mechanic: add a kind here, aggregate it in
 * modifiers.ts, handle it in Simulation, describe it in describeEffect below.
 * "perStack" values are multiplied by how many times the upgrade has been taken.
 */
export type UpgradeEffect =
  /** +perStack fire rate (0.15 = 15% faster). */
  | { kind: 'fireRate'; perStack: number }
  /** +perStack chance for hits to deal `multiplier` damage. Chances add up; the highest multiplier applies. */
  | { kind: 'crit'; perStack: number; multiplier: number }
  /** +perStack damage against enemies that are currently slowed. */
  | { kind: 'damageVsSlowed'; perStack: number }
  /** Hits splash `base` (+perStack per extra stack) of their damage within `radiusTiles`. */
  | { kind: 'splash'; base: number; perStack: number; radiusTiles: number }
  /** Hits jump to `bouncesPerStack` more enemies each for `damageFraction` damage, up to `rangeTiles` apart. */
  | { kind: 'chain'; bouncesPerStack: number; damageFraction: number; rangeTiles: number }
  /** Clearing a wave pays ratePerStack of unspent gold, at most capPerStack per stack. */
  | { kind: 'interest'; ratePerStack: number; capPerStack: number };

export type UpgradeEffectKind = UpgradeEffect['kind'];

export interface UpgradeRequirements {
  /** Not offered before this wave has been cleared. */
  minWave?: number;
  /** Every listed upgrade must already be owned. */
  upgrades?: readonly UpgradeId[];
  /**
   * At least one tower of a listed type must currently be built.
   * Defaults to the upgrade's `towers` scope, so tower-specific upgrades only appear when relevant.
   */
  towers?: readonly TowerTypeId[];
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  rarity: Rarity;
  /** How many times it can be taken. 1 = unique. */
  maxStacks: number;
  /** Restricts all effects to these tower types. Omit for an upgrade that affects every tower. */
  towers?: readonly TowerTypeId[];
  requires?: UpgradeRequirements;
  effects: readonly UpgradeEffect[];
  /** Optional extra draft weight multiplier within its rarity (default 1). */
  weight?: number;
  /** Optional flavour/override text; descriptions are otherwise generated from effects. */
  describe?: (stacks: number) => string;
  color: number;
}

export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  {
    id: 'overclock',
    name: 'Overclock',
    rarity: 'common',
    maxStacks: 3,
    effects: [{ kind: 'fireRate', perStack: 0.15 }],
    color: 0xfb923c,
  },
  {
    id: 'criticalStrike',
    name: 'Critical Strike',
    rarity: 'common',
    maxStacks: 3,
    effects: [{ kind: 'crit', perStack: 0.15, multiplier: 2 }],
    color: 0xfacc15,
  },
  {
    id: 'compoundInterest',
    name: 'Compound Interest',
    rarity: 'uncommon',
    maxStacks: 3,
    effects: [{ kind: 'interest', ratePerStack: 0.1, capPerStack: 40 }],
    color: 0xffd166,
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    rarity: 'uncommon',
    maxStacks: 3,
    // Only slows make it useful, so it waits until a Frost tower is on the board.
    requires: { towers: ['frost'] },
    effects: [{ kind: 'damageVsSlowed', perStack: 0.25 }],
    color: 0x7dd3fc,
  },
  {
    id: 'explosiveRounds',
    name: 'Explosive Rounds',
    rarity: 'rare',
    maxStacks: 3,
    effects: [{ kind: 'splash', base: 0.3, perStack: 0.15, radiusTiles: 0.9 }],
    color: 0xf87171,
  },
  {
    id: 'chainLightning',
    name: 'Chain Lightning',
    rarity: 'rare',
    maxStacks: 3,
    effects: [{ kind: 'chain', bouncesPerStack: 1, damageFraction: 0.5, rangeTiles: 1.75 }],
    color: 0x93c5fd,
  },
];

export const UPGRADES: ReadonlyMap<UpgradeId, UpgradeDef> = new Map(UPGRADE_DEFS.map((d) => [d.id, d]));

export function getUpgrade(id: UpgradeId): UpgradeDef {
  const def = UPGRADES.get(id);
  if (!def) throw new Error(`Unknown upgrade "${id}"`);
  return def;
}

// ---------------------------------------------------------------- descriptions

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function describeEffect(e: UpgradeEffect, stacks: number): string {
  switch (e.kind) {
    case 'fireRate':
      return `fire ${pct(e.perStack * stacks)} faster`;
    case 'crit':
      return `have a ${pct(e.perStack * stacks)} chance to deal ${e.multiplier}x damage`;
    case 'damageVsSlowed':
      return `deal ${pct(e.perStack * stacks)} more damage to slowed enemies`;
    case 'splash':
      return `splash ${pct(e.base + e.perStack * (stacks - 1))} damage to nearby enemies`;
    case 'chain': {
      const n = e.bouncesPerStack * stacks;
      return `have hits jump to ${n} more nearby ${n === 1 ? 'enemy' : 'enemies'} for ${pct(e.damageFraction)} damage`;
    }
    case 'interest':
      return `clearing a wave pays ${pct(e.ratePerStack * stacks)} of unspent gold (max ${e.capPerStack * stacks})`;
  }
}

/** Player-facing text for an upgrade at the given stack count (1-based). */
export function describeUpgrade(def: UpgradeDef, stacks: number, towerNames?: (t: TowerTypeId) => string): string {
  if (def.describe) return def.describe(stacks);
  const subject = def.towers
    ? `${def.towers.map((t) => plural(towerNames?.(t) ?? t)).join(' and ')}`
    : 'Towers';
  const towerEffects = def.effects.filter((e) => e.kind !== 'interest').map((e) => describeEffect(e, stacks));
  const economy = def.effects.filter((e) => e.kind === 'interest').map((e) => describeEffect(e, stacks));
  if (towerEffects.length === 0) return economy.map(capitalise).join('. ') + '.';
  return [`${subject} ${towerEffects.join(' and ')}`, ...economy.map(capitalise)].join('. ') + '.';
}

/** "Ballista Tower" → "Ballista Towers", "sniper" → "sniper towers". */
function plural(name: string): string {
  return /tower$/i.test(name) ? `${name}s` : `${name} towers`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
