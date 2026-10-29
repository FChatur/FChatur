import Phaser from 'phaser';
import { frameKey } from '../art/atlas';
import { CREATURE_ART, TOWER_ART, type CreatureArt } from '../art/catalog';
import { directionIndex, PROJECTILE_DIRECTIONS } from '../art/sprites/projectiles';
import { BALLISTA_DIRECTIONS, DEFENDER_SINK, towerArt } from '../art/sprites/towers';
import { TILE_SIZE } from '../config/map';
import type { TowerTypeId } from '../config/towers';
import type { Simulation } from '../core/Simulation';
import type { Enemy, Projectile, Tower } from '../core/types';
import { prefersReducedMotion } from './motion';
import { DEPTH, PALETTE, unitDepth } from './palette';
import { ART_SCALE, ATLAS_KEY, frameSize, pixelImage, shadowTexture } from './pixel';

/** Real-time durations (ms). Animated in sync(), so no tweens are needed. */
const FLASH_MS = 70;
/** Hit creatures flinch one art pixel away from the shot for this long. */
const FLINCH_MS = 80;
/** How long a defender shows its "just shot" pose. */
const SHOT_POSE_MS = 150;
/** Drop-in when a tower is built. */
const BUILD_DROP_MS = 160;
const SHARD_FRAME_MS = 110;

interface EnemyView {
  shadow: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  barBack: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  /** Snowflake shown over slowed creatures. */
  frost: Phaser.GameObjects.Image;
  art: CreatureArt;
  /** Direction of the last hit (unit vector), for the flinch. */
  hitDx: number;
  hitDy: number;
  /** Body height in world units, for placing the health bar. */
  height: number;
  facing: 1 | -1;
  /** Real-time timestamp of the last hit, for the white flash. */
  hitAt: number;
  seen: number;
}

interface TowerView {
  shadow: Phaser.GameObjects.Image;
  base: Phaser.GameObjects.Image;
  defender: Phaser.GameObjects.Image;
  level: number;
  /** Real-time timestamp of the last shot, for the shooting pose. */
  firedAt: number;
  builtAt: number;
  seen: number;
}

interface ProjectileView {
  img: Phaser.GameObjects.Image;
  /** Pool key: projectiles of the same tower type look identical and can be reused. */
  kind: TowerTypeId;
  startX: number;
  startY: number;
  /** Length of the shot when fired, for the arc. */
  span: number;
  lastX: number;
  lastY: number;
  bornAt: number;
  seen: number;
}

/** Where each tower level's defender stands, in art pixels from the base's top. */
const BASE_TOPS: Record<TowerTypeId, number[]> = (() => {
  const art = towerArt();
  return {
    basic: art.basic.bases.map((b) => b.top),
    sniper: art.sniper.bases.map((b) => b.top),
    rapid: art.rapid.bases.map((b) => b.top),
    frost: art.frost.bases.map((b) => b.top),
  };
})();

/**
 * Mirrors simulation entities as pixel-art sprites. Views are created when an entity first appears and
 * destroyed when it disappears, keyed by entity id. Positions are interpolated between simulation steps
 * using `alpha` so movement stays smooth on high-refresh displays.
 */
export class EntityRenderer {
  private readonly enemies = new Map<number, EnemyView>();
  private readonly towers = new Map<number, TowerView>();
  private readonly projectiles = new Map<number, ProjectileView>();
  /** Hidden projectile images kept for reuse (one per shot otherwise means constant allocation). */
  private readonly projectilePool = new Map<TowerTypeId, Phaser.GameObjects.Image[]>();
  private frame = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  sync(sim: Simulation, alpha: number): void {
    const frame = ++this.frame;
    const now = this.scene.time.now;

    for (const t of sim.towers) {
      let view = this.towers.get(t.id);
      if (view && view.level !== t.level) this.applyLevel(view, t);
      view ??= this.createTower(t, now);
      this.updateTower(view, t, now);
      view.seen = frame;
    }
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const view = this.enemies.get(e.id) ?? this.createEnemy(e);
      this.updateEnemy(view, e, alpha, now);
      view.seen = frame;
    }
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      const view = this.projectiles.get(p.id) ?? this.createProjectile(p, now);
      this.updateProjectile(view, p, alpha, now);
      view.seen = frame;
    }

    prune(this.towers, frame, (v) => destroyAll(v.shadow, v.base, v.defender));
    prune(this.enemies, frame, (v) => destroyAll(v.shadow, v.body, v.barBack, v.barFill, v.frost));
    prune(this.projectiles, frame, (v) => this.releaseProjectile(v));
  }

  /** Brief white flash when an enemy takes a hit, and a flinch away from where the shot came from. */
  flashEnemy(id: number, dx = 0, dy = 0): void {
    const view = this.enemies.get(id);
    if (!view) return;
    view.hitAt = this.scene.time.now;
    const len = Math.hypot(dx, dy) || 1;
    view.hitDx = dx / len;
    view.hitDy = dy / len;
  }

  /** Shooting pose when a tower fires. */
  recoilTower(id: number): void {
    const view = this.towers.get(id);
    if (view) view.firedAt = this.scene.time.now;
  }

  /** Where an enemy's body is drawn (for effects that should hit the body, not the feet). */
  enemyCenter(e: Enemy): { x: number; y: number } {
    const art = CREATURE_ART[e.type];
    const { h } = frameSize(art.walk);
    return { x: e.x, y: e.y + (art.feet - h / 2) * ART_SCALE };
  }

  clear(): void {
    for (const v of this.towers.values()) destroyAll(v.shadow, v.base, v.defender);
    for (const v of this.enemies.values()) destroyAll(v.shadow, v.body, v.barBack, v.barFill, v.frost);
    for (const v of this.projectiles.values()) v.img.destroy();
    for (const pool of this.projectilePool.values()) for (const img of pool) img.destroy();
    this.projectilePool.clear();
    this.towers.clear();
    this.enemies.clear();
    this.projectiles.clear();
  }

  // ---------------------------------------------------------------- towers

  private createTower(t: Tower, now: number): TowerView {
    const bottom = (t.row + 1) * TILE_SIZE;
    const shadow = this.scene.add
      .image(t.x, bottom - 2 * ART_SCALE, shadowTexture(this.scene, 18))
      .setScale(ART_SCALE)
      .setDepth(DEPTH.shadows);
    const base = pixelImage(this.scene, t.x, bottom, `tower-${t.type}-base`, t.level - 1).setOrigin(0.5, 1);
    const defender = this.scene.add.image(t.x, 0, ATLAS_KEY, this.defenderFrame(t, false, now)).setScale(ART_SCALE).setOrigin(0.5, 1);
    const built = prefersReducedMotion() ? -Infinity : now;
    const view: TowerView = { shadow, base, defender, level: t.level, firedAt: -Infinity, builtAt: built, seen: 0 };
    this.applyLevel(view, t);
    this.towers.set(t.id, view);
    return view;
  }

  private applyLevel(view: TowerView, t: Tower): void {
    view.level = t.level;
    view.base.setFrame(frameKey(`tower-${t.type}-base`, t.level - 1));
    const depth = unitDepth((t.row + 1) * TILE_SIZE);
    view.base.setDepth(depth);
    view.defender.setDepth(depth + 0.01);
  }

  private updateTower(view: TowerView, t: Tower, now: number): void {
    const shooting = now - view.firedAt < SHOT_POSE_MS;
    view.defender.setFrame(this.defenderFrame(t, shooting, now));
    // Archers and mages face their target; the ballista turns instead.
    if (TOWER_ART[t.type].defender !== 'ballista') view.defender.setFlipX(Math.cos(t.angle) < -0.05);
    // New towers drop into place.
    const drop = Math.max(0, 1 - (now - view.builtAt) / BUILD_DROP_MS);
    const lift = Math.round(drop * drop * 8) * ART_SCALE;
    const bottom = (t.row + 1) * TILE_SIZE;
    const baseHeight = view.base.height * ART_SCALE;
    view.base.setY(bottom - lift).setAlpha(1 - drop * 0.6);
    const feet = bottom - baseHeight + (BASE_TOPS[t.type][t.level - 1] + DEFENDER_SINK) * ART_SCALE;
    view.defender.setY(feet - lift).setAlpha(1 - drop * 0.6);
  }

  private defenderFrame(t: Tower, shooting: boolean, now: number): string {
    switch (TOWER_ART[t.type].defender) {
      case 'ballista':
        return frameKey(shooting ? 'tower-sniper-fired' : 'tower-sniper-loaded', directionIndex(t.angle, BALLISTA_DIRECTIONS));
      case 'mage':
        // The staff crystal pulses while idle and flares when casting.
        return frameKey(`tower-${t.type}-cast`, shooting ? 2 : Math.floor(now / 450 + t.id) % 2);
      case 'archer':
        return frameKey(`tower-${t.type}-shoot`, shooting ? 1 : 0);
    }
  }

  // ---------------------------------------------------------------- enemies

  private createEnemy(e: Enemy): EnemyView {
    const art = CREATURE_ART[e.type];
    const { w, h } = frameSize(art.walk);
    const shadow = this.scene.add
      .image(e.x, e.y, shadowTexture(this.scene, Math.max(8, w - 4)))
      .setScale(ART_SCALE)
      .setDepth(DEPTH.shadows);
    const body = pixelImage(this.scene, e.x, e.y, art.walk, 0).setOrigin(0.5, 1);
    const barW = art.barWidth * ART_SCALE;
    const barBack = this.scene.add
      .rectangle(0, 0, barW + 2 * ART_SCALE, 3 * ART_SCALE, PALETTE.hpBack, 0.85)
      .setOrigin(0, 0)
      .setDepth(DEPTH.bars);
    const barFill = this.scene.add.rectangle(0, 0, barW, ART_SCALE, PALETTE.hpHigh).setOrigin(0, 0).setDepth(DEPTH.bars + 1);
    const frost = pixelImage(this.scene, e.x, e.y, 'snowflake', 0).setDepth(DEPTH.bars + 2).setVisible(false);
    const view: EnemyView = {
      shadow, body, barBack, barFill, frost, art, height: h * ART_SCALE, facing: 1, hitAt: -Infinity, hitDx: 0, hitDy: 0, seen: 0,
    };
    this.enemies.set(e.id, view);
    return view;
  }

  private updateEnemy(view: EnemyView, e: Enemy, alpha: number, now: number): void {
    let x = lerp(e.prevX, e.x, alpha);
    let y = lerp(e.prevY, e.y, alpha);
    if (now - view.hitAt < FLINCH_MS) {
      x += Math.round(view.hitDx) * ART_SCALE;
      y += Math.round(view.hitDy) * ART_SCALE;
    }
    const feet = y + view.art.feet * ART_SCALE;
    const dx = e.x - e.prevX;
    if (Math.abs(dx) > 0.01) view.facing = dx < 0 ? -1 : 1;
    // Walk frames follow distance travelled, so feet never slide and slowed creatures visibly slow down.
    const step = Math.floor(e.distance / view.art.stride) % 4;
    view.body.setFrame(frameKey(view.art.walk, step)).setPosition(x, feet).setFlipX(view.facing < 0).setDepth(unitDepth(feet));
    view.shadow.setPosition(x, feet - ART_SCALE);
    if (now - view.hitAt < FLASH_MS) view.body.setTintFill(0xffffff);
    else if (e.slowFactor < 1) view.body.setTint(PALETTE.slowed);
    else view.body.clearTint();
    // Slowed creatures carry a bobbing snowflake, readable even in a crowd.
    const slowed = e.slowFactor < 1;
    view.frost.setVisible(slowed);
    if (slowed) {
      const bob = Math.floor(now / 250) % 2;
      view.frost.setPosition(x + 5 * ART_SCALE * view.facing, feet - view.height - (2 + bob) * ART_SCALE);
    }
    this.updateHpBar(view, e, x, feet - view.height - 4 * ART_SCALE);
  }

  private updateHpBar(view: EnemyView, e: Enemy, x: number, top: number): void {
    const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
    // Full-health enemies hide their bar to keep the board readable (bosses always show theirs).
    const visible = ratio < 1 || e.type === 'boss';
    view.barBack.setVisible(visible);
    view.barFill.setVisible(visible);
    if (!visible) return;
    const barW = view.art.barWidth * ART_SCALE;
    const left = Math.round((x - barW / 2) / ART_SCALE) * ART_SCALE;
    const row = Math.round(top / ART_SCALE) * ART_SCALE;
    view.barBack.setPosition(left - ART_SCALE, row - ART_SCALE);
    view.barFill.setPosition(left, row);
    view.barFill.width = Math.max(ART_SCALE, Math.round((barW * ratio) / ART_SCALE) * ART_SCALE);
    view.barFill.fillColor = ratio > 0.6 ? PALETTE.hpHigh : ratio > 0.3 ? PALETTE.hpMid : PALETTE.hpLow;
  }

  // ---------------------------------------------------------------- projectiles

  private createProjectile(p: Projectile, now: number): ProjectileView {
    const kind = p.towerType;
    const animation = TOWER_ART[kind].projectile;
    const pooled = this.projectilePool.get(kind)?.pop();
    const img = pooled ? pooled.setVisible(true) : pixelImage(this.scene, p.x, p.y, animation, 0).setDepth(DEPTH.projectiles);
    const span = Math.hypot(p.tx - p.x, p.ty - p.y);
    const view: ProjectileView = { img, kind, startX: p.x, startY: p.y, span, lastX: p.x, lastY: p.y, bornAt: now, seen: 0 };
    this.projectiles.set(p.id, view);
    return view;
  }

  private updateProjectile(view: ProjectileView, p: Projectile, alpha: number, now: number): void {
    const art = TOWER_ART[view.kind];
    const x = lerp(p.prevX, p.x, alpha);
    let y = lerp(p.prevY, p.y, alpha);
    if (art.arc > 0) {
      // A ballistic-looking arc on screen: height peaks halfway along the shot.
      const travelled = Math.hypot(x - view.startX, y - view.startY);
      const remaining = Math.hypot(p.tx - x, p.ty - y);
      const t = travelled / Math.max(1, travelled + remaining);
      y -= art.arc * Math.min(view.span, 6 * TILE_SIZE) * 4 * t * (1 - t);
    }
    if (art.projectile === 'shard') {
      view.img.setFrame(frameKey('shard', Math.floor((now - view.bornAt) / SHARD_FRAME_MS) % 2));
    } else {
      const dx = x - view.lastX;
      const dy = y - view.lastY;
      // Point along the on-screen motion (which includes the arc); aim at the target on the first frame.
      const angle = dx * dx + dy * dy > 0.01 ? Math.atan2(dy, dx) : Math.atan2(p.ty - p.y, p.tx - p.x);
      view.img.setFrame(frameKey(art.projectile, directionIndex(angle, PROJECTILE_DIRECTIONS)));
    }
    view.img.setPosition(x, y);
    view.lastX = x;
    view.lastY = y;
  }

  private releaseProjectile(v: ProjectileView): void {
    v.img.setVisible(false);
    const pool = this.projectilePool.get(v.kind) ?? [];
    pool.push(v.img);
    this.projectilePool.set(v.kind, pool);
  }
}

function destroyAll(...objects: Phaser.GameObjects.GameObject[]): void {
  for (const o of objects) o.destroy();
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
