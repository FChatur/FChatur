import Phaser from 'phaser';
import { ENEMIES } from '../config/enemies';
import { GRID } from '../config/map';
import { TOWERS } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { Enemy, Projectile, Tower } from '../core/types';
import { DEPTH, PALETTE } from './palette';

const HP_BAR_WIDTH = 26;
const HP_BAR_HEIGHT = 4;

interface EnemyView {
  root: Phaser.GameObjects.Container;
  flash: Phaser.GameObjects.Arc;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  seen: number;
}

interface TowerView {
  root: Phaser.GameObjects.Container;
  barrel: Phaser.GameObjects.Rectangle;
  seen: number;
}

interface ProjectileView {
  root: Phaser.GameObjects.Arc;
  seen: number;
}

/**
 * Mirrors simulation entities as Phaser objects. Views are created when an entity first appears
 * and destroyed when it disappears, keyed by entity id. Positions are interpolated between
 * simulation steps using `alpha` so movement stays smooth on high-refresh displays.
 */
export class EntityRenderer {
  private readonly enemies = new Map<number, EnemyView>();
  private readonly towers = new Map<number, TowerView>();
  private readonly projectiles = new Map<number, ProjectileView>();
  private frame = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  sync(sim: Simulation, alpha: number): void {
    const frame = ++this.frame;

    for (const t of sim.towers) {
      const view = this.towers.get(t.id) ?? this.createTower(t);
      view.barrel.rotation = t.angle;
      view.seen = frame;
    }
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const view = this.enemies.get(e.id) ?? this.createEnemy(e);
      view.root.setPosition(lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha));
      this.updateHpBar(view, e);
      view.seen = frame;
    }
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      const view = this.projectiles.get(p.id) ?? this.createProjectile(p);
      view.root.setPosition(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
      view.seen = frame;
    }

    prune(this.towers, frame, (v) => v.root.destroy());
    prune(this.enemies, frame, (v) => v.root.destroy());
    prune(this.projectiles, frame, (v) => v.root.destroy());
  }

  /** Brief white flash when an enemy takes a hit. */
  flashEnemy(id: number): void {
    const view = this.enemies.get(id);
    if (!view) return;
    this.scene.tweens.killTweensOf(view.flash);
    view.flash.setAlpha(0.85);
    this.scene.tweens.add({ targets: view.flash, alpha: 0, duration: 90 });
  }

  /** Barrel kick-back when a tower fires. */
  recoilTower(id: number): void {
    const view = this.towers.get(id);
    if (!view) return;
    this.scene.tweens.killTweensOf(view.barrel);
    view.barrel.setScale(0.7, 1);
    this.scene.tweens.add({ targets: view.barrel, scaleX: 1, duration: 120, ease: 'Quad.Out' });
  }

  clear(): void {
    for (const v of this.towers.values()) v.root.destroy();
    for (const v of this.enemies.values()) v.root.destroy();
    for (const v of this.projectiles.values()) v.root.destroy();
    this.towers.clear();
    this.enemies.clear();
    this.projectiles.clear();
  }

  // ---------------------------------------------------------------- factories

  private createTower(t: Tower): TowerView {
    const cfg = TOWERS[t.type];
    const half = GRID.tileSize * 0.38;
    const base = this.scene.add.graphics();
    base.fillStyle(PALETTE.towerBase).fillRoundedRect(-half, -half, half * 2, half * 2, 6);
    base.lineStyle(2, cfg.color, 1).strokeRoundedRect(-half, -half, half * 2, half * 2, 6);
    base.fillStyle(cfg.color, 0.25).fillCircle(0, 0, half * 0.7);
    const barrel = this.scene.add.rectangle(0, 0, GRID.tileSize * 0.42, 7, cfg.color).setOrigin(0, 0.5);
    const cap = this.scene.add.circle(0, 0, half * 0.4, cfg.color);
    const root = this.scene.add.container(t.x, t.y, [base, barrel, cap]).setDepth(DEPTH.towers);

    root.setScale(0.5);
    this.scene.tweens.add({ targets: root, scale: 1, duration: 220, ease: 'Back.Out' });

    const view: TowerView = { root, barrel, seen: 0 };
    this.towers.set(t.id, view);
    return view;
  }

  private createEnemy(e: Enemy): EnemyView {
    const cfg = ENEMIES[e.type];
    const r = e.radius;
    const body = this.scene.add.graphics();
    body.fillStyle(cfg.color).fillRoundedRect(-r, -r, r * 2, r * 2, 4);
    body.lineStyle(2, PALETTE.enemyOutline, 1).strokeRoundedRect(-r, -r, r * 2, r * 2, 4);
    body.fillStyle(0xffffff, 0.25).fillRect(-r + 3, -r + 3, r * 0.7, r * 0.5);
    const flash = this.scene.add.circle(0, 0, r + 1, 0xffffff).setAlpha(0);
    const barY = -r - 7;
    const hpBack = this.scene.add
      .rectangle(-HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, PALETTE.hpBack, 0.7)
      .setOrigin(0, 0.5);
    const hpFill = this.scene.add
      .rectangle(-HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, PALETTE.hpHigh)
      .setOrigin(0, 0.5);
    const root = this.scene.add.container(e.x, e.y, [body, flash, hpBack, hpFill]).setDepth(DEPTH.enemies);

    const view: EnemyView = { root, flash, hpBack, hpFill, seen: 0 };
    this.updateHpBar(view, e);
    this.enemies.set(e.id, view);
    return view;
  }

  private createProjectile(p: Projectile): ProjectileView {
    const root = this.scene.add
      .circle(p.x, p.y, 4, PALETTE.projectile)
      .setStrokeStyle(2, TOWERS[p.towerType].color, 0.8)
      .setDepth(DEPTH.projectiles);
    const view: ProjectileView = { root, seen: 0 };
    this.projectiles.set(p.id, view);
    return view;
  }

  private updateHpBar(view: EnemyView, e: Enemy): void {
    const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
    // Full-health enemies hide their bar to keep the board readable.
    const visible = ratio < 1;
    view.hpBack.setVisible(visible);
    view.hpFill.setVisible(visible);
    if (!visible) return;
    view.hpFill.width = HP_BAR_WIDTH * ratio;
    view.hpFill.fillColor = ratio > 0.6 ? PALETTE.hpHigh : ratio > 0.3 ? PALETTE.hpMid : PALETTE.hpLow;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function prune<V extends { seen: number }>(map: Map<number, V>, frame: number, destroy: (v: V) => void): void {
  for (const [id, view] of map) {
    if (view.seen === frame) continue;
    destroy(view);
    map.delete(id);
  }
}
