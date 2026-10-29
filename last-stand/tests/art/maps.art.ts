/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { blank, blit, get, set, type Bitmap } from '../../src/art/bitmap';
import { hash2, valueNoise } from '../../src/art/noise';
import { COLORS } from '../../src/art/palette';
import { rock } from '../../src/art/sprites/props';
import { ART_TILE, paintTerrain } from '../../src/art/terrain';
import { TILE_SIZE } from '../../src/config/map';
import { Path } from '../../src/core/Path';
import { CANDIDATES, type CandidateMap } from './candidateMaps';
import { encodePng } from './png';

// `npm run art`: candidate map previews for issue #4 (art preview and a tactical coverage diagram).

const GRID = { cols: 20, rows: 12, tileSize: TILE_SIZE };

function preview(m: CandidateMap): Bitmap {
  const path = Path.fromWaypoints(m.waypoints, GRID);
  const k = TILE_SIZE / ART_TILE;
  const t = paintTerrain({ cols: GRID.cols, rows: GRID.rows, margin: 2, road: path.points.map((p) => ({ x: p.x / k, y: p.y / k })), seed: m.seed });
  const img = t.image;
  const blocked = new Map(m.blocked.map((b) => [`${b.col},${b.row}`, b.kind]));
  const is = (c: number, r: number, kind: string) => blocked.get(`${c},${r}`) === kind;
  /** Pixels from (x, y) inside tile (c, r) to the nearest edge shared with a tile of another kind. */
  const shoreDist = (c: number, r: number, x: number, y: number, kind: string) => {
    let d = 99;
    if (!is(c - 1, r, kind)) d = Math.min(d, x);
    if (!is(c + 1, r, kind)) d = Math.min(d, ART_TILE - 1 - x);
    if (!is(c, r - 1, kind)) d = Math.min(d, y);
    if (!is(c, r + 1, kind)) d = Math.min(d, ART_TILE - 1 - y);
    return d;
  };
  for (const b of m.blocked) {
    const x0 = t.originX + b.col * ART_TILE;
    const y0 = t.originY + b.row * ART_TILE;
    for (let y = 0; y < ART_TILE; y++) {
      for (let x = 0; x < ART_TILE; x++) {
        const gx = x0 + x;
        const gy = y0 + y;
        const n = hash2(gx, gy, m.seed);
        let c: number;
        if (b.kind === 'water') {
          // Sandy shore, shallow band, then deep water with sparse ripples.
          const d = shoreDist(b.col, b.row, x, y, 'water') + (n > 0.7 ? 1 : 0);
          c = d < 2 ? (n > 0.5 ? COLORS.dirt3 : COLORS.dirt4) : d < 5 ? COLORS.water2 : d < 12 ? COLORS.water1 : COLORS.water0;
          if (d >= 5 && (gx * 3 + gy * 7) % 23 === 0 && n > 0.55) c = COLORS.water3;
        } else {
          // A raised rocky outcrop: mottled stone top with grass, a lit lip, a dark face at the bottom.
          const below = !is(b.col, b.row + 1, 'cliff');
          const above = !is(b.col, b.row - 1, 'cliff');
          const v = valueNoise(gx, gy, 5, m.seed + 9);
          c = v < 0.35 ? COLORS.stone1 : v > 0.68 ? COLORS.stone3 : COLORS.stone2;
          if (n > 0.93) c = COLORS.grass3;
          if (above && y === 0) c = COLORS.stone4;
          if (below && y >= 12) c = y === 12 ? COLORS.stone1 : (gx % 4 === 0 ? COLORS.ink1 : COLORS.stone0);
          if (!is(b.col - 1, b.row, 'cliff') && x === 0) c = COLORS.stone1;
          if (!is(b.col + 1, b.row, 'cliff') && x === ART_TILE - 1) c = COLORS.stone0;
        }
        set(img, gx, gy, c);
      }
    }
    const h = hash2(b.col, b.row, m.seed + 3);
    if (b.kind === 'cliff' && h > 0.72) blit(img, rock(b.col * 7 + b.row, h > 0.9 ? 'large' : 'small'), x0 + Math.floor(h * 6), y0 + 2);
    if (b.kind === 'water' && h > 0.9) {
      // A lily pad.
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, -1]]) set(img, x0 + 7 + dx, y0 + 7 + dy, COLORS.grass3);
    }
  }
  // Crop to the map plus one tile of scenery on each side.
  const out = blank((GRID.cols + 2) * ART_TILE, (GRID.rows + 2) * ART_TILE);
  return blit(out, img, -(t.originX - ART_TILE), -(t.originY - ART_TILE));
}

/** Path tiles within an Archer's range (2.75 tiles) of each buildable tile: where towers earn the most. */
function tactical(m: CandidateMap): Bitmap {
  const path = Path.fromWaypoints(m.waypoints, GRID);
  const S = 8;
  const img = blank(GRID.cols * S, GRID.rows * S);
  const blocked = new Set(m.blocked.map((b) => `${b.col},${b.row}`));
  const pathTiles = [...path.tileKeys].map((k) => k.split(',').map(Number));
  const heat = [COLORS.grass1, COLORS.grass2, COLORS.grass3, COLORS.grass4, COLORS.gold3, COLORS.gold4];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      let color: number;
      if (path.isPathTile(c, r)) color = COLORS.dirt3;
      else if (blocked.has(`${c},${r}`)) color = m.blocked.find((b) => b.col === c && b.row === r)!.kind === 'water' ? COLORS.water1 : COLORS.stone1;
      else {
        const n = pathTiles.filter(([pc, pr]) => Math.hypot(pc - c, pr - r) <= 2.75).length;
        color = n >= 16 ? heat[5] : n >= 12 ? heat[4] : n >= 8 ? heat[3] : n >= 4 ? heat[2] : n >= 1 ? heat[1] : heat[0];
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(img, c * S + x, r * S + y, x === 0 || y === 0 ? COLORS.ink1 : color);
    }
  }
  void get;
  return img;
}

it('candidate map previews', () => {
  const out = process.env.ART_OUT ?? 'art-preview';
  mkdirSync(out, { recursive: true });
  for (const m of CANDIDATES) {
    const p = preview(m);
    writeFileSync(`${out}/map-${m.id}.png`, encodePng(p, 3));
    writeFileSync(`${out}/map-${m.id}-thumb.png`, encodePng(p, 1));
    writeFileSync(`${out}/map-${m.id}-tactical.png`, encodePng(tactical(m), 3));
    const path = Path.fromWaypoints(m.waypoints, GRID);
    const buildable = GRID.cols * GRID.rows - path.tileKeys.size - m.blocked.length;
    process.stdout.write(`${m.name}: path ${path.tileKeys.size} tiles, buildable ${buildable}\n`);
  }
});
