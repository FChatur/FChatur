export interface WaveBalance {
  /** Enemies in wave 1. */
  baseCount: number;
  /** Extra enemies added per wave after the first (fractions accumulate). */
  countPerWave: number;
  /**
   * Regular enemies per wave never exceed this (before map modifiers). Late-game difficulty then
   * comes from tougher enemies rather than ever-longer streams, so a slightly-too-weak defence leaks
   * a few enemies per wave instead of collapsing in one.
   */
  maxCount: number;
  /** Seconds between spawns in wave 1. */
  spawnIntervalStart: number;
  /** Spawn interval never drops below this. */
  spawnIntervalMin: number;
  /** Spawn interval is multiplied by this each wave. */
  spawnIntervalDecay: number;
  /** Enemy health is multiplied by this each wave (compounding). */
  hpGrowthPerWave: number;
  /** Plus this much linear health growth per wave (0.1 = +10% of base per wave), applied on top. */
  hpLinearPerWave: number;
  /** Gold for clearing wave 1. */
  clearBonusBase: number;
  /** Extra clear bonus per wave after the first. */
  clearBonusPerWave: number;
  /** First wave that includes Runners, their share of the wave then, growth per wave, and cap. */
  runners: EnemyMix;
  /** Same for Brutes (armored). */
  armored: EnemyMix;
  /** A boss joins every Nth wave, after the regular enemies. */
  bossEvery: number;
  /** Seconds between the last regular spawn and the boss. */
  bossDelay: number;
}

export interface EnemyMix {
  fromWave: number;
  startShare: number;
  sharePerWave: number;
  maxShare: number;
}

import type { Rarity } from './upgrades';

export interface RogueliteBalance {
  /** After clearing every Nth wave, the player picks a run upgrade. */
  draftEvery: number;
  /** Upgrades offered per pick (always distinct). */
  draftChoices: number;
  /** Relative chance of each rarity per draw (normalised over the eligible pool). */
  rarityWeights: Record<Rarity, number>;
}

export interface BalanceConfig {
  startingGold: number;
  startingHealth: number;
  /** Fraction of all gold spent on a tower (build + upgrades) returned when it is sold. */
  sellRefundRatio: number;
  /** Armor can never reduce a hit below this fraction of its damage. */
  armorMinDamageFraction: number;
  waves: WaveBalance;
  roguelite: RogueliteBalance;
}

export const BALANCE: BalanceConfig = {
  startingGold: 120,
  startingHealth: 20,
  sellRefundRatio: 0.7,
  armorMinDamageFraction: 0.25,
  waves: {
    baseCount: 8,
    countPerWave: 2,
    maxCount: 30,
    spawnIntervalStart: 1.0,
    spawnIntervalMin: 0.35,
    spawnIntervalDecay: 0.96,
    hpGrowthPerWave: 1.12,
    hpLinearPerWave: 0.02,
    clearBonusBase: 20,
    clearBonusPerWave: 3,
    runners: { fromWave: 3, startShare: 0.15, sharePerWave: 0.03, maxShare: 0.35 },
    armored: { fromWave: 5, startShare: 0.1, sharePerWave: 0.025, maxShare: 0.3 },
    bossEvery: 10,
    bossDelay: 2,
  },
  roguelite: {
    draftEvery: 5,
    draftChoices: 3,
    rarityWeights: { common: 60, uncommon: 28, rare: 10, legendary: 2 },
  },
};

export const SIMULATION = {
  /** Fixed simulation step. Rendering interpolates between steps. */
  stepSeconds: 1 / 60,
  /** Upper bound on catch-up steps per rendered frame, so a stall can't freeze the tab. */
  maxStepsPerFrame: 24,
  /** Frame deltas above this (e.g. returning from a background tab) are clamped. */
  maxFrameDeltaMs: 250,
} as const;

/** Selectable game speeds (simulation seconds per real second). */
export const GAME_SPEEDS = [1, 2, 3] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];
