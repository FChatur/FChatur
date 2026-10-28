export type UpgradeId =
  | 'chainLightning'
  | 'overclock'
  | 'criticalStrike'
  | 'compoundInterest'
  | 'frostbite'
  | 'explosiveRounds';

/** Every upgrade can be picked up to this many times; each pick raises its rank by one. */
export const MAX_UPGRADE_RANK = 3;

/** Tunable numbers for each run upgrade. Effects apply to all towers. */
export const UPGRADE_VALUES = {
  chainLightning: {
    /** Extra enemies each hit jumps to, per rank. */
    bouncesPerRank: 1,
    /** Damage of each jump as a fraction of the original hit. */
    damageFraction: 0.5,
    /** Maximum jump distance in tiles. */
    rangeTiles: 1.75,
  },
  overclock: {
    /** Fire rate bonus per rank (0.15 = +15%). */
    fireRatePerRank: 0.15,
  },
  criticalStrike: {
    /** Chance per rank that a hit is critical. */
    chancePerRank: 0.15,
    damageMultiplier: 2,
  },
  compoundInterest: {
    /** Share of unspent gold paid out when a wave is cleared, per rank. */
    ratePerRank: 0.1,
    /** Maximum payout per wave, per rank. */
    capPerRank: 40,
  },
  frostbite: {
    /** Extra damage taken by slowed enemies, per rank (0.25 = +25%). */
    bonusPerRank: 0.25,
  },
  explosiveRounds: {
    /** Splash damage as a fraction of the hit at rank 1, plus this much per extra rank. */
    splashBase: 0.3,
    splashPerRank: 0.15,
    /** Splash radius in tiles around the impact. */
    radiusTiles: 0.9,
  },
} as const;

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  /** What the upgrade does at the given rank (1-based), for the pick screen. */
  describe: (rank: number) => string;
  color: number;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const V = UPGRADE_VALUES;

export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  chainLightning: {
    id: 'chainLightning',
    name: 'Chain Lightning',
    describe: (r) =>
      `Hits jump to ${r * V.chainLightning.bouncesPerRank} more nearby ${r === 1 ? 'enemy' : 'enemies'} for ${pct(V.chainLightning.damageFraction)} damage.`,
    color: 0x93c5fd,
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    describe: (r) => `All towers fire ${pct(r * V.overclock.fireRatePerRank)} faster.`,
    color: 0xfb923c,
  },
  criticalStrike: {
    id: 'criticalStrike',
    name: 'Critical Strike',
    describe: (r) =>
      `${pct(r * V.criticalStrike.chancePerRank)} chance for hits to deal ${V.criticalStrike.damageMultiplier}x damage.`,
    color: 0xfacc15,
  },
  compoundInterest: {
    id: 'compoundInterest',
    name: 'Compound Interest',
    describe: (r) =>
      `Clearing a wave pays ${pct(r * V.compoundInterest.ratePerRank)} of your unspent gold (max ${r * V.compoundInterest.capPerRank}).`,
    color: 0xffd166,
  },
  frostbite: {
    id: 'frostbite',
    name: 'Frostbite',
    describe: (r) => `Slowed enemies take ${pct(r * V.frostbite.bonusPerRank)} more damage.`,
    color: 0x7dd3fc,
  },
  explosiveRounds: {
    id: 'explosiveRounds',
    name: 'Explosive Rounds',
    describe: (r) =>
      `Hits splash ${pct(V.explosiveRounds.splashBase + (r - 1) * V.explosiveRounds.splashPerRank)} damage to nearby enemies.`,
    color: 0xf87171,
  },
};

export const UPGRADE_ORDER: readonly UpgradeId[] = [
  'chainLightning',
  'overclock',
  'criticalStrike',
  'compoundInterest',
  'frostbite',
  'explosiveRounds',
];
