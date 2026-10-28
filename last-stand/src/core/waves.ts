import type { EnemyMix, WaveBalance } from '../config/balance';
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

type RegularEnemy = Exclude<EnemyTypeId, 'boss'>;

/** Share of a wave taken by an enemy type, 0 before it is introduced. */
export function mixShare(mix: EnemyMix, wave: number): number {
  if (wave < mix.fromWave) return 0;
  return Math.min(mix.maxShare, mix.startShare + mix.sharePerWave * (wave - mix.fromWave));
}

export function isBossWave(wave: number, cfg: WaveBalance): boolean {
  return wave % cfg.bossEvery === 0;
}

export function planWave(wave: number, cfg: WaveBalance): WavePlan {
  const n = wave - 1;
  const count = cfg.baseCount + Math.floor(n * cfg.countPerWave);
  const interval = Math.max(cfg.spawnIntervalMin, cfg.spawnIntervalStart * cfg.spawnIntervalDecay ** n);

  const runner = mixShare(cfg.runners, wave);
  const armored = mixShare(cfg.armored, wave);
  const shares: [RegularEnemy, number][] = [
    ['basic', 1 - runner - armored],
    ['runner', runner],
    ['armored', armored],
  ];

  // Error diffusion: each type accrues its share per slot and the most "owed" type spawns next.
  // Deterministic, and spreads each type evenly through the wave instead of clumping.
  const owed = new Map<RegularEnemy, number>(shares.map(([type]) => [type, 0]));
  const spawns: SpawnEntry[] = [];
  for (let i = 0; i < count; i++) {
    let pick: RegularEnemy = 'basic';
    let best = -Infinity;
    for (const [type, share] of shares) {
      const value = owed.get(type)! + share;
      owed.set(type, value);
      if (value > best) {
        best = value;
        pick = type;
      }
    }
    owed.set(pick, owed.get(pick)! - 1);
    spawns.push({ enemy: pick, delay: i === 0 ? 0 : interval });
  }

  if (isBossWave(wave, cfg)) spawns.push({ enemy: 'boss', delay: cfg.bossDelay });

  return { wave, spawns, hpMultiplier: cfg.hpGrowthPerWave ** n };
}

export function waveClearBonus(wave: number, cfg: WaveBalance): number {
  return cfg.clearBonusBase + cfg.clearBonusPerWave * (wave - 1);
}
