import Phaser from 'phaser';
import { frameKey } from '../art/atlas';
import { TOWER_ART } from '../art/catalog';
import { COLORS } from '../art/palette';
import { explosionFrames } from '../art/sprites/effects';
import { ENEMIES } from '../config/enemies';
import { TILE_SIZE } from '../config/map';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { EntityRenderer } from './EntityRenderer';
import { prefersReducedMotion } from './motion';
import { DEPTH, PALETTE } from './palette';
import { ART_SCALE, ATLAS_KEY, bitmapCanvas, frameCount, textTexture } from './pixel';

/**
 * Caps on simultaneously alive cosmetic effects. Heavy fire (many towers at 3x) can request thousands
 * per second; beyond a cap new cosmetic effects are simply skipped until older ones finish, so frame
 * cost stays bounded and late waves stay readable. Important feedback (leaks, upgrades, sales, banners) is never capped.
 */
export const EFFECT_CAPS = { minor: 70, particle: 90, text: 10 } as const;
type EffectKind = keyof typeof EFFECT_CAPS;

class EffectBudget {
  private readonly live: Record<EffectKind, number> = { minor: 0, particle: 0, text: 0 };

  /** Reserves one slot, or returns false when the category is full. */
  take(kind: EffectKind): boolean {
    if (this.live[kind] >= EFFECT_CAPS[kind]) return false;
    this.live[kind]++;
    return true;
  }

  release(kind: EffectKind): void {
    this.live[kind]--;
  }
}

/** A frame animation playing once at a fixed spot (real time). */
interface Flipbook {
  img: Phaser.GameObjects.Image;
  frames: string[];
  texture: string;
  start: number;
  frameMs: number;
  /** Rises this many world units over its life (coins). */
  rise: number;
  y0: number;
  kind: EffectKind | null;
}

/** Explosion frames per splash radius, as separate textures (created on first use). */
function explosionTextures(scene: Phaser.Scene, radiusArt: number): string[] {
  const r = Math.round(radiusArt);
  const key = (i: number) => `boom:${r}:${i}`;
  if (!scene.textures.exists(key(0))) {
    explosionFrames(r).forEach((f, i) => scene.textures.addCanvas(key(i), bitmapCanvas(f))!.setFilter(Phaser.Textures.FilterMode.NEAREST));
  }
  return [0, 1, 2, 3, 4].map(key);
}

/**
 * Short-lived visual feedback driven by simulation events: impacts, deaths, coins, level-ups, banners.
 * Effects run on real time, so they stay readable at any game speed. Returns an update function (call
 * every frame) and an unsubscribe function.
 */
export function attachEffects(
  scene: Phaser.Scene,
  bus: EventBus<GameEvents>,
  entities: EntityRenderer,
  exit: { x: number; y: number },
  world: { width: number; height: number },
): { update: () => void; detach: () => void } {
  const budget = new EffectBudget();
  let lastThump = -Infinity;
  /** Whether the wave in progress has a boss (its clear gets the bigger celebration). */
  let bossWave = false;
  const playing: Flipbook[] = [];
  const pool: Phaser.GameObjects.Image[] = [];

  /** Plays an atlas animation once at (x, y). Cosmetic ones (with a kind) respect the budget. */
  const play = (animation: string, x: number, y: number, frameMs: number, kind: EffectKind | null, rise = 0) => {
    if (kind && !budget.take(kind)) return;
    const frames = Array.from({ length: frameCount(animation) }, (_, i) => frameKey(animation, i));
    const img = (pool.pop() ?? scene.add.image(0, 0, ATLAS_KEY, frames[0]).setScale(ART_SCALE))
      .setTexture(ATLAS_KEY, frames[0])
      .setPosition(x, y)
      .setAlpha(1)
      .setVisible(true)
      .setDepth(DEPTH.effects);
    playing.push({ img, frames, texture: ATLAS_KEY, start: scene.time.now, frameMs, rise, y0: y, kind });
  };

  const playTextures = (textures: string[], x: number, y: number, frameMs: number, kind: EffectKind | null) => {
    if (kind && !budget.take(kind)) return;
    const img = scene.add.image(x, y, textures[0]).setScale(ART_SCALE).setDepth(DEPTH.effects);
    playing.push({ img, frames: textures, texture: '', start: scene.time.now, frameMs, rise: 0, y0: y, kind });
  };

  /** Floating pixel text; `important` ones (upgrades, sales, interest) ignore the cap. */
  const floatText = (x: number, y: number, text: string, color: number, important = false) => {
    if (!important && !budget.take('text')) return;
    const label = scene.add
      .image(Math.round(x / ART_SCALE) * ART_SCALE, y, textTexture(scene, text, color))
      .setScale(ART_SCALE)
      .setDepth(DEPTH.text);
    scene.tweens.add({
      targets: label,
      y: y - 8 * ART_SCALE,
      alpha: 0,
      duration: 750,
      ease: 'Quad.Out',
      onComplete: () => {
        label.destroy();
        if (!important) budget.release('text');
      },
    });
  };

  const shake = (ms: number, intensity: number) => {
    if (!prefersReducedMotion()) scene.cameras.main.shake(ms, intensity);
  };

  const subs = [
    bus.on('towerFired', ({ tower }) => entities.recoilTower(tower.id)),

    bus.on('waveStarted', ({ wave }) => {
      bossWave = false;
      banner(scene, world, `WAVE ${wave}`, PALETTE.waveText);
    }),

    bus.on('enemySpawned', ({ enemy }) => {
      if (enemy.type !== 'boss') return;
      bossWave = true;
      banner(scene, world, `${ENEMIES.boss.name.toUpperCase()} APPROACHES!`, PALETTE.bossText);
      shake(450, 0.006);
      entities.react('boss');
    }),

    bus.on('projectileHit', ({ projectile, enemy, crit, damage }) => {
      entities.flashEnemy(enemy.id, projectile.x - projectile.prevX, projectile.y - projectile.prevY);
      const at = entities.enemyCenter(enemy);
      const art = TOWER_ART[projectile.towerType];
      play(crit ? 'crit-spark' : art.impact, at.x, at.y, art.impact === 'heavy-impact' ? 55 : 50, 'minor');
      // Ballista hits are big and rare: show how much they did (red for a critical hit). Other towers hit
      // too often for numbers to stay readable, so they rely on sparks and health bars.
      if (art.defender === 'ballista') {
        // A heavy thump: a small camera kick, at most a few per second however many ballistas fire.
        if (scene.time.now - lastThump > 280) {
          lastThump = scene.time.now;
          shake(90, 0.0018);
        }
        floatText(at.x, at.y - 7 * ART_SCALE, crit ? `${Math.round(damage)}!` : `${Math.round(damage)}`, crit ? COLORS.red3 : COLORS.white0);
      }
    }),

    bus.on('chainArc', ({ fromX, fromY, toX, toY }) => {
      if (!budget.take('minor')) return;
      const g = lightning(scene, fromX, fromY, toX, toY);
      scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => (g.destroy(), budget.release('minor')) });
    }),

    bus.on('splash', ({ x, y, radius }) => playTextures(explosionTextures(scene, radius / ART_SCALE), x, y, 55, 'minor')),

    bus.on('waveCleared', ({ interest }) => {
      // Heroes celebrate: briefly after a normal wave, with stars and sparkles after a boss wave.
      entities.react(bossWave ? 'bossVictory' : 'victory');
      if (bossWave) {
        for (const spot of entities.heroSpots()) {
          for (const [dx, dy] of [[-6, -4], [6, -8], [0, -12]]) play('sparkle', spot.x + dx * ART_SCALE, spot.y + dy * ART_SCALE, 90, 'particle');
        }
      }
      bossWave = false;
      if (interest <= 0) return;
      floatText(world.width / 2, 14 * ART_SCALE, `+${interest} INTEREST`, PALETTE.gold, true);
    }),

    bus.on('enemyKilled', ({ enemy }) => {
      const at = entities.enemyCenter(enemy);
      play('death-dust', at.x, at.y, 60, 'particle');
      play('coin', at.x, at.y - 3 * ART_SCALE, 70, 'particle', 7 * ART_SCALE);
      // In a crowd the coin alone says "gold"; the number would just add noise.
      if (!entities.crowded || enemy.type === 'boss') floatText(at.x + 5 * ART_SCALE, at.y - 6 * ART_SCALE, `+${enemy.reward}`, PALETTE.gold);
    }),

    bus.on('towerPlaced', ({ tower }) => play('build-dust', tower.x, tower.y + TILE_SIZE * 0.35, 60, null)),

    bus.on('towerUpgraded', ({ tower }) => {
      for (const [dx, dy] of [[-5, -10], [5, -14], [0, -20], [-6, -2], [6, -6]]) {
        play('sparkle', tower.x + dx * ART_SCALE, tower.y + dy * ART_SCALE, 90, null);
      }
      floatText(tower.x, tower.y - 22 * ART_SCALE, `LV ${tower.level}`, COLORS.gold4, true);
    }),

    bus.on('towerSold', ({ tower, refund }) => {
      play('build-dust', tower.x, tower.y + TILE_SIZE * 0.35, 60, null);
      floatText(tower.x, tower.y - 8 * ART_SCALE, `+${refund}`, PALETTE.gold, true);
    }),

    bus.on('enemyLeaked', () => {
      shake(160, 0.004);
      entities.react('leak');
      const flash = scene.add
        .rectangle(exit.x, exit.y, 6 * ART_SCALE, TILE_SIZE * 1.2, PALETTE.leak, 0.75)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    }),
  ];

  const update = () => {
    const now = scene.time.now;
    for (let i = playing.length - 1; i >= 0; i--) {
      const f = playing[i];
      const index = Math.floor((now - f.start) / f.frameMs);
      if (index >= f.frames.length) {
        if (f.kind) budget.release(f.kind);
        if (f.texture) {
          f.img.setVisible(false);
          pool.push(f.img);
        } else {
          f.img.destroy();
        }
        playing.splice(i, 1);
        continue;
      }
      if (f.texture) f.img.setFrame(f.frames[index]);
      else f.img.setTexture(f.frames[index]);
      if (f.rise) {
        const t = (now - f.start) / (f.frameMs * f.frames.length);
        f.img.setY(f.y0 - Math.round((f.rise * t) / ART_SCALE) * ART_SCALE);
      }
    }
  };

  return {
    update,
    detach: () => {
      subs.forEach((off) => off());
      for (const f of playing) f.img.destroy();
      for (const img of pool) img.destroy();
    },
  };
}

/** A pixel-text title that drops in, holds, and fades over the top of the board. */
function banner(scene: Phaser.Scene, world: { width: number; height: number }, text: string, color: number): void {
  const reduced = prefersReducedMotion();
  const y = world.height * 0.22;
  const label = scene.add
    .image(world.width / 2, reduced ? y : y - 6 * ART_SCALE, textTexture(scene, text, color, 2))
    .setScale(ART_SCALE)
    .setDepth(DEPTH.banner)
    .setAlpha(0);
  scene.tweens.chain({
    targets: label,
    tweens: [
      { alpha: 1, y, duration: 220, ease: reduced ? 'Linear' : 'Back.Out' },
      { alpha: 0, duration: 400, delay: 900 },
    ],
    onComplete: () => label.destroy(),
  });
}

/** A jagged pixel bolt between two points (corners snapped to the art grid), faded out by the caller. */
function lightning(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.effects);
  const snap = (v: number) => Math.round(v / ART_SCALE) * ART_SCALE;
  const segments = 5;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  const points: [number, number][] = [[snap(x1), snap(y1)]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (Math.random() - 0.5) * 4 * ART_SCALE;
    points.push([snap(x1 + (x2 - x1) * t + (nx / len) * jitter), snap(y1 + (y2 - y1) * t + (ny / len) * jitter)]);
  }
  points.push([snap(x2), snap(y2)]);
  for (const [width, color] of [[ART_SCALE * 3, PALETTE.lightningGlow], [ART_SCALE, PALETTE.lightning]] as const) {
    g.lineStyle(width, color, width > ART_SCALE ? 0.5 : 1).beginPath().moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) g.lineTo(px, py);
    g.strokePath();
  }
  return g;
}
