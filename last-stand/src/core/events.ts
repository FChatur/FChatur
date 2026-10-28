import type { TowerTypeId } from '../config/towers';
import type { Enemy, Projectile, Tower } from './types';

export interface GameEvents {
  // Simulation events
  enemyKilled: { enemy: Enemy };
  enemyLeaked: { enemy: Enemy };
  towerPlaced: { tower: Tower };
  towerFired: { tower: Tower; projectile: Projectile };
  projectileHit: { projectile: Projectile; enemy: Enemy };
  waveStarted: { wave: number; enemyCount: number };
  waveCleared: { wave: number; bonus: number };
  gameOver: { wave: number };
  // Session events
  selectionChanged: { towerType: TowerTypeId | null };
  sessionReset: Record<string, never>;
}
