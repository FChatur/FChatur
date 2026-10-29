import Phaser from 'phaser';
import { frameKey } from '../art/atlas';
import type { Point, Terrain } from '../art/terrain';
import { prefersReducedMotion } from './motion';
import { DEPTH } from './palette';
import { ART_SCALE, ATLAS_KEY } from './pixel';

/** Numbers of ambient creatures and particles. Small on purpose: atmosphere, not noise. */
const BUTTERFLIES = 6;
const LEAVES = 8;
const SWAYING = 28;
const BUTTERFLY_COLORS = ['orange', 'blue', 'white', 'pink'];

interface Butterfly {
  img: Phaser.GameObjects.Image;
  home: Point;
  phase: number;
  speed: number;
  radius: number;
  anim: string;
}

interface Leaf {
  img: Phaser.GameObjects.Image;
  bornAt: number;
  life: number;
  x: number;
  y: number;
  drift: number;
  anim: string;
}

/**
 * Ambient life on the battlefield: flickering torches, eyes blinking in the
 * cave, butterflies over the flower patches, leaves falling from the tree line and grass swaying at the
 * clearing's edge. Everything stays behind the action (below creatures, towers and effects) and is
 * driven by one cheap update per frame; with reduced motion only the static parts remain.
 */
export class Ambient {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly torches: Phaser.GameObjects.Image[] = [];
  private readonly sway: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly leaves: Leaf[] = [];
  private eyes: Phaser.GameObjects.Image | null = null;
  private readonly moving = !prefersReducedMotion();
  private readonly canopies: Point[];

  constructor(
    private readonly scene: Phaser.Scene,
    terrain: Terrain,
  ) {
    const world = (p: Point): Point => ({ x: (p.x - terrain.originX) * ART_SCALE, y: (p.y - terrain.originY) * ART_SCALE });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (this.objects.push(o), o);

    for (const t of terrain.ambient.torches) {
      const p = world(t);
      this.torches.push(add(scene.add.image(p.x, p.y, ATLAS_KEY, frameKey('torch', 0)).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 2)));
    }
    if (terrain.ambient.caveEyes) {
      const p = world(terrain.ambient.caveEyes);
      this.eyes = add(scene.add.image(p.x, p.y, ATLAS_KEY, frameKey('cave-eyes', 0)).setScale(ART_SCALE).setDepth(DEPTH.terrain + 2));
    }
    terrain.ambient.sway.slice(0, SWAYING).forEach((s, i) => {
      const p = world(s);
      const img = add(scene.add.image(p.x + 4 * ART_SCALE, p.y + 2 * ART_SCALE, ATLAS_KEY, frameKey('sway-grass', 0)).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 2));
      this.sway.push({ img, phase: i * 0.37 });
    });
    this.canopies = terrain.ambient.canopies.map(world);
    if (!this.moving) return;
    const meadows = terrain.ambient.meadows.map(world);
    for (let i = 0; i < Math.min(BUTTERFLIES, meadows.length); i++) {
      const anim = `butterfly-${BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]}`;
      const img = add(scene.add.image(0, 0, ATLAS_KEY, frameKey(anim, 0)).setScale(ART_SCALE).setDepth(DEPTH.shadows + 1));
      this.butterflies.push({ img, home: meadows[(i * 7) % meadows.length], phase: i * 1.7, speed: 0.6 + (i % 3) * 0.15, radius: (10 + (i % 4) * 4) * ART_SCALE, anim });
    }
  }

  update(): void {
    const now = this.scene.time.now;
    const t = now / 1000;
    this.torches.forEach((img, i) => img.setFrame(frameKey('torch', Math.floor(now / 110 + i * 2) % 3)));
    if (this.eyes) {
      // Mostly watching; a blink every few seconds, and now and then they vanish for a moment.
      const cycle = (now / 1000) % 5.3;
      this.eyes.setVisible(cycle > 0.18 && !(cycle > 3.1 && cycle < 3.9));
    }
    if (!this.moving) return;
    for (const s of this.sway) s.img.setFrame(frameKey('sway-grass', Math.sin(t * 1.6 + s.phase) > 0 ? 0 : 1));
    for (const b of this.butterflies) {
      const a = t * b.speed + b.phase;
      // A looping, wandering flight around its meadow, flapping as it goes.
      const x = b.home.x + Math.cos(a) * b.radius + Math.sin(a * 2.3) * b.radius * 0.35;
      const y = b.home.y + Math.sin(a * 1.3) * b.radius * 0.55 - Math.abs(Math.sin(a * 5)) * 2 * ART_SCALE;
      b.img.setPosition(Math.round(x / ART_SCALE) * ART_SCALE, Math.round(y / ART_SCALE) * ART_SCALE);
      b.img.setFrame(frameKey(b.anim, Math.floor(now / 90 + b.phase * 10) % 2));
    }
    this.updateLeaves(now);
  }

  private updateLeaves(now: number): void {
    if (this.canopies.length === 0) return;
    while (this.leaves.length < LEAVES) {
      const from = this.canopies[Math.floor(Math.random() * this.canopies.length)];
      const anim = Math.random() < 0.6 ? 'leaf' : 'leaf-green';
      const img = this.scene.add.image(from.x, from.y, ATLAS_KEY, frameKey(anim, 0)).setScale(ART_SCALE).setDepth(DEPTH.shadows + 1);
      this.objects.push(img);
      this.leaves.push({ img, bornAt: now + Math.random() * 3000, life: 2600 + Math.random() * 1800, x: from.x + (Math.random() - 0.5) * 30, y: from.y, drift: (Math.random() - 0.3) * 30, anim });
    }
    for (const leaf of this.leaves) {
      const age = now - leaf.bornAt;
      if (age < 0) {
        leaf.img.setVisible(false);
        continue;
      }
      if (age > leaf.life) {
        // Recycle from another tree.
        const from = this.canopies[Math.floor(Math.random() * this.canopies.length)];
        leaf.bornAt = now + Math.random() * 2500;
        leaf.x = from.x + (Math.random() - 0.5) * 30;
        leaf.y = from.y;
        continue;
      }
      const s = age / 1000;
      const x = leaf.x + leaf.drift * s + Math.sin(s * 3) * 4 * ART_SCALE;
      const y = leaf.y + s * 16 * ART_SCALE;
      leaf.img
        .setVisible(true)
        .setPosition(Math.round(x / ART_SCALE) * ART_SCALE, Math.round(y / ART_SCALE) * ART_SCALE)
        .setFrame(frameKey(leaf.anim, Math.floor(age / 180) % 3))
        .setAlpha(age > leaf.life - 500 ? (leaf.life - age) / 500 : 1);
    }
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}
