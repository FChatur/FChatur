export interface TileCoord {
  col: number;
  row: number;
}

export interface GridConfig {
  cols: number;
  rows: number;
  /** Size of one tile in world pixels. All world-space maths derives from this. */
  tileSize: number;
}

export const GRID: GridConfig = {
  cols: 20,
  rows: 12,
  tileSize: 48,
};

/**
 * The enemy route, as tile-centre waypoints. Consecutive waypoints must share a row or a column.
 * The first and last points sit just outside the grid so enemies walk in and out of view.
 */
export const PATH_WAYPOINTS: readonly TileCoord[] = [
  { col: -1, row: 2 },
  { col: 4, row: 2 },
  { col: 4, row: 8 },
  { col: 9, row: 8 },
  { col: 9, row: 3 },
  { col: 14, row: 3 },
  { col: 14, row: 9 },
  { col: 20, row: 9 },
];
