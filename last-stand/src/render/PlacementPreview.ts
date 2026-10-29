import Phaser from 'phaser';
import { COLORS } from '../art/palette';
import { ART_TILE } from '../art/terrain';
import { TILE_SIZE, type TileCoord } from '../config/map';
import { TOWERS, type TowerTypeId } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { PlacementBlock, Tower } from '../core/types';
import { DEPTH, PALETTE } from './palette';
import { alphaBitmap, ART_SCALE, ATLAS_KEY, bitmapTexture, rangeTexture, textTexture } from './pixel';
import { frameKey, heroGhost } from '../art/atlas';

const BLOCK_LABEL: Partial<Record<PlacementBlock, string>> = {
  path: 'ROAD',
  occupied: 'OCCUPIED',
  'insufficient-gold': 'NOT ENOUGH GOLD',
};

/**
 * Board overlays. With a tower type armed (clicked or being dragged): a faint build grid, a ghost of the
 * tower on the target tile, the tile outline and the tower's range, green when it can be built there and
 * red with the reason when not. A selected built tower shows its range and an outline. With nothing
 * armed, hovering a tower shows its range.
 */
export class PlacementPreview {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly range: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Image;
  private readonly grid: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene, sim: Simulation) {
    this.g = scene.add.graphics().setDepth(DEPTH.preview);
    this.grid = scene.add.image(0, 0, gridTexture(scene, sim)).setOrigin(0, 0).setScale(ART_SCALE).setDepth(DEPTH.grid).setVisible(false);
    this.range = scene.add.image(0, 0, rangeTexture(scene, 8)).setScale(ART_SCALE).setDepth(DEPTH.preview - 1).setVisible(false);
    this.ghost = scene.add.image(0, 0, ATLAS_KEY, frameKey(heroGhost('basic'), 0)).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(DEPTH.preview).setVisible(false);
    this.label = scene.add.image(0, 0, textTexture(scene, 'ROAD', COLORS.white0)).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(DEPTH.preview + 1).setVisible(false);
  }

  update(sim: Simulation, hover: TileCoord | null, selected: TowerTypeId | null, picked: Tower | null): void {
    this.g.clear();
    this.ghost.setVisible(false);
    this.range.setVisible(false);
    this.label.setVisible(false);
    this.grid.setVisible(!!selected && sim.phase !== 'gameover');
    if (sim.phase === 'gameover') return;

    const ts = TILE_SIZE;
    if (picked) {
      this.showRange(sim, picked.x, picked.y, picked.range, PALETTE.range);
      this.outline(picked.col, picked.row, COLORS.gold4, 0);
    }
    if (!hover) return;

    if (selected) {
      const check = sim.canPlaceTower(selected, hover.col, hover.row);
      if (!check.ok && check.reason === 'out-of-bounds') return;
      const color = check.ok ? PALETTE.valid : PALETTE.invalid;
      const cx = (hover.col + 0.5) * ts;
      this.showRange(sim, cx, (hover.row + 0.5) * ts, TOWERS[selected].levels[0].rangeTiles * ts, color);
      this.outline(hover.col, hover.row, color, 0.22);
      this.ghost
        .setFrame(frameKey(heroGhost(selected), 0))
        .setPosition(cx, (hover.row + 1) * ts)
        .setAlpha(check.ok ? 0.8 : 0.55)
        .setVisible(true);
      if (check.ok) this.ghost.clearTint();
      else this.ghost.setTint(0xff8a80);
      const text = check.ok ? null : BLOCK_LABEL[check.reason];
      if (text) {
        this.label
          .setTexture(textTexture(this.scene, text, COLORS.white0))
          .setPosition(cx, hover.row * ts - this.ghost.height * ART_SCALE + ts - 2 * ART_SCALE)
          .setVisible(true);
      }
      return;
    }

    const tower = sim.towerAt(hover.col, hover.row);
    if (tower && tower !== picked) this.showRange(sim, tower.x, tower.y, tower.range, PALETTE.range);
  }

  /** A one-art-pixel tile outline with an optional translucent fill. */
  private outline(col: number, row: number, color: number, fill: number): void {
    const ts = TILE_SIZE;
    if (fill > 0) this.g.fillStyle(color, fill).fillRect(col * ts, row * ts, ts, ts);
    this.g.lineStyle(ART_SCALE, color, 0.95).strokeRect(col * ts + ART_SCALE / 2, row * ts + ART_SCALE / 2, ts - ART_SCALE, ts - ART_SCALE);
  }

  private showRange(sim: Simulation, x: number, y: number, radius: number, color: number): void {
    if (!Number.isFinite(radius)) {
      // Global range: frame the whole map instead of a circle.
      const w = sim.map.grid.cols * TILE_SIZE;
      const h = sim.map.grid.rows * TILE_SIZE;
      this.g.fillStyle(color, 0.06).fillRect(0, 0, w, h);
      this.g.lineStyle(ART_SCALE, color, 0.7).strokeRect(ART_SCALE / 2, ART_SCALE / 2, w - ART_SCALE, h - ART_SCALE);
      return;
    }
    this.range
      .setTexture(rangeTexture(this.scene, radius / ART_SCALE))
      .setPosition(Math.round(x / ART_SCALE) * ART_SCALE + ART_SCALE / 2, Math.round(y / ART_SCALE) * ART_SCALE + ART_SCALE / 2)
      .setTint(color)
      .setVisible(true);
  }
}

/** Faint lines between buildable tiles, shown while placing so tiles are easy to aim at. */
function gridTexture(scene: Phaser.Scene, sim: Simulation): string {
  const { cols, rows } = sim.map.grid;
  return bitmapTexture(scene, `grid:${sim.map.id}`, () =>
    alphaBitmap(cols * ART_TILE, rows * ART_TILE, 0xffffff, (x, y) => {
      const col = Math.floor(x / ART_TILE);
      const row = Math.floor(y / ART_TILE);
      if (sim.path.isPathTile(col, row)) return 0;
      const edge = x % ART_TILE === 0 || y % ART_TILE === 0;
      return edge ? 34 : 0;
    }),
  );
}
