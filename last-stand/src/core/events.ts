import type { GameSpeed } from '../config/balance';
import type { TowerTypeId } from '../config/towers';
import type { Enemy, Projectile, Tower } from './types';

export interface GameEvents {
  // Simulation events
  enemyKilled: { enemy: Enemy };
  enemyLeaked: { enemy: Enemy };
  towerPlaced: { tower: Tower };
  towerUpgraded: { tower: Tower; cost: number };
  towerSold: { tower: Tower; refund: number };
  towerFired: { tower: Tower; projectile: Projectile };
  projectileHit: { projectile: Projectile; enemy: Enemy };
  waveStarted: { wave: number; enemyCount: number };
  waveCleared: { wave: number; bonus: number };
  gameOver: { wave: number };
  // Session events
  /** Either a tower type to build is armed, or a built tower is selected, or neither. */
  selectionChanged: { towerType: TowerTypeId | null; towerId: number | null };
  speedChanged: { speed: GameSpeed };
  sessionReset: Record<string, never>;
}
