import { blank, blit, type Bitmap } from './bitmap';
import { creatureFrames } from './sprites/creatures';
import { effectFrames } from './sprites/effects';
import { projectileFrames } from './sprites/projectiles';
import { towerArt, towerPortrait } from './sprites/towers';

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

/** Every sprite animation in the game, by name. */
export function allSprites(): Record<string, Bitmap[]> {
  const out: Record<string, Bitmap[]> = { ...creatureFrames(), ...projectileFrames(), ...effectFrames() };
  const towers = towerArt();
  for (const t of TOWER_TYPES) {
    out[`tower-${t}-base`] = towers[t].bases.map((b) => b.image);
    for (const [name, frames] of Object.entries(towers[t].defender)) out[`tower-${t}-${name}`] = frames;
    out[`tower-${t}-portrait`] = [1, 2, 3].map((level) => towerPortrait(t, level));
  }
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
