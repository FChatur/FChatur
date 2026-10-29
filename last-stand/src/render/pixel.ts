import Phaser from 'phaser';
import { buildAtlas, frameKey, type Atlas } from '../art/atlas';
import { blank, type Bitmap } from '../art/bitmap';
import { scaledText, textBitmap } from '../art/font';
import { ART_TILE } from '../art/terrain';
import { TILE_SIZE } from '../config/map';

/**
 * Phaser side of the pixel art: the sprite atlas texture, cached textures for generated bitmaps
 * (terrain, text, range circles), and helpers that create images at art scale.
 */

/** World units per art pixel. Every pixel-art image is drawn at this scale. */
export const ART_SCALE = TILE_SIZE / ART_TILE;

export const ATLAS_KEY = 'px';

let atlas: Atlas | null = null;

/** Copies a bitmap into a new canvas element (one canvas pixel per art pixel). */
export function bitmapCanvas(b: Bitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = b.w;
  canvas.height = b.h;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b.data), b.w, b.h), 0, 0);
  return canvas;
}

/** Creates the sprite atlas texture (once per game). */
export function installAtlas(scene: Phaser.Scene): Atlas {
  atlas ??= buildAtlas();
  if (!scene.textures.exists(ATLAS_KEY)) {
    const texture = scene.textures.addCanvas(ATLAS_KEY, bitmapCanvas(atlas.image))!;
    for (const [name, f] of atlas.frames) texture.add(name, 0, f.x, f.y, f.w, f.h);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return atlas;
}

/** Number of frames in an atlas animation (0 if unknown). */
export function frameCount(animation: string): number {
  return atlas?.counts.get(animation) ?? 0;
}

/** Size of an atlas frame in art pixels. */
export function frameSize(animation: string, index = 0): { w: number; h: number } {
  const f = atlas?.frames.get(frameKey(animation, index));
  return f ? { w: f.w, h: f.h } : { w: 0, h: 0 };
}

/** An image showing one atlas frame at art scale. */
export function pixelImage(scene: Phaser.Scene, x: number, y: number, animation: string, index = 0): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ATLAS_KEY, frameKey(animation, index)).setScale(ART_SCALE);
}

/** A texture made from a generated bitmap, created once and cached under `key`. */
export function bitmapTexture(scene: Phaser.Scene, key: string, make: () => Bitmap): string {
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, bitmapCanvas(make()))!.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return key;
}

/**
 * Pixel-font text as a texture. Recently used strings are cached (floating numbers repeat a lot); the
 * least recently used are freed beyond the cap, long after they've left the screen.
 */
const TEXT_CACHE_LIMIT = 300;
const textLru = new Map<string, true>();

export function textTexture(scene: Phaser.Scene, text: string, color: number, scale = 1): string {
  const key = `txt:${scale}:${color}:${text}`;
  textLru.delete(key);
  textLru.set(key, true);
  bitmapTexture(scene, key, () => (scale === 1 ? textBitmap(text, color) : scaledText(text, color, scale)));
  if (textLru.size > TEXT_CACHE_LIMIT) {
    const oldest = textLru.keys().next().value!;
    textLru.delete(oldest);
    if (scene.textures.exists(oldest)) scene.textures.remove(oldest);
  }
  return key;
}

/** A translucent bitmap: `alpha` (0..255) applied to a solid colour wherever `inside` holds. */
export function alphaBitmap(w: number, h: number, color: number, inside: (x: number, y: number) => number): Bitmap {
  const b = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = inside(x, y);
      if (a <= 0) continue;
      const i = (y * w + x) * 4;
      b.data[i] = (color >> 16) & 255;
      b.data[i + 1] = (color >> 8) & 255;
      b.data[i + 2] = color & 255;
      b.data[i + 3] = a;
    }
  }
  return b;
}

/** Soft oval ground shadow, `w` art pixels wide. */
export function shadowTexture(scene: Phaser.Scene, w: number): string {
  const h = Math.max(3, Math.round(w / 3.5));
  return bitmapTexture(scene, `shadow:${w}`, () =>
    alphaBitmap(w, h, 0x1a1424, (x, y) => {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      return d > 1 ? 0 : d > 0.55 ? 60 : 95;
    }),
  );
}

/**
 * Range indicator: a pixel circle (one art pixel thick) with a faint fill, white so it can be tinted.
 * Radius in art pixels.
 */
export function rangeTexture(scene: Phaser.Scene, radius: number): string {
  const r = Math.round(radius);
  const size = r * 2 + 1;
  return bitmapTexture(scene, `range:${r}`, () =>
    alphaBitmap(size, size, 0xffffff, (x, y) => {
      const d = Math.hypot(x - r, y - r);
      if (d > r + 0.5) return 0;
      if (d > r - 0.5) return 190;
      // Dotted inner ring for a subtle pixel texture, plain fill elsewhere.
      return 26;
    }),
  );
}
