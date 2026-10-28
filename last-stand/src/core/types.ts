import type { EnemyTypeId } from '../config/enemies';
import type { TowerTypeId } from '../config/towers';

export type Phase = 'build' | 'wave' | 'gameover';

export interface Enemy {
  id: number;
  type: EnemyTypeId;
  hp: number;
  maxHp: number;
  /** Pixels per second. */
  speed: number;
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
  damage: number;
  /** Seconds between shots. */
  fireInterval: number;
  /** Pixels. */
  range: number;
  projectileSpeed: number;
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
  alive: boolean;
}

export type PlacementBlock = 'out-of-bounds' | 'path' | 'occupied' | 'insufficient-gold' | 'game-over';

export type PlacementCheck = { ok: true } | { ok: false; reason: PlacementBlock };

export interface RunStats {
  kills: number;
  leaks: number;
  towersBuilt: number;
  goldEarned: number;
}
