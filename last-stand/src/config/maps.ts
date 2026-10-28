import { TILE_SIZE, type GridConfig, type TileCoord } from './map';

export type MapId = 'switchback';

/**
 * Per-map difficulty tuning, layered on top of the global balance in balance.ts / enemies.ts.
 * 1 means "no change". Use these to balance a map individually without touching global values.
 */
export interface MapModifiers {
  /** Multiplies every enemy's health. */
  enemyHp: number;
  /** Multiplies every enemy's movement speed. */
  enemySpeed: number;
  /** Multiplies the number of regular enemies per wave. */
  enemyCount: number;
  /** Multiplies kill rewards and wave-clear bonuses. */
  goldIncome: number;
  /** Multiplies starting gold. */
  startingGold: number;
}

export interface MapConfig {
  id: MapId;
  name: string;
  description: string;
  grid: GridConfig;
  /**
   * The enemy route, as tile-centre waypoints. Consecutive waypoints must share a row or a column.
   * The first and last points should sit just outside the grid so enemies walk in and out of view.
   */
  waypoints: readonly TileCoord[];
  modifiers: MapModifiers;
}

export const NEUTRAL_MODIFIERS: MapModifiers = {
  enemyHp: 1,
  enemySpeed: 1,
  enemyCount: 1,
  goldIncome: 1,
  startingGold: 1,
};

export const MAPS: Record<MapId, MapConfig> = {
  switchback: {
    id: 'switchback',
    name: 'Switchback',
    description: 'The baseline map: one long winding road with plenty of corners to build around.',
    grid: { cols: 20, rows: 12, tileSize: TILE_SIZE },
    waypoints: [
      { col: -1, row: 2 },
      { col: 4, row: 2 },
      { col: 4, row: 8 },
      { col: 9, row: 8 },
      { col: 9, row: 3 },
      { col: 14, row: 3 },
      { col: 14, row: 9 },
      { col: 20, row: 9 },
    ],
    // Baseline map: global balance is tuned against it, so it applies no modifiers of its own.
    modifiers: { ...NEUTRAL_MODIFIERS },
  },
};

export const DEFAULT_MAP: MapConfig = MAPS.switchback;
