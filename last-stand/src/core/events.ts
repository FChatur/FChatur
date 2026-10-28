import type { GameSpeed } from '../config/balance';
import type { TowerTypeId } from '../config/towers';
import type { UpgradeId } from '../config/upgrades';
import type { Enemy, Projectile, Tower } from './types';

export type Screen = 'menu' | 'playing';

export interface GameEvents {
  // Simulation events
  enemySpawned: { enemy: Enemy };
  enemyKilled: { enemy: Enemy };
  enemyLeaked: { enemy: Enemy };
  towerPlaced: { tower: Tower };
  towerUpgraded: { tower: Tower; cost: number };
  towerSold: { tower: Tower; refund: number };
  towerFired: { tower: Tower; projectile: Projectile };
  projectileHit: { projectile: Projectile; enemy: Enemy; crit: boolean };
  /** Chain Lightning jumped between two points. */
  chainArc: { fromX: number; fromY: number; toX: number; toY: number };
  /** Explosive Rounds splashed around a point (radius in pixels). */
  splash: { x: number; y: number; radius: number };
  waveStarted: { wave: number; enemyCount: number };
  waveCleared: { wave: number; bonus: number; interest: number };
  draftOffered: { choices: UpgradeId[] };
  /** Auto Wave countdown: whole seconds left, or null when no countdown is running. */
  countdownChanged: { seconds: number | null };
  upgradeChosen: { id: UpgradeId; rank: number };
  gameOver: { wave: number };
  // Session events
  /** Either a tower type to build is armed, or a built tower is selected, or neither. */
  selectionChanged: { towerType: TowerTypeId | null; towerId: number | null };
  speedChanged: { speed: GameSpeed };
  /** Main menu shown/hidden, or game paused/resumed. */
  screenChanged: { screen: Screen; paused: boolean };
  muteChanged: { muted: boolean };
  autoWaveChanged: { on: boolean };
  sessionReset: Record<string, never>;
}
