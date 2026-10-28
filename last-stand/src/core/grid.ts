import type { GridConfig, TileCoord } from '../config/map';

export const tileKey = (col: number, row: number): string => `${col},${row}`;

export function tileCenter(col: number, row: number, tileSize: number): { x: number; y: number } {
  return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
}

export function worldToTile(x: number, y: number, tileSize: number): TileCoord {
  return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) };
}

export function inBounds(col: number, row: number, grid: GridConfig): boolean {
  return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
}
