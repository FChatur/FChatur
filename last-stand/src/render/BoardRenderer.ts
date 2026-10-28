import Phaser from 'phaser';
import type { GridConfig } from '../config/map';
import type { Path } from '../core/Path';
import { bakedImage, bakeTexture } from './bake';
import { DEPTH, PALETTE } from './palette';

export interface BoardView {
  destroy(): void;
}

/**
 * Draws the static battlefield: grid, path, spawn and exit markers. The static parts are baked into
 * one texture at the current zoom (see bake.ts); call again after the zoom changes.
 */
export function drawBoard(scene: Phaser.Scene, grid: GridConfig, path: Path): BoardView {
  const { cols, rows, tileSize: ts } = grid;
  const key = bakeTexture(scene, `board-${cols}x${rows}-${[...path.tileKeys].join(';')}`, cols * ts, rows * ts, (g) =>
    paintBoard(g, grid, path),
  );
  const board = bakedImage(scene, 0, 0, key).setOrigin(0, 0).setDepth(DEPTH.board);

  // Spawn gate (left edge) and exit gate (right edge) pulse, so they stay live shapes.
  const first = path.points[1];
  const last = path.points[path.points.length - 2];
  const gates = [...drawGate(scene, 3, first.y, ts, PALETTE.spawn), ...drawGate(scene, cols * ts - 3, last.y, ts, PALETTE.exit)];

  return {
    destroy() {
      for (const g of gates) {
        scene.tweens.killTweensOf(g);
        g.destroy();
      }
      board.destroy();
    },
  };
}

function paintBoard(g: Phaser.GameObjects.Graphics, grid: GridConfig, path: Path): void {
  const { cols, rows, tileSize: ts } = grid;
  g.fillStyle(PALETTE.background).fillRect(0, 0, cols * ts, rows * ts);

  // Buildable tiles: slightly raised cells with a hairline gap, for a pixel-board look.
  g.fillStyle(PALETTE.buildable);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!path.isPathTile(c, r)) g.fillRect(c * ts + 1, r * ts + 1, ts - 2, ts - 2);
    }
  }

  // Path tiles, then a darker edge and a centre guide line along the route.
  g.fillStyle(PALETTE.path);
  for (const key of path.tileKeys) {
    const [c, r] = key.split(',').map(Number);
    g.fillRect(c * ts, r * ts, ts, ts);
  }
  g.lineStyle(2, PALETTE.pathEdge, 1);
  for (const key of path.tileKeys) {
    const [c, r] = key.split(',').map(Number);
    if (!path.isPathTile(c, r - 1)) g.lineBetween(c * ts, r * ts, (c + 1) * ts, r * ts);
    if (!path.isPathTile(c, r + 1)) g.lineBetween(c * ts, (r + 1) * ts, (c + 1) * ts, (r + 1) * ts);
    if (!path.isPathTile(c - 1, r) && c > 0) g.lineBetween(c * ts, r * ts, c * ts, (r + 1) * ts);
    if (!path.isPathTile(c + 1, r) && c < cols - 1) g.lineBetween((c + 1) * ts, r * ts, (c + 1) * ts, (r + 1) * ts);
  }
  g.lineStyle(2, PALETTE.pathCenter, 0.6);
  g.strokePoints(path.points as Phaser.Types.Math.Vector2Like[], false);
}

function drawGate(scene: Phaser.Scene, x: number, y: number, ts: number, color: number): Phaser.GameObjects.Rectangle[] {
  const glow = scene.add.rectangle(x, y, 12, ts * 0.9, color, 0.35).setDepth(DEPTH.board);
  const bar = scene.add.rectangle(x, y, 5, ts * 0.9, color, 1).setDepth(DEPTH.board);
  scene.tweens.add({ targets: glow, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return [glow, bar];
}
