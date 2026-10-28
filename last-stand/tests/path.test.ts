import { describe, expect, it } from 'vitest';
import { GRID, PATH_WAYPOINTS } from '../src/config/map';
import { Path } from '../src/core/Path';

describe('Path', () => {
  const path = Path.fromWaypoints(PATH_WAYPOINTS, GRID);

  it('measures total length as the sum of segment lengths', () => {
    let tiles = 0;
    for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
      const a = PATH_WAYPOINTS[i - 1];
      const b = PATH_WAYPOINTS[i];
      tiles += Math.abs(b.col - a.col) + Math.abs(b.row - a.row);
    }
    expect(path.length).toBeCloseTo(tiles * GRID.tileSize);
  });

  it('interpolates positions and clamps to the ends', () => {
    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    expect(path.positionAt(-10)).toEqual(start);
    expect(path.positionAt(path.length + 10)).toEqual(end);
    // Halfway along the first (horizontal) segment.
    const firstLen = path.points[1].x - start.x;
    const mid = path.positionAt(firstLen / 2);
    expect(mid.x).toBeCloseTo(start.x + firstLen / 2);
    expect(mid.y).toBeCloseTo(start.y);
  });

  it('marks only in-bounds tiles along the route', () => {
    expect(path.isPathTile(0, 2)).toBe(true);
    expect(path.isPathTile(4, 5)).toBe(true);
    expect(path.isPathTile(-1, 2)).toBe(false);
    expect(path.isPathTile(0, 0)).toBe(false);
    for (const key of path.tileKeys) {
      const [col, row] = key.split(',').map(Number);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(GRID.cols);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(GRID.rows);
    }
  });

  it('rejects diagonal segments', () => {
    expect(() =>
      Path.fromWaypoints(
        [
          { col: 0, row: 0 },
          { col: 2, row: 2 },
        ],
        GRID,
      ),
    ).toThrow(/diagonal/);
  });
});
