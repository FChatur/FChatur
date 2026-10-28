import Phaser from 'phaser';
import { ENEMIES, type EnemyShape } from '../config/enemies';
import { TILE_SIZE } from '../config/map';
import { MAX_TOWER_LEVEL, TOWERS, type TowerTypeId } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { Enemy, Projectile, Tower } from '../core/types';
import { bakedImage, bakeTexture } from './bake';
import { prefersReducedMotion } from './motion';
import { DEPTH, PALETTE } from './palette';

const HP_BAR_HEIGHT = 4;
/** Hit flash and barrel recoil durations (real time, ms). Animated in sync(), no tweens needed. */
const FLASH_MS = 90;
const RECOIL_MS = 120;

interface EnemyView {
  root: Phaser.GameObjects.Container;
  flash: Phaser.GameObjects.Arc;
  frost: Phaser.GameObjects.Arc;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  barWidth: number;
  /** Real-time timestamp of the last hit, for the flash. */
  hitAt: number;
  seen: number;
}

interface TowerView {
  root: Phaser.GameObjects.Container;
  barrel: Phaser.GameObjects.Container;
  level: number;
  /** Real-time timestamp of the last shot, for the recoil. */
  firedAt: number;
  seen: number;
}

interface ProjectileView {
  root: Phaser.GameObjects.Arc;
  /** Pool key: projectiles of the same tower type look identical and can be reused. */
  kind: string;
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
  /** Hidden projectile views kept for reuse (one per shot otherwise means constant allocation). */
  private readonly projectilePool = new Map<string, Phaser.GameObjects.Arc[]>();
  private frame = 0;
  /** Set after a zoom change: views are being rebuilt, so skip their "pop" entrance. */
  private rebuilding = false;

  constructor(private readonly scene: Phaser.Scene) {}

  sync(sim: Simulation, alpha: number): void {
    const frame = ++this.frame;
    const now = this.scene.time.now;

    for (const t of sim.towers) {
      let view = this.towers.get(t.id);
      if (view && view.level !== t.level) {
        // Upgraded: rebuild the view so it reflects the new level.
        view.root.destroy();
        view = undefined;
      }
      view ??= this.createTower(t);
      view.barrel.rotation = t.angle;
      const recoil = (now - view.firedAt) / RECOIL_MS;
      view.barrel.scaleX = recoil >= 1 ? 1 : 0.7 + 0.3 * (1 - (1 - recoil) ** 2);
      view.seen = frame;
    }
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const view = this.enemies.get(e.id) ?? this.createEnemy(e);
      view.root.setPosition(lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha));
      view.frost.setVisible(e.slowFactor < 1);
      const flash = (now - view.hitAt) / FLASH_MS;
      view.flash.setAlpha(flash >= 1 ? 0 : 0.85 * (1 - flash));
      this.updateHpBar(view, e);
      view.seen = frame;
    }
    this.rebuilding = false;
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      const view = this.projectiles.get(p.id) ?? this.createProjectile(p);
      view.root.setPosition(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
      view.seen = frame;
    }

    prune(this.towers, frame, (v) => v.root.destroy());
    prune(this.enemies, frame, (v) => v.root.destroy());
    prune(this.projectiles, frame, (v) => this.releaseProjectile(v));
  }

  private releaseProjectile(v: ProjectileView): void {
    v.root.setVisible(false);
    const pool = this.projectilePool.get(v.kind) ?? [];
    pool.push(v.root);
    this.projectilePool.set(v.kind, pool);
  }

  /** Brief white flash when an enemy takes a hit. */
  flashEnemy(id: number): void {
    const view = this.enemies.get(id);
    if (view) view.hitAt = this.scene.time.now;
  }

  /** Barrel kick-back when a tower fires. */
  recoilTower(id: number): void {
    const view = this.towers.get(id);
    if (view) view.firedAt = this.scene.time.now;
  }

  /** After a zoom change: rebuild every view so baked art is re-rasterised at the new scale. */
  rescale(): void {
    this.clear();
    this.rebuilding = true;
  }

  clear(): void {
    for (const v of this.towers.values()) v.root.destroy();
    for (const v of this.enemies.values()) v.root.destroy();
    for (const v of this.projectiles.values()) v.root.destroy();
    for (const pool of this.projectilePool.values()) for (const arc of pool) arc.destroy();
    this.projectilePool.clear();
    this.towers.clear();
    this.enemies.clear();
    this.projectiles.clear();
  }

  // ---------------------------------------------------------------- factories

  private createTower(t: Tower): TowerView {
    const color = TOWERS[t.type].color;
    const ts = TILE_SIZE;
    const half = ts * (0.33 + 0.02 * t.level);
    // The base is baked once per tower type and level, one tile in size, centred on the tower.
    const baseKey = bakeTexture(this.scene, `tower-${t.type}-${t.level}`, ts, ts, (g) => drawTowerBase(g, color, half, t.level), true);
    const base = bakedImage(this.scene, 0, 0, baseKey);

    const barrel = this.scene.add.container(0, 0, this.barrelParts(t.type, color));
    const cap = this.capPart(t.type, color, half);
    const root = this.scene.add.container(t.x, t.y, [base, barrel, cap]).setDepth(DEPTH.towers);

    if (!this.rebuilding && !prefersReducedMotion()) {
      root.setScale(0.5);
      this.scene.tweens.add({ targets: root, scale: 1, duration: 220, ease: 'Back.Out' });
    }

    const view: TowerView = { root, barrel, level: t.level, firedAt: -Infinity, seen: 0 };
    this.towers.set(t.id, view);
    return view;
  }

  /** Barrel silhouettes, drawn pointing along +x so rotation aims them. */
  private barrelParts(type: TowerTypeId, color: number): Phaser.GameObjects.GameObject[] {
    const ts = TILE_SIZE;
    const rect = (y: number, length: number, width: number) =>
      this.scene.add.rectangle(0, y, length, width, color).setOrigin(0, 0.5);
    switch (type) {
      case 'basic':
        return [rect(0, ts * 0.42, 7)];
      case 'sniper':
        return [rect(0, ts * 0.58, 4), this.scene.add.rectangle(ts * 0.5, 0, 4, 8, color)];
      case 'rapid':
        return [rect(-4, ts * 0.36, 4), rect(4, ts * 0.36, 4)];
      case 'frost':
        return [this.scene.add.triangle(ts * 0.3, 0, 0, -5, 10, 0, 0, 5, color)];
    }
  }

  private capPart(type: TowerTypeId, color: number, half: number): Phaser.GameObjects.Shape {
    if (type === 'frost') {
      return this.scene.add.rectangle(0, 0, half * 0.75, half * 0.75, color).setAngle(45);
    }
    return this.scene.add.circle(0, 0, half * 0.4, color);
  }

  private createEnemy(e: Enemy): EnemyView {
    const cfg = ENEMIES[e.type];
    const r = e.radius;
    // Baked once per enemy type; the margin leaves room for outlines and the boss's halo.
    const size = Math.ceil((r + 6) * 2);
    const bodyKey = bakeTexture(this.scene, `enemy-${e.type}`, size, size, (g) => drawEnemyShape(g, cfg.shape, r, cfg.color), true);
    const body = bakedImage(this.scene, 0, 0, bodyKey);
    const flash = this.scene.add.circle(0, 0, r + 1, 0xffffff).setAlpha(0);
    const frost = this.scene.add
      .circle(0, 0, r + 4)
      .setStrokeStyle(2, TOWERS.frost.color, 0.9)
      .setVisible(false);
    const barWidth = cfg.shape === 'boss' ? 44 : 26;
    const barY = -r - 7;
    const hpBack = this.scene.add
      .rectangle(-barWidth / 2, barY, barWidth, HP_BAR_HEIGHT, PALETTE.hpBack, 0.7)
      .setOrigin(0, 0.5);
    const hpFill = this.scene.add
      .rectangle(-barWidth / 2, barY, barWidth, HP_BAR_HEIGHT, PALETTE.hpHigh)
      .setOrigin(0, 0.5);
    const root = this.scene.add
      .container(e.x, e.y, [body, flash, frost, hpBack, hpFill])
      .setDepth(DEPTH.enemies);

    const view: EnemyView = { root, flash, frost, hpBack, hpFill, barWidth, hitAt: -Infinity, seen: 0 };
    this.updateHpBar(view, e);
    this.enemies.set(e.id, view);
    return view;
  }

  private createProjectile(p: Projectile): ProjectileView {
    const kind = p.towerType;
    const pooled = this.projectilePool.get(kind)?.pop();
    let root: Phaser.GameObjects.Arc;
    if (pooled) {
      root = pooled.setPosition(p.x, p.y).setVisible(true);
    } else {
      const color = TOWERS[p.towerType].color;
      const radius = p.towerType === 'frost' ? 5 : p.towerType === 'basic' ? 4 : 3;
      root = this.scene.add
        .circle(p.x, p.y, radius, p.towerType === 'frost' ? color : PALETTE.projectile)
        .setStrokeStyle(2, color, 0.8)
        .setDepth(DEPTH.projectiles);
    }
    const view: ProjectileView = { root, kind, seen: 0 };
    this.projectiles.set(p.id, view);
    return view;
  }

  private updateHpBar(view: EnemyView, e: Enemy): void {
    const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
    // Full-health enemies hide their bar to keep the board readable (bosses always show theirs).
    const visible = ratio < 1 || e.type === 'boss';
    view.hpBack.setVisible(visible);
    view.hpFill.setVisible(visible);
    if (!visible) return;
    view.hpFill.width = view.barWidth * ratio;
    view.hpFill.fillColor = ratio > 0.6 ? PALETTE.hpHigh : ratio > 0.3 ? PALETTE.hpMid : PALETTE.hpLow;
  }
}

function drawTowerBase(g: Phaser.GameObjects.Graphics, color: number, half: number, level: number): void {
  if (level === MAX_TOWER_LEVEL) {
    g.fillStyle(color, 0.18).fillRoundedRect(-half - 3, -half - 3, half * 2 + 6, half * 2 + 6, 8);
  }
  g.fillStyle(PALETTE.towerBase).fillRoundedRect(-half, -half, half * 2, half * 2, 6);
  g.lineStyle(2, color, 1).strokeRoundedRect(-half, -half, half * 2, half * 2, 6);
  g.fillStyle(color, 0.22).fillCircle(0, 0, half * 0.7);

  // Level pips along the bottom edge.
  const pip = 4;
  const gap = 3;
  const startX = -((MAX_TOWER_LEVEL * pip + (MAX_TOWER_LEVEL - 1) * gap) / 2);
  for (let i = 0; i < MAX_TOWER_LEVEL; i++) {
    g.fillStyle(color, i < level ? 1 : 0.2).fillRect(startX + i * (pip + gap), half - pip - 3, pip, pip);
  }
}

function drawEnemyShape(g: Phaser.GameObjects.Graphics, shape: EnemyShape, r: number, color: number): void {
  const outline = PALETTE.enemyOutline;
  switch (shape) {
    case 'square':
      g.fillStyle(color).fillRoundedRect(-r, -r, r * 2, r * 2, 4);
      g.lineStyle(2, outline, 1).strokeRoundedRect(-r, -r, r * 2, r * 2, 4);
      g.fillStyle(0xffffff, 0.25).fillRect(-r + 3, -r + 3, r * 0.7, r * 0.5);
      return;
    case 'diamond': {
      const pts = [new Phaser.Math.Vector2(0, -r - 2), new Phaser.Math.Vector2(r + 2, 0),
        new Phaser.Math.Vector2(0, r + 2), new Phaser.Math.Vector2(-r - 2, 0)];
      g.fillStyle(color).fillPoints(pts, true);
      g.lineStyle(2, outline, 1).strokePoints(pts, true);
      g.fillStyle(0xffffff, 0.3).fillTriangle(0, -r + 2, r * 0.5, -2, -r * 0.5, -2);
      return;
    }
    case 'octagon': {
      const pts = polygon(8, r, Math.PI / 8);
      g.fillStyle(color).fillPoints(pts, true);
      g.lineStyle(3, outline, 1).strokePoints(pts, true);
      // Armor plate.
      g.fillStyle(0x000000, 0.25).fillRect(-r * 0.55, -r * 0.2, r * 1.1, r * 0.4);
      g.lineStyle(1.5, 0xffffff, 0.35).strokePoints(polygon(8, r * 0.65, Math.PI / 8), true);
      return;
    }
    case 'boss': {
      const pts = polygon(8, r, Math.PI / 8);
      g.fillStyle(0x000000, 0.35).fillCircle(0, 0, r + 5);
      g.fillStyle(color).fillPoints(pts, true);
      g.lineStyle(3, 0xffd166, 1).strokePoints(pts, true);
      g.fillStyle(0x0b0f1a, 0.8).fillCircle(0, 0, r * 0.45);
      g.fillStyle(0xffd166).fillCircle(0, 0, r * 0.2);
      return;
    }
  }
}

function polygon(sides: number, r: number, rotation: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return pts;
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
