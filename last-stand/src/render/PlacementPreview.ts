import Phaser from 'phaser';
import type { TileCoord } from '../config/map';
import { GRID } from '../config/map';
import { TOWERS, type TowerTypeId } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { PlacementBlock } from '../core/types';
import { DEPTH, FONT_FAMILY, PALETTE } from './palette';

const BLOCK_LABEL: Partial<Record<PlacementBlock, string>> = {
  path: 'Path',
  occupied: 'Occupied',
  'insufficient-gold': 'Not enough gold',
};

/**
 * Hover feedback: with a tower selected, shows the target tile (green/red) and the tower's range.
 * With nothing selected, hovering an existing tower shows its range.
 */
export class PlacementPreview {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
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

  update(sim: Simulation, hover: TileCoord | null, selected: TowerTypeId | null): void {
    this.g.clear();
    this.label.setVisible(false);
    if (!hover || sim.phase === 'gameover') return;

    const ts = GRID.tileSize;
    const cx = (hover.col + 0.5) * ts;
    const cy = (hover.row + 0.5) * ts;

    if (selected) {
      const check = sim.canPlaceTower(selected, hover.col, hover.row);
      if (!check.ok && check.reason === 'out-of-bounds') return;
      const color = check.ok ? PALETTE.valid : PALETTE.invalid;
      this.drawRange(cx, cy, TOWERS[selected].rangeTiles * ts, color);
      this.g.fillStyle(color, 0.28).fillRect(hover.col * ts, hover.row * ts, ts, ts);
      this.g.lineStyle(2, color, 0.9).strokeRect(hover.col * ts + 1, hover.row * ts + 1, ts - 2, ts - 2);
      const text = check.ok ? null : BLOCK_LABEL[check.reason];
      if (text) {
        this.label.setText(text).setPosition(cx, hover.row * ts - 4).setVisible(true);
      }
      return;
    }

    const tower = sim.towerAt(hover.col, hover.row);
    if (tower) this.drawRange(tower.x, tower.y, tower.range, PALETTE.range);
  }

  private drawRange(x: number, y: number, radius: number, color: number): void {
    this.g.fillStyle(color, 0.07).fillCircle(x, y, radius);
    this.g.lineStyle(1.5, color, 0.55).strokeCircle(x, y, radius);
  }
}
