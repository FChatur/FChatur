import Phaser from 'phaser';
import { ENEMIES } from '../config/enemies';
import { TILE_SIZE } from '../config/map';
import { TOWERS } from '../config/towers';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { EntityRenderer } from './EntityRenderer';
import { DEPTH, FONT_FAMILY, PALETTE, textResolution } from './palette';

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
  const subs = [
    bus.on('towerFired', ({ tower, projectile }) => {
      entities.recoilTower(tower.id);
      const flash = scene.add
        .circle(projectile.x, projectile.y, 5, TOWERS[tower.type].color, 0.9)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 90, onComplete: () => flash.destroy() });
    }),

    bus.on('waveStarted', ({ wave }) => banner(scene, world, `WAVE ${wave}`, PALETTE.waveText, 26)),

    bus.on('enemySpawned', ({ enemy }) => {
      if (enemy.type !== 'boss') return;
      banner(scene, world, `${ENEMIES.boss.name.toUpperCase()} APPROACHES`, PALETTE.exit, 30);
      scene.cameras.main.shake(400, 0.006);
    }),

    bus.on('projectileHit', ({ projectile, enemy, crit }) => {
      entities.flashEnemy(enemy.id);
      spark(scene, projectile.x, projectile.y, crit);
    }),

    bus.on('chainArc', ({ fromX, fromY, toX, toY }) => lightning(scene, fromX, fromY, toX, toY)),

    bus.on('splash', ({ x, y, radius }) => {
      const ring = scene.add
        .circle(x, y, radius)
        .setFillStyle(PALETTE.splash, 0.18)
        .setStrokeStyle(2, PALETTE.splash, 0.8)
        .setDepth(DEPTH.effects)
        .setScale(0.4);
      scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 220, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    }),

    bus.on('waveCleared', ({ interest }) => {
      if (interest <= 0) return;
      floatText(scene, world.width / 2, 40, `Interest +${interest}`, PALETTE.gold);
    }),

    bus.on('enemyKilled', ({ enemy }) => {
      burst(scene, enemy.x, enemy.y, ENEMIES[enemy.type].color);
      floatText(scene, enemy.x, enemy.y - 12, `+${enemy.reward}`, PALETTE.gold);
    }),

    bus.on('towerUpgraded', ({ tower }) => {
      const ring = scene.add
        .circle(tower.x, tower.y, TILE_SIZE * 0.45)
        .setStrokeStyle(3, TOWERS[tower.type].color, 1)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => ring.destroy() });
      floatText(scene, tower.x, tower.y - 20, `LV ${tower.level}`, TOWERS[tower.type].color);
    }),

    bus.on('towerSold', ({ tower, refund }) => {
      burst(scene, tower.x, tower.y, TOWERS[tower.type].color);
      floatText(scene, tower.x, tower.y - 12, `+${refund}`, PALETTE.gold);
    }),

    bus.on('enemyLeaked', () => {
      scene.cameras.main.shake(140, 0.004);
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
    .setScale(0.9);
  scene.tweens.chain({
    targets: label,
    tweens: [
      { alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' },
      { alpha: 0, duration: 400, delay: 800 },
    ],
    onComplete: () => label.destroy(),
  });
}

function spark(scene: Phaser.Scene, x: number, y: number, crit: boolean): void {
  const color = crit ? PALETTE.crit : PALETTE.projectile;
  const ring = scene.add.circle(x, y, crit ? 5 : 3).setStrokeStyle(crit ? 3 : 2, color, 1).setDepth(DEPTH.effects);
  scene.tweens.add({ targets: ring, scale: crit ? 3.2 : 2.4, alpha: 0, duration: crit ? 260 : 160, onComplete: () => ring.destroy() });
}

/** A jagged bolt between two points that fades quickly. */
function lightning(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): void {
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
  scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
}

function burst(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 14 + Math.random() * 14;
    const bit = scene.add.rectangle(x, y, 4, 4, color).setDepth(DEPTH.effects);
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      angle: 180,
      duration: 320 + Math.random() * 120,
      ease: 'Quad.Out',
      onComplete: () => bit.destroy(),
    });
  }
}

function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: number): void {
  const label = scene.add
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
  scene.tweens.add({
    targets: label,
    y: y - 22,
    alpha: 0,
    duration: 700,
    ease: 'Quad.Out',
    onComplete: () => label.destroy(),
  });
}
