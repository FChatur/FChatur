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

/** World pixels per tile, shared by every map so tower ranges and enemy speeds mean the same thing everywhere. */
export const TILE_SIZE = 48;
