import Phaser from 'phaser';
import { SIMULATION } from '../config/balance';
import { TILE_SIZE, type TileCoord } from '../config/map';
import { worldToTile } from '../core/grid';
import type { GameSession } from '../game/GameSession';
import { drawBoard } from '../render/BoardRenderer';
import { attachEffects } from '../render/Effects';
import { EntityRenderer } from '../render/EntityRenderer';
import { PlacementPreview } from '../render/PlacementPreview';
import type { Viewport } from '../render/viewport';

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
  /** Timestamp of the previous frame, for measuring real elapsed time. */
  private lastFrameTime: number | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.session = data.session;
  }

  create(): void {
    const { path, map } = this.session.sim;
    this.applyViewport(this.registry.get('viewport') as Viewport);
    const onViewport = (v: Viewport) => this.applyViewport(v);
    this.game.events.on('viewport', onViewport);
    drawBoard(this, map.grid, path);
    this.entities = new EntityRenderer(this);
    this.preview = new PlacementPreview(this);

    const exitPoint = path.points[path.points.length - 2];
    const detachEffects = attachEffects(
      this,
      this.session.bus,
      this.entities,
      { x: map.grid.cols * TILE_SIZE, y: exitPoint.y },
      { width: map.grid.cols * TILE_SIZE, height: map.grid.rows * TILE_SIZE },
    );
    const offReset = this.session.bus.on('sessionReset', () => {
      this.entities.clear();
      this.accumulator = 0;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      detachEffects();
      offReset();
      this.game.events.off('viewport', onViewport);
    });

    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.hover = worldToTile(p.worldX, p.worldY, TILE_SIZE);
      this.updateHoveredTower();
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.hover = null;
      this.session.setHoveredTower(null);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.onPointerDown(p));
  }

  override update(time: number): void {
    const sim = this.session.sim;
    const step = SIMULATION.stepSeconds;
    // Advance by the real time since the last frame. Phaser's `delta` argument is a smoothed average,
    // which makes motion surge and lag whenever frame times are uneven.
    const frameMs = this.lastFrameTime === null ? 0 : time - this.lastFrameTime;
    this.lastFrameTime = time;
    // In the menu or while paused the board stays drawn but time doesn't advance.
    if (this.session.running) {
      this.accumulator += (Math.min(Math.max(frameMs, 0), SIMULATION.maxFrameDeltaMs) / 1000) * this.session.speed;
    }

    let steps = 0;
    while (this.accumulator >= step && steps < SIMULATION.maxStepsPerFrame) {
      sim.step(step);
      this.accumulator -= step;
      steps++;
    }
    // Drop backlog we couldn't catch up on rather than spiralling.
    if (steps === SIMULATION.maxStepsPerFrame) this.accumulator = 0;

    this.entities.sync(sim, this.accumulator / step);
    this.preview.update(sim, this.hover, this.session.selectedTower, this.session.selectedTowerInstance);
  }

  /** Tooltips only while inspecting: not while a tower type is armed for building. */
  private updateHoveredTower(): void {
    const s = this.session;
    const inspecting = this.hover && s.screen === 'playing' && !s.paused && !s.selectedTower;
    s.setHoveredTower(inspecting ? (s.sim.towerAt(this.hover!.col, this.hover!.row) ?? null) : null);
  }

  /** Fits the whole map into the canvas: one world pixel = `scale` device pixels. */
  private applyViewport(v: Viewport): void {
    const { cols, rows, tileSize } = this.session.sim.map.grid;
    const cam = this.cameras.main;
    cam.setSize(v.bufferWidth, v.bufferHeight);
    cam.setZoom(v.scale);
    cam.centerOn((cols * tileSize) / 2, (rows * tileSize) / 2);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.session.screen !== 'playing' || this.session.paused) return;
    if (p.rightButtonDown()) {
      this.session.clearSelection();
      return;
    }
    const sim = this.session.sim;
    const tile = worldToTile(p.worldX, p.worldY, TILE_SIZE);
    this.hover = tile;
    const buildType = this.session.selectedTower;
    if (buildType) {
      sim.placeTower(buildType, tile.col, tile.row);
      return;
    }
    this.updateHoveredTower();
    // Nothing armed: clicking a tower selects it, clicking anywhere else deselects.
    this.session.selectBuiltTower(sim.towerAt(tile.col, tile.row) ?? null);
  }
}
