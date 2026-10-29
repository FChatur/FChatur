import type { EnemyTypeId } from '../config/enemies';
import type { TargetingMode, TowerTypeId } from '../config/towers';

/** 'draft' = a wave was just cleared and the player must pick a run upgrade before the next one. */
export type Phase = 'build' | 'wave' | 'draft' | 'gameover';

export interface Enemy {
  id: number;
  type: EnemyTypeId;
  hp: number;
  maxHp: number;
  /** Base movement speed in pixels per second, before slows. */
  speed: number;
  armor: number;
  /** Expected damage (after armor) from projectiles already flying at this enemy. */
  incomingDamage: number;
  /** Current speed multiplier from slows (1 = unslowed). */
  slowFactor: number;
  /** Seconds until the current slow wears off. */
  slowTimer: number;
  reward: number;
  leakDamage: number;
  radius: number;
  /** Distance travelled along the path, in pixels. */
  distance: number;
  x: number;
  y: number;
  /** Position at the start of the current step, for render interpolation. */
  prevX: number;
  prevY: number;
  alive: boolean;
}

export interface Tower {
  id: number;
  type: TowerTypeId;
  col: number;
  row: number;
  x: number;
  y: number;
  /** 1-based upgrade level. */
  level: number;
  /** Total gold spent on this tower (build + upgrades); the basis for its sell refund. */
  invested: number;
  /** The run's free starter tower: it sells for nothing, whatever was spent upgrading it. */
  free: boolean;
  targeting: TargetingMode;
  damage: number;
  /** Seconds between shots. */
  fireInterval: number;
  /** Pixels. */
  range: number;
  projectileSpeed: number;
  slowFactor: number;
  slowDuration: number;
  /** Seconds until the tower may fire again. */
  cooldown: number;
  /** Radians; the direction the barrel points. */
  angle: number;
}

export interface Projectile {
  id: number;
  towerType: TowerTypeId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Homing target; null once the target is gone, after which it flies to (tx, ty) and fizzles. */
  target: Enemy | null;
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  /** 1 means the projectile doesn't slow. */
  slowFactor: number;
  slowDuration: number;
  alive: boolean;
}

export type PlacementBlock = 'out-of-bounds' | 'path' | 'occupied' | 'insufficient-gold' | 'game-over';

export type PlacementCheck = { ok: true } | { ok: false; reason: PlacementBlock };

export type UpgradeBlock = 'max-level' | 'insufficient-gold' | 'game-over';

export type UpgradeCheck = { ok: true; cost: number } | { ok: false; reason: UpgradeBlock };

export interface RunStats {
  kills: number;
  leaks: number;
  towersBuilt: number;
  towersSold: number;
  goldEarned: number;
}
