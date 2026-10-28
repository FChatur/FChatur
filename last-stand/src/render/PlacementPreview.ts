import Phaser from 'phaser';
import { TILE_SIZE, type TileCoord } from '../config/map';
import { TOWERS, type TowerTypeId } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { PlacementBlock, Tower } from '../core/types';
import { DEPTH, FONT_FAMILY, PALETTE, textResolution } from './palette';

const BLOCK_LABEL: Partial<Record<PlacementBlock, string>> = {
  path: 'Path',
  occupied: 'Occupied',
  'insufficient-gold': 'Not enough gold',
};

/**
 * Board overlays: with a tower type armed, shows the target tile (green/red) and the new tower's
 * range. A selected built tower shows its range and a highlight. With nothing armed, hovering a
 * tower shows its range.
 */
export class PlacementPreview {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.preview);
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.preview)
      .setVisible(false);
  }

  update(sim: Simulation, hover: TileCoord | null, selected: TowerTypeId | null, picked: Tower | null): void {
    this.g.clear();
    this.label.setVisible(false);
    const resolution = textResolution(this.scene);
    if (this.label.style.resolution !== resolution) this.label.setResolution(resolution);
    if (sim.phase === 'gameover') return;

    const ts = TILE_SIZE;
    if (picked) {
      this.drawRange(sim, picked.x, picked.y, picked.range, PALETTE.range);
      this.g.lineStyle(2, PALETTE.range, 0.9).strokeRect(picked.col * ts + 2, picked.row * ts + 2, ts - 4, ts - 4);
    }
    if (!hover) return;

    const cx = (hover.col + 0.5) * ts;
    const cy = (hover.row + 0.5) * ts;

    if (selected) {
      const check = sim.canPlaceTower(selected, hover.col, hover.row);
      if (!check.ok && check.reason === 'out-of-bounds') return;
      const color = check.ok ? PALETTE.valid : PALETTE.invalid;
      this.drawRange(sim, cx, cy, TOWERS[selected].levels[0].rangeTiles * ts, color);
      this.g.fillStyle(color, 0.28).fillRect(hover.col * ts, hover.row * ts, ts, ts);
      this.g.lineStyle(2, color, 0.9).strokeRect(hover.col * ts + 1, hover.row * ts + 1, ts - 2, ts - 2);
      const text = check.ok ? null : BLOCK_LABEL[check.reason];
      if (text) {
        this.label.setText(text).setPosition(cx, hover.row * ts - 4).setVisible(true);
      }
      return;
    }

    const tower = sim.towerAt(hover.col, hover.row);
    if (tower && tower !== picked) this.drawRange(sim, tower.x, tower.y, tower.range, PALETTE.range);
  }

  private drawRange(sim: Simulation, x: number, y: number, radius: number, color: number): void {
    if (!Number.isFinite(radius)) {
      // Global range: outline the whole map instead of a circle.
      const w = sim.map.grid.cols * TILE_SIZE;
      const h = sim.map.grid.rows * TILE_SIZE;
      this.g.fillStyle(color, 0.04).fillRect(0, 0, w, h);
      this.g.lineStyle(3, color, 0.55).strokeRect(1.5, 1.5, w - 3, h - 3);
      return;
    }
    this.g.fillStyle(color, 0.07).fillCircle(x, y, radius);
    this.g.lineStyle(1.5, color, 0.55).strokeCircle(x, y, radius);
  }
}
