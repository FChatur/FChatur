import Phaser from 'phaser';
import { SIMULATION } from '../config/balance';
import { TILE_SIZE, type TileCoord } from '../config/map';
import { worldToTile } from '../core/grid';
import type { GameSession } from '../game/GameSession';
import { drawBoard, type BoardView } from '../render/BoardRenderer';
import { attachEffects } from '../render/Effects';
import { EntityRenderer } from '../render/EntityRenderer';
import { PALETTE } from '../render/palette';
import { installAtlas } from '../render/pixel';
import { PlacementPreview } from '../render/PlacementPreview';
import type { Viewport } from '../render/viewport';

export interface GameSceneData {
  session: GameSession;
}

/** A press and release closer than this (CSS pixels) is a click; further apart it is a drag. */
const CLICK_SLOP = 8;

/**
 * Bridges the simulation and Phaser: runs the fixed-step loop, renders state, and turns pointer input on
 * the board into session commands.
 */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private entities!: EntityRenderer;
  private preview!: PlacementPreview;
  private board: BoardView | null = null;
  private hover: TileCoord | null = null;
  private accumulator = 0;
  /** Timestamp of the previous frame, for measuring real elapsed time. */
  private lastFrameTime: number | null = null;
  private updateEffects: () => void = () => {};
  /** Where the current press on the board started, for telling clicks from drags. */
  private press: { tile: TileCoord; x: number; y: number; right: boolean } | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.session = data.session;
  }

  create(): void {
    const { path, map } = this.session.sim;
    installAtlas(this);
    this.cameras.main.setBackgroundColor(PALETTE.background);
    this.applyViewport(this.registry.get('viewport') as Viewport);
    const onViewport = (v: Viewport) => this.applyViewport(v);
    this.game.events.on('viewport', onViewport);
    this.board = drawBoard(this, map, path);
    this.entities = new EntityRenderer(this);
    this.preview = new PlacementPreview(this, this.session.sim);

    const exitPoint = path.points[path.points.length - 1];
    const effects = attachEffects(
      this,
      this.session.bus,
      this.entities,
      { x: Math.min(exitPoint.x, map.grid.cols * TILE_SIZE), y: exitPoint.y },
      { width: map.grid.cols * TILE_SIZE, height: map.grid.rows * TILE_SIZE },
    );
    this.updateEffects = effects.update;
    const offReset = this.session.bus.on('sessionReset', () => {
      this.entities.clear();
      this.accumulator = 0;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      effects.detach();
      offReset();
      this.board?.destroy();
      this.game.events.off('viewport', onViewport);
    });

    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.hover = worldToTile(p.worldX, p.worldY, TILE_SIZE);
      this.updateHoveredTower();
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.hover = null;
      this.press = null;
      this.session.setHoveredTower(null);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => this.onPointerUp(p));
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
    this.updateEffects();
    // A tower dragged from the shop previews where the pointer is; otherwise the mouse hover is used.
    const drag = this.session.drag;
    this.preview.update(
      sim,
      drag ? drag.tile : this.hover,
      drag ? drag.type : this.session.selectedTower,
      this.session.selectedTowerInstance,
    );
  }

  /** Tooltips only while inspecting: not while a tower type is armed for building. */
  private updateHoveredTower(): void {
    const s = this.session;
    const inspecting = this.hover && s.screen === 'playing' && !s.paused && !s.selectedTower && !s.drag;
    s.setHoveredTower(inspecting ? (s.sim.towerAt(this.hover!.col, this.hover!.row) ?? null) : null);
  }

  /**
   * One world unit = `scale` device pixels and one art pixel = a whole number of them. The camera's
   * origin is its top-left corner and the map's top-left lands on a whole device pixel, so every art
   * pixel maps to an identical square of screen pixels.
   */
  private applyViewport(v: Viewport): void {
    const cam = this.cameras.main;
    cam.setSize(v.bufferWidth, v.bufferHeight);
    cam.setOrigin(0, 0);
    cam.setZoom(v.scale);
    cam.setScroll(-v.mapX / v.scale, -v.mapY / v.scale);
    cam.setRoundPixels(true);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    this.press = null;
    if (this.session.screen !== 'playing' || this.session.paused) return;
    if (p.rightButtonDown()) {
      this.session.clearSelection();
      return;
    }
    this.press = { tile: worldToTile(p.worldX, p.worldY, TILE_SIZE), x: p.x, y: p.y, right: false };
  }

  /**
   * Building and selecting happen on release, and only for a click (press and release on the same tile,
   * without dragging), so a press that turns into a drag never builds anything by accident.
   */
  private onPointerUp(p: Phaser.Input.Pointer): void {
    const press = this.press;
    this.press = null;
    if (!press || this.session.screen !== 'playing' || this.session.paused || this.session.drag) return;
    const tile = worldToTile(p.worldX, p.worldY, TILE_SIZE);
    const moved = Math.hypot(p.x - press.x, p.y - press.y) / (window.devicePixelRatio || 1);
    if (tile.col !== press.tile.col || tile.row !== press.tile.row || moved > CLICK_SLOP) return;
    const sim = this.session.sim;
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
