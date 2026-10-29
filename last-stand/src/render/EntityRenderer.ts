import Phaser from 'phaser';
import { ballistaBow, frameKey, heroAnimation, heroPedestal } from '../art/atlas';
import { CREATURE_ART, TOWER_ART, type CreatureArt } from '../art/catalog';
import { BALLISTA_DIRECTIONS, BALLISTA_LAYOUT, heroArt, type HeroAnim } from '../art/sprites/characters';
import { directionIndex, PROJECTILE_DIRECTIONS } from '../art/sprites/projectiles';
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
/** Drop-in when a tower is built. */
const BUILD_DROP_MS = 160;
const SHARD_FRAME_MS = 110;

/**
 * Hero animation timing (real ms). Heroes follow the rhythm of their own shots: they draw (or crank, or
 * raise the staff) just before a shot is due, release on the shot, and idle when nothing is in range.
 */
const HERO = {
  idleFrameMs: 420,
  /** Idle frames: mostly breathing (0, 1), now and then frame 2 (a blink or a bob). */
  idleSequence: [0, 1, 0, 1, 0, 1, 0, 2],
  /** How long the release pose shows after a shot (at most this fraction of the gap between shots). */
  releaseMs: 150,
  ballistaReleaseMs: 260,
  releaseShare: 0.45,
  /** How long before the next shot the draw pose starts (at most this fraction of the gap). */
  drawMs: 260,
  ballistaCrankMs: 900,
  drawShare: 0.45,
  /** Below this gap between shots (very fast fire) the two attack frames simply alternate. */
  flurryGapMs: 120,
  flurryFrameMs: 80,
  /** The crossbow kicks back this long after a shot. */
  recoilMs: 110,
  /** Time from a tower's last shot after which it relaxes back to idle. */
  engagedMs: 1200,
};

/** Reactions to the battle: a boss arrives, lives are lost, a wave is won. */
type Reaction = 'boss' | 'leak' | 'victory' | 'bossVictory';
const REACTION: Record<Reaction, { anim: HeroAnim; ms: number; frameMs: number; emote: string | null }> = {
  boss: { anim: 'alarm', ms: 1500, frameMs: 130, emote: 'emote-alert' },
  leak: { anim: 'alarm', ms: 800, frameMs: 130, emote: 'emote-sweat' },
  victory: { anim: 'victory', ms: 900, frameMs: 220, emote: null },
  bossVictory: { anim: 'victory', ms: 2600, frameMs: 200, emote: 'emote-star' },
};
/** Heroes don't all react on the same frame: each starts up to this much later (by id). */
const REACTION_STAGGER_MS = 240;

/** Heroes fade to this opacity while they hide an enemy behind them, so the road stays readable. */
const OCCLUDING_ALPHA = 0.35;
/** Creatures walk up to this many art pixels to either side of the path's centre line, so packs spread out. */
const SPREAD = 3;

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
  /** Body width in world units, for occlusion checks. */
  width: number;
  facing: 1 | -1;
  /** Real-time timestamp of the last hit, for the white flash. */
  hitAt: number;
  /** Sideways offset from the path's centre line (world units, eased when the path turns). */
  offX: number;
  offY: number;
  /** Where the body was drawn last (centre x, feet y), for occlusion checks. */
  drawnX: number;
  drawnFeet: number;
  seen: number;
}

interface TowerView {
  shadow: Phaser.GameObjects.Image;
  pedestal: Phaser.GameObjects.Image;
  hero: Phaser.GameObjects.Image;
  /** The Ballista's crossbow (Brakk's tower only). */
  bow: Phaser.GameObjects.Image | null;
  /** Reaction mark over the hero's head, created on first use. */
  emote: Phaser.GameObjects.Image | null;
  level: number;
  /** Real-time timestamp of the last shot, and the gap before it (for timing the draw). */
  firedAt: number;
  shotGap: number;
  builtAt: number;
  reaction: Reaction | null;
  reactAt: number;
  /** Current opacity of the hero (eases toward OCCLUDING_ALPHA while an enemy is behind it). */
  fade: number;
  /** Area above the tile covered by the hero, for occlusion checks (world units). */
  coverLeft: number;
  coverRight: number;
  coverTop: number;
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

/** Where each hero's picture ends below its pedestal's top, per tower type and level (art pixels). */
const STAND: Record<TowerTypeId, readonly number[]> = (() => {
  const art = heroArt();
  return { basic: art.basic.stand, sniper: art.sniper.stand, rapid: art.rapid.stand, frost: art.frost.stand };
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

    prune(this.towers, frame, (v) => this.destroyTower(v));
    prune(this.enemies, frame, (v) => destroyAll(v.shadow, v.body, v.barBack, v.barFill, v.frost));
    prune(this.projectiles, frame, (v) => this.releaseProjectile(v));
    this.fadeOccluders();
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

  /** A tower fired: its hero plays the release pose. */
  recoilTower(id: number): void {
    const view = this.towers.get(id);
    if (!view) return;
    const now = this.scene.time.now;
    if (Number.isFinite(view.firedAt)) view.shotGap = now - view.firedAt;
    view.firedAt = now;
  }

  /**
   * Every hero reacts: alarmed when a boss appears or lives are lost, cheering when a wave is won (longer
   * and with a star after a boss wave). A lost life never interrupts the boss alarm.
   */
  react(kind: Reaction): void {
    const now = this.scene.time.now;
    for (const [id, view] of this.towers) {
      if (kind === 'leak' && view.reaction === 'boss' && now < view.reactAt + REACTION.boss.ms) continue;
      view.reaction = kind;
      view.reactAt = now + ((id * 89) % REACTION_STAGGER_MS);
    }
  }

  /** Where each tower's hero stands (for effects such as celebration sparkles). */
  heroSpots(): { x: number; y: number }[] {
    return [...this.towers.values()].map((v) => ({ x: (v.coverLeft + v.coverRight) / 2, y: v.coverTop + 6 * ART_SCALE }));
  }

  /** True when the board is busy enough that minor floating text would clutter it. */
  get crowded(): boolean {
    return this.enemies.size >= 12;
  }

  /** Where an enemy's body is drawn (for effects that should hit the body, not the feet). */
  enemyCenter(e: Enemy): { x: number; y: number } {
    const art = CREATURE_ART[e.type];
    const { h } = frameSize(art.walk);
    const view = this.enemies.get(e.id);
    const ox = view ? Math.round(view.offX / ART_SCALE) * ART_SCALE : 0;
    const oy = view ? Math.round(view.offY / ART_SCALE) * ART_SCALE : 0;
    return { x: e.x + ox, y: e.y + oy + (art.feet - h / 2) * ART_SCALE };
  }

  clear(): void {
    for (const v of this.towers.values()) this.destroyTower(v);
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
      .image(t.x, bottom - 2 * ART_SCALE, shadowTexture(this.scene, t.type === 'sniper' ? 22 : 18))
      .setScale(ART_SCALE)
      .setDepth(DEPTH.shadows);
    const pedestal = pixelImage(this.scene, t.x, bottom, heroPedestal(t.type), t.level - 1).setOrigin(0.5, 1);
    const hero = pixelImage(this.scene, t.x, bottom, heroAnimation(t.type, t.level, 'idle'), 0);
    const bow = t.type === 'sniper' ? pixelImage(this.scene, t.x, bottom, ballistaBow(t.level, 'loaded'), 0).setOrigin(0, 1) : null;
    hero.setOrigin(bow ? 0 : 0.5, 1);
    const built = prefersReducedMotion() ? -Infinity : now;
    const view: TowerView = {
      shadow, pedestal, hero, bow, emote: null, level: t.level, firedAt: -Infinity, shotGap: Infinity, builtAt: built,
      reaction: null, reactAt: 0, fade: 1, coverLeft: 0, coverRight: 0, coverTop: 0, seen: 0,
    };
    this.applyLevel(view, t);
    this.towers.set(t.id, view);
    return view;
  }

  private applyLevel(view: TowerView, t: Tower): void {
    view.level = t.level;
    view.pedestal.setFrame(frameKey(heroPedestal(t.type), t.level - 1));
    const depth = unitDepth((t.row + 1) * TILE_SIZE);
    view.pedestal.setDepth(depth);
    view.hero.setDepth(depth + 0.01);
    view.bow?.setDepth(depth + 0.02);
  }

  private destroyTower(v: TowerView): void {
    destroyAll(v.shadow, v.pedestal, v.hero);
    v.bow?.destroy();
    v.emote?.destroy();
  }

  private updateTower(view: TowerView, t: Tower, now: number): void {
    const S = ART_SCALE;
    const reduced = prefersReducedMotion();
    const pose = this.heroPose(view, t, now, reduced);
    view.hero.setFrame(frameKey(heroAnimation(t.type, t.level, pose.anim), pose.frame));
    // New towers drop into place.
    const drop = Math.max(0, 1 - (now - view.builtAt) / BUILD_DROP_MS);
    const lift = Math.round(drop * drop * 8) * S;
    const bottom = (t.row + 1) * TILE_SIZE - lift;
    const deck = bottom - view.pedestal.height * S;
    view.pedestal.setY(bottom).setAlpha(1 - drop * 0.6);
    const fade = view.fade * (1 - drop * 0.6);
    let heroLeft: number;
    if (view.bow) {
      // Brakk stands behind his crossbow; it aims at the target and kicks back when it fires.
      const L = BALLISTA_LAYOUT;
      const left = t.x - (L.width / 2) * S;
      const bow = pose.bow;
      const kick = now - view.firedAt < HERO.recoilMs && !reduced;
      const kx = kick ? -Math.round(Math.cos(t.angle)) : 0;
      const ky = kick ? -Math.round(Math.sin(t.angle) * 0.7) : 0;
      view.bow
        .setFrame(frameKey(ballistaBow(t.level, bow), directionIndex(t.angle, BALLISTA_DIRECTIONS)))
        .setPosition(left + (L.width * S - view.bow.width * S) + kx * S, deck + L.bowBelowDeck * S + ky * S)
        .setAlpha(fade);
      view.hero.setPosition(left + L.heroX * S, deck + L.heroBelowDeck * S + pose.hop * S);
      heroLeft = left;
      view.coverLeft = left;
      view.coverRight = left + L.width * S;
    } else {
      // Archers and mages turn to face their target.
      view.hero.setFlipX(Math.cos(t.angle) < -0.05);
      view.hero.setPosition(t.x, deck + (STAND[t.type][t.level - 1] + 1) * S + pose.hop * S);
      heroLeft = t.x - (view.hero.width / 2) * S;
      view.coverLeft = heroLeft;
      view.coverRight = heroLeft + view.hero.width * S;
    }
    view.hero.setAlpha(fade);
    const heroTop = view.hero.y - view.hero.height * S;
    view.coverTop = Math.min(heroTop, view.bow ? view.bow.y - view.bow.height * S : heroTop);
    this.updateEmote(view, t, now, heroTop, reduced);
  }

  /** The hero's animation and frame right now, plus the Ballista's crossbow state and a hop (art px). */
  private heroPose(view: TowerView, t: Tower, now: number, reduced: boolean): { anim: HeroAnim; frame: number; hop: number; bow: 'loaded' | 'cocking' | 'fired' } {
    const ballista = view.bow !== null;
    const attackFrames = ballista ? 3 : 2;
    const since = now - view.firedAt;
    const gap = view.shotGap;
    const engaged = since < Math.max(HERO.engagedMs, Number.isFinite(gap) ? gap * 1.5 : 0);
    const release = Math.min(ballista ? HERO.ballistaReleaseMs : HERO.releaseMs, gap * HERO.releaseShare);
    if (since < release) return { anim: 'attack', frame: attackFrames - 1, hop: 0, bow: 'fired' };
    if (engaged) {
      if (ballista) {
        // After a shot the bow stays slack for a moment, then Brakk cranks it back with his wrench.
        if (since < gap * 0.5) return { anim: 'idle', frame: 0, hop: 0, bow: 'fired' };
        if (since > gap - Math.min(HERO.ballistaCrankMs, gap * 0.5)) {
          return { anim: 'attack', frame: Math.floor(now / 160) % 2, hop: 0, bow: 'cocking' };
        }
        return { anim: 'idle', frame: 0, hop: 0, bow: 'cocking' };
      }
      if (gap < HERO.flurryGapMs) return { anim: 'attack', frame: Math.floor(now / HERO.flurryFrameMs) % 2, hop: 0, bow: 'loaded' };
      if (since > gap - Math.min(HERO.drawMs, gap * HERO.drawShare)) return { anim: 'attack', frame: 0, hop: 0, bow: 'loaded' };
    }
    const r = view.reaction ? REACTION[view.reaction] : null;
    const into = now - view.reactAt;
    if (r && into >= 0 && into < r.ms) {
      const frame = Math.floor(into / r.frameMs) % 2;
      const hop = view.reaction === 'bossVictory' && frame === 1 && !reduced ? -2 : 0;
      return { anim: r.anim, frame, hop, bow: 'loaded' };
    }
    const step = Math.floor((now + t.id * 137) / HERO.idleFrameMs) % HERO.idleSequence.length;
    return { anim: 'idle', frame: reduced ? 0 : HERO.idleSequence[step], hop: 0, bow: ballista && engaged ? 'cocking' : 'loaded' };
  }

  /** The reaction mark (! for a boss, a sweat drop for lost lives, a star for a boss wave won). */
  private updateEmote(view: TowerView, t: Tower, now: number, heroTop: number, reduced: boolean): void {
    const r = view.reaction ? REACTION[view.reaction] : null;
    const into = now - view.reactAt;
    const show = !!r?.emote && into >= 0 && into < r.ms;
    if (!show) {
      view.emote?.setVisible(false);
      if (r && into >= r.ms) view.reaction = null;
      return;
    }
    view.emote ??= pixelImage(this.scene, 0, 0, r.emote!, 0).setOrigin(0.5, 1).setDepth(DEPTH.bars + 3);
    const bob = reduced ? 0 : Math.floor(into / 160) % 2;
    // Over the hero's head, just above the empty headroom at the top of the frame.
    const x = view.bow ? view.hero.x + 6 * ART_SCALE : t.x;
    view.emote
      .setTexture(ATLAS_KEY, frameKey(r.emote!, 0))
      .setPosition(x, heroTop + (2 - bob) * ART_SCALE)
      .setVisible(true);
  }

  /** Heroes standing in front of an enemy fade, so nothing on the road hides behind a tall tower. */
  private fadeOccluders(): void {
    for (const tv of this.towers.values()) {
      const tileTop = tv.pedestal.y - TILE_SIZE;
      let hides = false;
      if (tv.coverTop < tileTop) {
        for (const ev of this.enemies.values()) {
          const top = ev.drawnFeet - ev.height;
          if (ev.drawnFeet <= tv.coverTop || top >= tileTop) continue;
          const half = ev.width / 2;
          if (ev.drawnX + half <= tv.coverLeft || ev.drawnX - half >= tv.coverRight) continue;
          // Only enemies standing behind the tower (higher up the screen) can be hidden by it.
          if (ev.drawnFeet < tv.pedestal.y) {
            hides = true;
            break;
          }
        }
      }
      const target = hides ? OCCLUDING_ALPHA : 1;
      tv.fade += (target - tv.fade) * 0.25;
      if (Math.abs(target - tv.fade) < 0.02) tv.fade = target;
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
      shadow, body, barBack, barFill, frost, art, height: h * ART_SCALE, width: w * ART_SCALE, facing: 1, hitAt: -Infinity,
      hitDx: 0, hitDy: 0, offX: 0, offY: 0, drawnX: e.x, drawnFeet: e.y, seen: 0,
    };
    this.enemies.set(e.id, view);
    return view;
  }

  private updateEnemy(view: EnemyView, e: Enemy, alpha: number, now: number): void {
    let x = lerp(e.prevX, e.x, alpha);
    let y = lerp(e.prevY, e.y, alpha);
    // Each creature keeps to its own side of the road (by id) so a pack spreads out instead of stacking.
    // Drawing only: the simulation still moves it along the centre line.
    const mx = e.x - e.prevX;
    const my = e.y - e.prevY;
    const moved = Math.hypot(mx, my);
    if (moved > 0.01 && e.type !== 'boss') {
      const side = (((e.id * 37) % (2 * SPREAD + 1)) - SPREAD) * ART_SCALE;
      view.offX += ((-my / moved) * side - view.offX) * 0.15;
      view.offY += ((mx / moved) * side * 0.6 - view.offY) * 0.15;
    }
    x += Math.round(view.offX / ART_SCALE) * ART_SCALE;
    y += Math.round(view.offY / ART_SCALE) * ART_SCALE;
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
    view.drawnX = x;
    view.drawnFeet = feet;
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
