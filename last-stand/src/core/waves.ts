import type { WaveBalance } from '../config/balance';
import type { EnemyTypeId } from '../config/enemies';

export interface SpawnEntry {
  enemy: EnemyTypeId;
  /** Seconds after the previous spawn (0 for the first). */
  delay: number;
}

export interface WavePlan {
  wave: number;
  spawns: SpawnEntry[];
  /** Applied to every enemy's base health in this wave. */
  hpMultiplier: number;
}

export function planWave(wave: number, cfg: WaveBalance): WavePlan {
  const n = wave - 1;
  const count = cfg.baseCount + Math.floor(n * cfg.countPerWave);
  const interval = Math.max(cfg.spawnIntervalMin, cfg.spawnIntervalStart * cfg.spawnIntervalDecay ** n);
  const spawns: SpawnEntry[] = [];
  for (let i = 0; i < count; i++) spawns.push({ enemy: 'basic', delay: i === 0 ? 0 : interval });
  return { wave, spawns, hpMultiplier: cfg.hpGrowthPerWave ** n };
}

export function waveClearBonus(wave: number, cfg: WaveBalance): number {
  return cfg.clearBonusBase + cfg.clearBonusPerWave * (wave - 1);
}
