import Phaser from 'phaser';
import { SIMULATION } from '../config/balance';
import { GRID, type TileCoord } from '../config/map';
import { worldToTile } from '../core/grid';
import type { GameSession } from '../game/GameSession';
import { drawBoard } from '../render/BoardRenderer';
import { attachEffects } from '../render/Effects';
import { EntityRenderer } from '../render/EntityRenderer';
import { PlacementPreview } from '../render/PlacementPreview';

export interface GameSceneData {
  session: GameSession;
}

/**
 * Bridges the simulation and Phaser: runs the fixed-step loop, renders state, and turns
 * pointer input on the board into session commands.
 */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private entities!: EntityRenderer;
  private preview!: PlacementPreview;
  private hover: TileCoord | null = null;
  private accumulator = 0;
  /** Simulation seconds per real second. */
  timeScale = 1;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.session = data.session;
  }

  create(): void {
    const path = this.session.sim.path;
    drawBoard(this, GRID, path);
    this.entities = new EntityRenderer(this);
    this.preview = new PlacementPreview(this);

    const exitPoint = path.points[path.points.length - 2];
    const detachEffects = attachEffects(this, this.session.bus, this.entities, {
      x: GRID.cols * GRID.tileSize,
      y: exitPoint.y,
    });
    const offReset = this.session.bus.on('sessionReset', () => {
      this.entities.clear();
      this.accumulator = 0;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detachEffects();
      offReset();
    });

    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.hover = worldToTile(p.worldX, p.worldY, GRID.tileSize);
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.hover = null;
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.onPointerDown(p));
  }

  override update(_time: number, deltaMs: number): void {
    const sim = this.session.sim;
    const step = SIMULATION.stepSeconds;
    this.accumulator += (Math.min(deltaMs, SIMULATION.maxFrameDeltaMs) / 1000) * this.timeScale;

    let steps = 0;
    while (this.accumulator >= step && steps < SIMULATION.maxStepsPerFrame) {
      sim.step(step);
      this.accumulator -= step;
      steps++;
    }
    // Drop backlog we couldn't catch up on rather than spiralling.
    if (steps === SIMULATION.maxStepsPerFrame) this.accumulator = 0;

    this.entities.sync(sim, this.accumulator / step);
    this.preview.update(sim, this.hover, this.session.selectedTower);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (p.rightButtonDown()) {
      this.session.selectTower(null);
      return;
    }
    const selected = this.session.selectedTower;
    if (!selected) return;
    const tile = worldToTile(p.worldX, p.worldY, GRID.tileSize);
    this.hover = tile;
    this.session.sim.placeTower(selected, tile.col, tile.row);
  }
}
