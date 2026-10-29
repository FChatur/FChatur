import type { Bitmap } from '../art/bitmap';
import { heroTower } from '../art/sprites/characters';
import type { TowerTypeId } from '../config/towers';

/**
 * Hero portraits for the interface: the same pixel art as on the battlefield (pedestal and hero at a
 * level), as image URLs the page scales up with nearest-neighbour sampling. One portrait per tower type
 * and level is drawn once and reused.
 */
export interface Portrait {
  url: string;
  /** Size in art pixels. */
  width: number;
  height: number;
}

const cache = new Map<string, Portrait>();

export function heroPortrait(type: TowerTypeId, level: number): Portrait {
  const key = `${type}:${level}`;
  let p = cache.get(key);
  if (!p) {
    const art = heroTower(type, level);
    p = { url: bitmapUrl(art), width: art.w, height: art.h };
    cache.set(key, p);
  }
  return p;
}

/** Shows a portrait in an <img>, `scale` screen pixels per art pixel. */
export function showPortrait(img: HTMLImageElement, p: Portrait, scale: number): void {
  if (img.getAttribute('src') !== p.url) img.src = p.url;
  img.width = p.width * scale;
  img.height = p.height * scale;
}

function bitmapUrl(b: Bitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width = b.w;
  canvas.height = b.h;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(b.data), b.w, b.h), 0, 0);
  return canvas.toDataURL();
}
