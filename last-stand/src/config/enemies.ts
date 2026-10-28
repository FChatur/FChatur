export type EnemyTypeId = 'basic';

export interface EnemyConfig {
  id: EnemyTypeId;
  name: string;
  /** Health at wave 1; later waves multiply this (see BALANCE.waves.hpGrowthPerWave). */
  maxHp: number;
  /** Movement speed in tiles per second. */
  speedTiles: number;
  /** Gold awarded on kill. */
  reward: number;
  /** Health the player loses if this enemy reaches the exit. */
  leakDamage: number;
  /** Visual and hit radius in pixels. */
  radius: number;
  color: number;
}

export const ENEMIES: Record<EnemyTypeId, EnemyConfig> = {
  basic: {
    id: 'basic',
    name: 'Grunt',
    maxHp: 30,
    speedTiles: 1.5,
    reward: 4,
    leakDamage: 1,
    radius: 11,
    color: 0xff6b6b,
  },
};
