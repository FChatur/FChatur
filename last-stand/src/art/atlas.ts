import { blank, blit, type Bitmap } from './bitmap';
import { ambientFrames } from './sprites/ambient';
import { creatureFrames } from './sprites/creatures';
import { effectFrames } from './sprites/effects';
import { projectileFrames } from './sprites/projectiles';
import { BALLISTA_DIRECTIONS, heroArt, heroEmotes, heroTower, siegeBow } from './sprites/characters';

/** Where one frame lives in the atlas image. */
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  image: Bitmap;
  /** Frames by `<animation>:<index>`, e.g. `goblin-walk:2`. */
  frames: Map<string, AtlasFrame>;
  /** Frame count per animation. */
  counts: Map<string, number>;
}

export const frameKey = (animation: string, index: number): string => `${animation}:${index}`;

const TOWER_TYPES = ['basic', 'sniper', 'rapid', 'frost'] as const;
const BOW_STATES = ['loaded', 'cocking', 'fired'] as const;

/** Atlas animation names for the tower heroes (see sprites/characters.ts). One frame per level. */
export const heroPedestal = (type: string): string => `hero-${type}-pedestal`;
/** One frame per level: the complete tower, used for the placement ghost. */
export const heroGhost = (type: string): string => `hero-${type}-ghost`;
export const heroAnimation = (type: string, level: number, anim: string): string => `hero-${type}-${level}-${anim}`;
/** The Ballista's crossbow: one frame per aiming direction. */
export const ballistaBow = (level: number, state: (typeof BOW_STATES)[number]): string => `ballista-bow-${level}-${state}`;

/** Every sprite animation in the game, by name. */
export function allSprites(): Record<string, Bitmap[]> {
  const out: Record<string, Bitmap[]> = { ...creatureFrames(), ...projectileFrames(), ...effectFrames(), ...ambientFrames() };
  const heroes = heroArt();
  for (const t of TOWER_TYPES) {
    out[heroPedestal(t)] = heroes[t].pedestals;
    heroes[t].frames.forEach((anims, i) => {
      for (const [anim, frames] of Object.entries(anims)) out[heroAnimation(t, i + 1, anim)] = frames;
    });
    // The whole tower at each level, for the placement ghost.
    out[heroGhost(t)] = [1, 2, 3].map((level) => heroTower(t, level));
  }
  for (const level of [1, 2, 3]) {
    for (const state of BOW_STATES) {
      out[ballistaBow(level, state)] = Array.from({ length: BALLISTA_DIRECTIONS }, (_, d) => siegeBow(d, state, level));
    }
  }
  for (const [name, bmp] of Object.entries(heroEmotes())) out[`emote-${name}`] = [bmp];
  return out;
}

/**
 * Packs every frame into one image (one texture, so the renderer can batch all sprites into few draw
 * calls). Simple shelf packing, tallest first, with a transparent pixel between frames.
 */
export function buildAtlas(groups: Record<string, Bitmap[]> = allSprites(), maxWidth = 1024): Atlas {
  const items = Object.entries(groups).flatMap(([name, frames]) => frames.map((bmp, i) => ({ key: frameKey(name, i), bmp })));
  items.sort((a, b) => b.bmp.h - a.bmp.h || b.bmp.w - a.bmp.w);
  const placed = new Map<string, AtlasFrame>();
  let x = 1;
  let y = 1;
  let shelf = 0;
  for (const { key, bmp } of items) {
    if (x + bmp.w + 1 > maxWidth) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    placed.set(key, { x, y, w: bmp.w, h: bmp.h });
    x += bmp.w + 1;
    shelf = Math.max(shelf, bmp.h);
  }
  const height = y + shelf + 1;
  const image = blank(maxWidth, height);
  for (const { key, bmp } of items) {
    const f = placed.get(key)!;
    blit(image, bmp, f.x, f.y);
  }
  const counts = new Map<string, number>();
  for (const [name, frames] of Object.entries(groups)) counts.set(name, frames.length);
  return { image, frames: placed, counts };
}
