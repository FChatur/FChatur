export type TowerTypeId = 'basic' | 'sniper' | 'rapid' | 'frost';

/** How a tower picks between enemies in range. */
export type TargetingMode = 'first' | 'strongest';

export interface SlowEffect {
  /** Speed multiplier while slowed (0.6 = 40% slower). Lower is stronger. */
  factor: number;
  /** Seconds the slow lasts after each hit. */
  duration: number;
}

export interface TowerLevel {
  /** Gold to upgrade into this level. Ignored for level 1 (see TowerConfig.cost). */
  upgradeCost: number;
  damage: number;
  /** Shots per second. */
  fireRate: number;
  /** Attack radius measured in tiles from the tower's centre. */
  rangeTiles: number;
  /** Projectile travel speed in pixels per second. */
  projectileSpeed: number;
  slow?: SlowEffect;
}

export interface TowerConfig {
  id: TowerTypeId;
  name: string;
  description: string;
  /** Gold to build (level 1). */
  cost: number;
  targeting: TargetingMode;
  /** Level 1, 2 and 3 stats, in order. */
  levels: readonly TowerLevel[];
  color: number;
  /** Keyboard key that selects this tower in the build bar. */
  hotkey: string;
}

export const MAX_TOWER_LEVEL = 3;

export const TOWERS: Record<TowerTypeId, TowerConfig> = {
  basic: {
    id: 'basic',
    name: 'Turret',
    description: 'Balanced damage and fire rate.',
    cost: 50,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 10, fireRate: 1.4, rangeTiles: 2.75, projectileSpeed: 520 },
      { upgradeCost: 45, damage: 16, fireRate: 1.6, rangeTiles: 3.0, projectileSpeed: 560 },
      { upgradeCost: 80, damage: 26, fireRate: 1.8, rangeTiles: 3.25, projectileSpeed: 600 },
    ],
    color: 0x4fd1c5,
    hotkey: '1',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    description: 'Huge damage and range, slow to fire. Targets the toughest enemy in range.',
    cost: 90,
    targeting: 'strongest',
    levels: [
      { upgradeCost: 0, damage: 45, fireRate: 0.45, rangeTiles: 5.0, projectileSpeed: 1100 },
      { upgradeCost: 80, damage: 80, fireRate: 0.5, rangeTiles: 5.5, projectileSpeed: 1200 },
      { upgradeCost: 140, damage: 140, fireRate: 0.55, rangeTiles: 6.0, projectileSpeed: 1300 },
    ],
    color: 0xa78bfa,
    hotkey: '2',
  },
  rapid: {
    id: 'rapid',
    name: 'Rapid',
    description: 'Very fast, weak shots. Struggles against armor.',
    cost: 70,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 5, fireRate: 5, rangeTiles: 2.5, projectileSpeed: 650 },
      { upgradeCost: 60, damage: 7, fireRate: 6, rangeTiles: 2.75, projectileSpeed: 700 },
      { upgradeCost: 100, damage: 10, fireRate: 7.5, rangeTiles: 3.0, projectileSpeed: 750 },
    ],
    color: 0xfb923c,
    hotkey: '3',
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    description: 'Light damage. Slows enemies it hits.',
    cost: 60,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 3, fireRate: 1.0, rangeTiles: 2.5, projectileSpeed: 480, slow: { factor: 0.6, duration: 1.5 } },
      { upgradeCost: 50, damage: 5, fireRate: 1.1, rangeTiles: 2.75, projectileSpeed: 500, slow: { factor: 0.5, duration: 1.75 } },
      { upgradeCost: 90, damage: 8, fireRate: 1.25, rangeTiles: 3.0, projectileSpeed: 520, slow: { factor: 0.4, duration: 2.0 } },
    ],
    color: 0x7dd3fc,
    hotkey: '4',
  },
};

/** Display order in the build bar. */
export const TOWER_ORDER: readonly TowerTypeId[] = ['basic', 'sniper', 'rapid', 'frost'];
