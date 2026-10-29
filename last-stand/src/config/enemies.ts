export type EnemyTypeId = 'basic' | 'runner' | 'armored' | 'boss';

/** Silhouette used by the renderer, so enemy types are distinguishable at a glance. */
export type EnemyShape = 'square' | 'diamond' | 'octagon' | 'boss';

export interface EnemyConfig {
  id: EnemyTypeId;
  name: string;
  /** Health at wave 1; later waves multiply this (see BALANCE.waves.hpGrowthPerWave). */
  maxHp: number;
  /** Movement speed in tiles per second. */
  speedTiles: number;
  /** Flat damage removed from every hit (see BALANCE.armorMinDamageFraction). */
  armor: number;
  /** Gold awarded on kill. */
  reward: number;
  /** Health the player loses if this enemy reaches the exit. */
  leakDamage: number;
  /** Visual and hit radius in pixels. */
  radius: number;
  shape: EnemyShape;
  color: number;
}

export const ENEMIES: Record<EnemyTypeId, EnemyConfig> = {
  basic: {
    id: 'basic',
    name: 'Goblin',
    maxHp: 30,
    speedTiles: 1.5,
    armor: 0,
    reward: 4,
    leakDamage: 1,
    radius: 11,
    shape: 'square',
    color: 0xff6b6b,
  },
  runner: {
    id: 'runner',
    name: 'Wolf',
    maxHp: 16,
    speedTiles: 2.6,
    armor: 0,
    reward: 3,
    leakDamage: 1,
    radius: 9,
    shape: 'diamond',
    color: 0xfacc15,
  },
  armored: {
    id: 'armored',
    name: 'Armored Orc',
    maxHp: 70,
    speedTiles: 1.0,
    armor: 4,
    reward: 8,
    leakDamage: 2,
    radius: 13,
    shape: 'octagon',
    color: 0x94a3b8,
  },
  boss: {
    id: 'boss',
    name: 'Ogre Warlord',
    maxHp: 500,
    speedTiles: 0.75,
    armor: 6,
    reward: 60,
    leakDamage: 6,
    radius: 18,
    shape: 'boss',
    color: 0xe11d48,
  },
};
