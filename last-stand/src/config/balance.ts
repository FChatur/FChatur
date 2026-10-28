export interface WaveBalance {
  /** Enemies in wave 1. */
  baseCount: number;
  /** Extra enemies added per wave after the first (fractions accumulate). */
  countPerWave: number;
  /** Seconds between spawns in wave 1. */
  spawnIntervalStart: number;
  /** Spawn interval never drops below this. */
  spawnIntervalMin: number;
  /** Spawn interval is multiplied by this each wave. */
  spawnIntervalDecay: number;
  /** Enemy health is multiplied by this each wave. */
  hpGrowthPerWave: number;
  /** Gold for clearing wave 1. */
  clearBonusBase: number;
  /** Extra clear bonus per wave after the first. */
  clearBonusPerWave: number;
}

export interface BalanceConfig {
  startingGold: number;
  startingHealth: number;
  waves: WaveBalance;
}

export const BALANCE: BalanceConfig = {
  startingGold: 120,
  startingHealth: 20,
  waves: {
    baseCount: 8,
    countPerWave: 2,
    spawnIntervalStart: 1.0,
    spawnIntervalMin: 0.35,
    spawnIntervalDecay: 0.96,
    hpGrowthPerWave: 1.13,
    clearBonusBase: 20,
    clearBonusPerWave: 3,
  },
};

export const SIMULATION = {
  /** Fixed simulation step. Rendering interpolates between steps. */
  stepSeconds: 1 / 60,
  /** Upper bound on catch-up steps per rendered frame, so a stall can't freeze the tab. */
  maxStepsPerFrame: 8,
  /** Frame deltas above this (e.g. returning from a background tab) are clamped. */
  maxFrameDeltaMs: 250,
} as const;
