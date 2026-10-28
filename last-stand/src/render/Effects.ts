import Phaser from 'phaser';
import { ENEMIES } from '../config/enemies';
import { GRID } from '../config/map';
import { TOWERS } from '../config/towers';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { EntityRenderer } from './EntityRenderer';
import { DEPTH, FONT_FAMILY, PALETTE } from './palette';

/**
 * Short-lived visual feedback driven by simulation events. Effects run on real time, so they
 * stay readable at any game speed. Returns an unsubscribe function.
 */
export function attachEffects(
  scene: Phaser.Scene,
  bus: EventBus<GameEvents>,
  entities: EntityRenderer,
  exit: { x: number; y: number },
): () => void {
  const subs = [
    bus.on('towerFired', ({ tower }) => entities.recoilTower(tower.id)),

    bus.on('projectileHit', ({ projectile, enemy }) => {
      entities.flashEnemy(enemy.id);
      spark(scene, projectile.x, projectile.y);
    }),

    bus.on('enemyKilled', ({ enemy }) => {
      burst(scene, enemy.x, enemy.y, ENEMIES[enemy.type].color);
      floatText(scene, enemy.x, enemy.y - 12, `+${enemy.reward}`, PALETTE.gold);
    }),

    bus.on('towerUpgraded', ({ tower }) => {
      const ring = scene.add
        .circle(tower.x, tower.y, GRID.tileSize * 0.45)
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
        .rectangle(exit.x, exit.y, 16, GRID.tileSize * 1.4, PALETTE.exit, 0.8)
        .setDepth(DEPTH.effects);
      scene.tweens.add({ targets: flash, alpha: 0, scaleX: 3, duration: 350, onComplete: () => flash.destroy() });
    }),
  ];
  return () => subs.forEach((off) => off());
}

function spark(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 3).setStrokeStyle(2, PALETTE.projectile, 1).setDepth(DEPTH.effects);
  scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 160, onComplete: () => ring.destroy() });
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
