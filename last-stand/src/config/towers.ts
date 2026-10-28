export type TowerTypeId = 'basic';

export interface TowerConfig {
  id: TowerTypeId;
  name: string;
  description: string;
  cost: number;
  damage: number;
  /** Shots per second. */
  fireRate: number;
  /** Attack radius measured in tiles from the tower's centre. */
  rangeTiles: number;
  /** Projectile travel speed in pixels per second. */
  projectileSpeed: number;
  color: number;
  /** Keyboard key that selects this tower in the build bar. */
  hotkey: string;
}

export const TOWERS: Record<TowerTypeId, TowerConfig> = {
  basic: {
    id: 'basic',
    name: 'Turret',
    description: 'Balanced damage and fire rate.',
    cost: 50,
    damage: 10,
    fireRate: 1.4,
    rangeTiles: 2.75,
    projectileSpeed: 520,
    color: 0x4fd1c5,
    hotkey: '1',
  },
};

/** Display order in the build bar. */
export const TOWER_ORDER: readonly TowerTypeId[] = ['basic'];
