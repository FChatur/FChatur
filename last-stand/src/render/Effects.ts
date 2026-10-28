import Phaser from 'phaser';
import { ENEMIES } from '../config/enemies';
import { TILE_SIZE } from '../config/map';
import { TOWERS } from '../config/towers';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { EntityRenderer } from './EntityRenderer';
import { prefersReducedMotion } from './motion';
import { DEPTH, FONT_FAMILY, PALETTE, textResolution } from './palette';

/**
 * Caps on simultaneously alive cosmetic effects. Heavy fire (many towers at 3x) can request thousands
 * per second; beyond a cap new cosmetic effects are simply skipped until older ones finish, so frame
 * cost stays bounded. Important feedback (leaks, upgrades, sales, banners) is never capped.
 */
export const EFFECT_CAPS = { minor: 120, particle: 160, text: 14 } as const;
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

/** Creates a short-lived object if the budget allows, and destroys it when its tween ends. */
function transient<T extends Phaser.GameObjects.GameObject>(
  scene: Phaser.Scene,
  budget: EffectBudget,
  kind: EffectKind,
  create: () => T,
  tween: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
): void {
  if (!budget.take(kind)) return;
  const obj = create();
  scene.tweens.add({
    ...tween,
    targets: obj,
    onComplete: () => {
      obj.destroy();
      budget.release(kind);
    },
  });
}

/**
 * Short-lived visual feedback driven by simulation events. Effects run on real time, so they
 * stay readable at any game speed. Returns an unsubscribe function.
 */
export function attachEffects(
  scene: Phaser.Scene,
  bus: EventBus<GameEvents>,
  entities: EntityRenderer,
  exit: { x: number; y: number },
  world: { width: number; height: number },
): () => void {
  const budget = new EffectBudget();
  const spark = (x: number, y: number, crit: boolean) => {
    const color = crit ? PALETTE.crit : PALETTE.projectile;
    transient(scene, budget, 'minor', () => scene.add.circle(x, y, crit ? 5 : 3).setStrokeStyle(crit ? 3 : 2, color, 1).setDepth(DEPTH.effects), {
      scale: crit ? 3.2 : 2.4,
      alpha: 0,
      duration: crit ? 260 : 160,
    });
  };
  const burst = (x: number, y: number, color: number) => {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 14 + Math.random() * 14;
      transient(scene, budget, 'particle', () => scene.add.rectangle(x, y, 4, 4, color).setDepth(DEPTH.effects), {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        angle: 180,
        duration: 320 + Math.random() * 120,
        ease: 'Quad.Out',
      });
    }
  };
  /** Floating text; `important` ones (upgrades, sales, interest) ignore the cap. */
  const floatText = (x: number, y: number, text: string, color: number, important = false) => {
    if (!important && !budget.take('text')) return;
    const label = makeLabel(scene, x, y, text, color);
    scene.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 700,
      ease: 'Quad.Out',
      onComplete: () => {
        label.destroy();
        if (!important) budget.release('text');
      },
    });
  };

  const subs = [
    bus.on('towerFired', ({ tower, projectile }) => {
      entities.recoilTower(tower.id);
      transient(scene, budget, 'minor', () => scene.add.circle(projectile.x, projectile.y, 5, TOWERS[tower.type].color, 0.9).setDepth(DEPTH.effects), {
        scale: 1.8,
        alpha: 0,
        duration: 90,
      });
    }),

    bus.on('waveStarted', ({ wave }) => banner(scene, world, `WAVE ${wave}`, PALETTE.waveText, 26)),

    bus.on('enemySpawned', ({ enemy }) => {
      if (enemy.type !== 'boss') return;
      banner(scene, world, `${ENEMIES.boss.name.toUpperCase()} APPROACHES`, PALETTE.exit, 30);
      if (!prefersReducedMotion()) scene.cameras.main.shake(400, 0.006);
    }),

    bus.on('projectileHit', ({ projectile, enemy, crit }) => {
      entities.flashEnemy(enemy.id);
      spark(projectile.x, projectile.y, crit);
    }),

    bus.on('chainArc', ({ fromX, fromY, toX, toY }) =>
      transient(scene, budget, 'minor', () => lightning(scene, fromX, fromY, toX, toY), { alpha: 0, duration: 180 }),
    ),

    bus.on('splash', ({ x, y, radius }) =>
      transient(
        scene,
        budget,
        'minor',
        () =>
          scene.add
            .circle(x, y, radius)
            .setFillStyle(PALETTE.splash, 0.18)
            .setStrokeStyle(2, PALETTE.splash, 0.8)
            .setDepth(DEPTH.effects)
            .setScale(0.4),
        { scale: 1, alpha: 0, duration: 220, ease: 'Quad.Out' },
      ),
    ),

    bus.on('waveCleared', ({ interest }) => {
      if (interest <= 0) return;
      floatText(world.width / 2, 40, `Interest +${interest}`, PALETTE.gold, true);
    }),

    bus.on('enemyKilled', ({ enemy }) => {
      burst(enemy.x, enemy.y, ENEMIES[enemy.type].color);
      floatText(enemy.x, enemy.y - 12, `+${enemy.reward}`, PALETTE.gold);
    }),

    bus.on('towerUpgraded', ({ tower }) => {
      const ring = scene.add
        .circle(tower.x, tower.y, TILE_SIZE * 0.45)
        .setStrokeStyle(3, TOWERS[tower.type].color, 1)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => ring.destroy() });
      floatText(tower.x, tower.y - 20, `LV ${tower.level}`, TOWERS[tower.type].color, true);
    }),

    bus.on('towerSold', ({ tower, refund }) => {
      burst(tower.x, tower.y, TOWERS[tower.type].color);
      floatText(tower.x, tower.y - 12, `+${refund}`, PALETTE.gold, true);
    }),

    bus.on('enemyLeaked', () => {
      if (!prefersReducedMotion()) scene.cameras.main.shake(140, 0.004);
      const flash = scene.add
        .rectangle(exit.x, exit.y, 16, TILE_SIZE * 1.4, PALETTE.exit, 0.8)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: flash, alpha: 0, scaleX: 3, duration: 350, onComplete: () => flash.destroy() });
    }),
  ];
  return () => subs.forEach((off) => off());
}

/** A short centred title that fades in and out over the board. */
function banner(scene: Phaser.Scene, world: { width: number; height: number }, text: string, color: number, size: number): void {
  const label = scene.add
    .text(world.width / 2, world.height * 0.3, text, {
      resolution: textResolution(scene),
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000000',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.effects + 5)
    .setAlpha(0)
    .setScale(prefersReducedMotion() ? 1 : 0.9);
  scene.tweens.chain({
    targets: label,
    tweens: [
      { alpha: 1, scale: 1, duration: 220, ease: prefersReducedMotion() ? 'Linear' : 'Back.Out' },
      { alpha: 0, duration: 400, delay: 800 },
    ],
    onComplete: () => label.destroy(),
  });
}

/** A jagged bolt between two points (faded out by the caller). */
function lightning(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.effects);
  const segments = 5;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  g.lineStyle(2, PALETTE.lightning, 1).beginPath().moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (Math.random() - 0.5) * 12;
    g.lineTo(x1 + (x2 - x1) * t + (nx / len) * jitter, y1 + (y2 - y1) * t + (ny / len) * jitter);
  }
  g.lineTo(x2, y2).strokePath();
  return g;
}

function makeLabel(scene: Phaser.Scene, x: number, y: number, text: string, color: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      resolution: textResolution(scene),
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.effects);
}
