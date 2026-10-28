import type { Rarity, UpgradeDef, UpgradeId } from '../config/upgrades';
import type { TowerTypeId } from '../config/towers';
import type { Rng } from './random';

/** Combined effect of every owned upgrade on one tower type. */
export interface TowerModifiers {
  fireRateMultiplier: number;
  critChance: number;
  critMultiplier: number;
  /** Damage multiplier against slowed enemies. */
  slowedDamageMultiplier: number;
  splashFraction: number;
  /** Tiles. */
  splashRadius: number;
  chainBounces: number;
  chainDamageFraction: number;
  /** Tiles. */
  chainRange: number;
}

const NO_TOWER_MODIFIERS: TowerModifiers = {
  fireRateMultiplier: 1,
  critChance: 0,
  critMultiplier: 1,
  slowedDamageMultiplier: 1,
  splashFraction: 0,
  splashRadius: 0,
  chainBounces: 0,
  chainDamageFraction: 0,
  chainRange: 0,
};

/**
 * The run's owned upgrades and their aggregated effects. Every numeric effect of every upgrade is
 * combined here, in one place, so upgrades compose predictably however many exist.
 * Aggregates are cached per tower type and rebuilt when an upgrade is added.
 */
export class RunModifiers {
  private readonly stacks = new Map<UpgradeId, number>();
  private readonly cache = new Map<TowerTypeId, TowerModifiers>();
  private economy = { interestRate: 0, interestCap: 0 };

  constructor(readonly registry: ReadonlyMap<UpgradeId, UpgradeDef>) {}

  stacksOf(id: UpgradeId): number {
    return this.stacks.get(id) ?? 0;
  }

  /** Owned upgrades with their stack counts, in the order they were first taken. */
  owned(): [UpgradeDef, number][] {
    return [...this.stacks].map(([id, n]) => [this.registry.get(id)!, n]);
  }

  /** Adds one stack. Returns false if unknown or already at max stacks. */
  add(id: UpgradeId): boolean {
    const def = this.registry.get(id);
    if (!def || this.stacksOf(id) >= def.maxStacks) return false;
    this.stacks.set(id, this.stacksOf(id) + 1);
    this.cache.clear();
    this.rebuildEconomy();
    return true;
  }

  forTower(type: TowerTypeId): TowerModifiers {
    let mods = this.cache.get(type);
    if (!mods) {
      mods = this.aggregate(type);
      this.cache.set(type, mods);
    }
    return mods;
  }

  /** Gold paid on wave clear for holding `gold` unspent. */
  interestPayout(gold: number): number {
    if (this.economy.interestRate <= 0 || gold <= 0) return 0;
    return Math.min(Math.floor(gold * this.economy.interestRate), this.economy.interestCap);
  }

  private aggregate(type: TowerTypeId): TowerModifiers {
    if (this.stacks.size === 0) return NO_TOWER_MODIFIERS;
    const m = { ...NO_TOWER_MODIFIERS };
    for (const [def, n] of this.owned()) {
      if (def.towers && !def.towers.includes(type)) continue;
      for (const e of def.effects) {
        switch (e.kind) {
          case 'fireRate':
            m.fireRateMultiplier += e.perStack * n;
            break;
          case 'crit':
            m.critChance = Math.min(1, m.critChance + e.perStack * n);
            m.critMultiplier = Math.max(m.critMultiplier, e.multiplier);
            break;
          case 'damageVsSlowed':
            m.slowedDamageMultiplier += e.perStack * n;
            break;
          case 'splash':
            m.splashFraction += e.base + e.perStack * (n - 1);
            m.splashRadius = Math.max(m.splashRadius, e.radiusTiles);
            break;
          case 'chain':
            m.chainBounces += e.bouncesPerStack * n;
            m.chainDamageFraction = Math.max(m.chainDamageFraction, e.damageFraction);
            m.chainRange = Math.max(m.chainRange, e.rangeTiles);
            break;
          case 'interest':
            break; // economy, not tower-specific
        }
      }
    }
    return m;
  }

  private rebuildEconomy(): void {
    let rate = 0;
    let cap = 0;
    for (const [def, n] of this.owned()) {
      for (const e of def.effects) {
        if (e.kind !== 'interest') continue;
        rate += e.ratePerStack * n;
        cap += e.capPerStack * n;
      }
    }
    this.economy = { interestRate: rate, interestCap: cap };
  }
}

/** What the draft needs to know about the run to decide which upgrades are eligible. */
export interface DraftContext {
  mods: RunModifiers;
  /** Waves cleared so far. */
  wave: number;
  /** Tower types currently on the board. */
  builtTowers: ReadonlySet<TowerTypeId>;
}

export function isEligible(def: UpgradeDef, ctx: DraftContext): boolean {
  if (ctx.mods.stacksOf(def.id) >= def.maxStacks) return false;
  const req = def.requires;
  if (req?.minWave !== undefined && ctx.wave < req.minWave) return false;
  if (req?.upgrades?.some((id) => ctx.mods.stacksOf(id) === 0)) return false;
  const towers = req?.towers ?? def.towers;
  if (towers && !towers.some((t) => ctx.builtTowers.has(t))) return false;
  return true;
}

/**
 * Picks up to `count` distinct eligible upgrades, each draw weighted by rarity weight × the
 * upgrade's own weight. Purely random by weight: offers are never steered toward the player's build.
 */
export function rollDraft(
  ctx: DraftContext,
  rng: Rng,
  count: number,
  rarityWeights: Record<Rarity, number>,
  pool: Iterable<UpgradeDef> = ctx.mods.registry.values(),
): UpgradeId[] {
  const candidates = [...pool]
    .filter((d) => isEligible(d, ctx))
    .map((d) => ({ id: d.id, weight: (rarityWeights[d.rarity] ?? 0) * (d.weight ?? 1) }))
    .filter((c) => c.weight > 0);
  const picks: UpgradeId[] = [];
  while (picks.length < count && candidates.length > 0) {
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = rng() * total;
    let i = 0;
    while (i < candidates.length - 1 && roll >= candidates[i].weight) roll -= candidates[i++].weight;
    picks.push(candidates.splice(i, 1)[0].id);
  }
  return picks;
}
