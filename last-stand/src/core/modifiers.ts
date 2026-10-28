import { MAX_UPGRADE_RANK, UPGRADE_ORDER, UPGRADE_VALUES as V, type UpgradeId } from '../config/upgrades';
import type { Rng } from './random';

/** How many times each run upgrade has been picked (0 = not owned). */
export type UpgradeRanks = Record<UpgradeId, number>;

export function emptyRanks(): UpgradeRanks {
  return Object.fromEntries(UPGRADE_ORDER.map((id) => [id, 0])) as UpgradeRanks;
}

// Every effect of the run upgrades is computed here, so they compose in one predictable place.

export function fireRateMultiplier(r: UpgradeRanks): number {
  return 1 + r.overclock * V.overclock.fireRatePerRank;
}

export function critChance(r: UpgradeRanks): number {
  return Math.min(1, r.criticalStrike * V.criticalStrike.chancePerRank);
}

/** Damage multiplier against an enemy that is currently slowed. */
export function frostbiteMultiplier(r: UpgradeRanks): number {
  return 1 + r.frostbite * V.frostbite.bonusPerRank;
}

export function splashFraction(r: UpgradeRanks): number {
  if (r.explosiveRounds === 0) return 0;
  return V.explosiveRounds.splashBase + (r.explosiveRounds - 1) * V.explosiveRounds.splashPerRank;
}

export function chainBounces(r: UpgradeRanks): number {
  return r.chainLightning * V.chainLightning.bouncesPerRank;
}

/** Gold paid on wave clear for holding `gold` unspent. */
export function interestPayout(r: UpgradeRanks, gold: number): number {
  const rank = r.compoundInterest;
  if (rank === 0 || gold <= 0) return 0;
  return Math.min(Math.floor(gold * rank * V.compoundInterest.ratePerRank), rank * V.compoundInterest.capPerRank);
}

/** Picks up to `count` distinct upgrades that aren't maxed yet. */
export function rollDraft(r: UpgradeRanks, rng: Rng, count: number): UpgradeId[] {
  const pool = UPGRADE_ORDER.filter((id) => r[id] < MAX_UPGRADE_RANK);
  const picks: UpgradeId[] = [];
  while (picks.length < count && pool.length > 0) {
    picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picks;
}
