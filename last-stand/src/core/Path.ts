import type { GridConfig, TileCoord } from '../config/map';
import { inBounds, tileCenter, tileKey } from './grid';

export interface Point {
  x: number;
  y: number;
}

/** The enemy route as a world-space polyline, plus the set of grid tiles it occupies. */
export class Path {
  /** Cumulative distance from the start to each point. */
  private readonly cumulative: number[];
  readonly length: number;

  private constructor(
    readonly points: readonly Point[],
    private readonly tiles: ReadonlySet<string>,
  ) {
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  static fromWaypoints(waypoints: readonly TileCoord[], grid: GridConfig): Path {
    if (waypoints.length < 2) throw new Error('A path needs at least two waypoints.');
    const tiles = new Set<string>();
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1];
      const b = waypoints[i];
      if (a.col !== b.col && a.row !== b.row) {
        throw new Error(`Path segment ${i} is diagonal; waypoints must share a row or column.`);
      }
      const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
      const dc = Math.sign(b.col - a.col);
      const dr = Math.sign(b.row - a.row);
      for (let s = 0; s <= steps; s++) {
        const col = a.col + dc * s;
        const row = a.row + dr * s;
        if (inBounds(col, row, grid)) tiles.add(tileKey(col, row));
      }
    }
    const points = waypoints.map((w) => tileCenter(w.col, w.row, grid.tileSize));
    return new Path(points, tiles);
  }

  isPathTile(col: number, row: number): boolean {
    return this.tiles.has(tileKey(col, row));
  }

  get tileKeys(): ReadonlySet<string> {
    return this.tiles;
  }

  /** World position at `distance` along the path, clamped to its ends. */
  positionAt(distance: number): Point {
    if (distance <= 0) return { ...this.points[0] };
    if (distance >= this.length) return { ...this.points[this.points.length - 1] };
    let i = 1;
    while (this.cumulative[i] < distance) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const t = (distance - this.cumulative[i - 1]) / (this.cumulative[i] - this.cumulative[i - 1]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
}
