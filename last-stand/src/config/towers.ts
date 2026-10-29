export type TowerTypeId = 'basic' | 'sniper' | 'rapid' | 'frost';

/** How a tower picks between enemies in range. Each built tower has its own, changeable by the player. */
export type TargetingMode = 'first' | 'last' | 'strongest' | 'fastest';

/** Display order of the targeting buttons. */
export const TARGETING_MODES: readonly TargetingMode[] = ['first', 'last', 'strongest', 'fastest'];

export const TARGETING: Record<TargetingMode, { label: string; description: string }> = {
  first: { label: 'First', description: 'Shoots the enemy closest to the exit.' },
  last: { label: 'Last', description: 'Shoots the enemy furthest from the exit (the newest arrival).' },
  strongest: { label: 'Strongest', description: 'Shoots the enemy with the most health left.' },
  fastest: { label: 'Fastest', description: 'Shoots the fastest-moving enemy, counting slows.' },
};

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
  /** Attack radius measured in tiles from the tower's centre, or GLOBAL_RANGE for the whole map. */
  rangeTiles: number;
  /** Projectile travel speed in pixels per second. */
  projectileSpeed: number;
  slow?: SlowEffect;
}

export interface TowerConfig {
  id: TowerTypeId;
  name: string;
  /** Short role line for tooltips, e.g. "All-rounder · Single target". */
  role: string;
  /** One or two sentences on what the tower is for. Mechanics are explained automatically from stats. */
  description: string;
  /** Gold to build (level 1). */
  cost: number;
  /** Targeting mode a newly built tower starts with. */
  targeting: TargetingMode;
  /** Level 1, 2 and 3 stats, in order. */
  levels: readonly TowerLevel[];
  color: number;
  /** Keyboard key that selects this tower in the build bar. */
  hotkey: string;
}

export const MAX_TOWER_LEVEL = 3;

/** Range value meaning "anywhere on the map" (e.g. the Sniper). */
export const GLOBAL_RANGE = Number.POSITIVE_INFINITY;

export function isGlobalRange(rangeTiles: number): boolean {
  return rangeTiles === GLOBAL_RANGE;
}

export const TOWERS: Record<TowerTypeId, TowerConfig> = {
  basic: {
    id: 'basic',
    name: 'Archer Tower',
    role: 'All-rounder · Single target',
    description: 'Reliable, affordable archers. A solid backbone for any defence, and steady against armor.',
    cost: 50,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 10, fireRate: 1.4, rangeTiles: 2.75, projectileSpeed: 520 },
      { upgradeCost: 45, damage: 16, fireRate: 1.6, rangeTiles: 3.0, projectileSpeed: 560 },
      { upgradeCost: 80, damage: 26, fireRate: 1.8, rangeTiles: 3.25, projectileSpeed: 600 },
    ],
    color: 0xde5d4f,
    hotkey: '1',
  },
  sniper: {
    id: 'sniper',
    name: 'Ballista Tower',
    role: 'Global range · Heavy hits',
    description: 'Heavy bolts that reach anywhere on the map. Expensive: an investment that pays off in later waves.',
    cost: 110,
    targeting: 'strongest',
    // Priced for global range: it covers the whole path from anywhere, so it costs more than its
    // raw damage alone would suggest.
    levels: [
      // Global range at every level; shots are fast so cross-map hits land before the target moves on.
      { upgradeCost: 0, damage: 45, fireRate: 0.45, rangeTiles: GLOBAL_RANGE, projectileSpeed: 2400 },
      { upgradeCost: 100, damage: 80, fireRate: 0.5, rangeTiles: GLOBAL_RANGE, projectileSpeed: 2600 },
      { upgradeCost: 170, damage: 140, fireRate: 0.55, rangeTiles: GLOBAL_RANGE, projectileSpeed: 2800 },
    ],
    color: 0x9a62c2,
    hotkey: '2',
  },
  rapid: {
    id: 'rapid',
    name: 'Ranger Tower',
    role: 'Short range · Rapid fire',
    description: 'Rangers loose a stream of quick arrows that shred fast, lightly armored enemies.',
    cost: 70,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 5, fireRate: 5, rangeTiles: 2.5, projectileSpeed: 650 },
      { upgradeCost: 60, damage: 7, fireRate: 6, rangeTiles: 2.75, projectileSpeed: 700 },
      { upgradeCost: 100, damage: 10, fireRate: 7.5, rangeTiles: 3.0, projectileSpeed: 750 },
    ],
    color: 0x68a05c,
    hotkey: '3',
  },
  frost: {
    id: 'frost',
    name: 'Frost Mage Tower',
    role: 'Support · Crowd control',
    description: 'Ice magic slows enemies so the rest of your defence gets more time to hit them.',
    cost: 60,
    targeting: 'first',
    levels: [
      { upgradeCost: 0, damage: 3, fireRate: 1.0, rangeTiles: 2.5, projectileSpeed: 480, slow: { factor: 0.6, duration: 1.5 } },
      { upgradeCost: 50, damage: 5, fireRate: 1.1, rangeTiles: 2.75, projectileSpeed: 500, slow: { factor: 0.5, duration: 1.75 } },
      { upgradeCost: 90, damage: 8, fireRate: 1.25, rangeTiles: 3.0, projectileSpeed: 520, slow: { factor: 0.4, duration: 2.0 } },
    ],
    color: 0x6cbcf0,
    hotkey: '4',
  },
};

/** Display order in the build bar. */
export const TOWER_ORDER: readonly TowerTypeId[] = ['basic', 'sniper', 'rapid', 'frost'];
