/**
 * Canvas sizing for crisp rendering at any window size, display scaling or browser zoom.
 *
 * The canvas backing buffer is sized in *device* pixels (CSS size × devicePixelRatio) so the browser
 * never stretches it, and the world is drawn into it with a camera zoom. The zoom is snapped so one tile
 * covers a whole number of device pixels, which keeps grid lines and shape edges sharp; the small
 * remainder becomes letterboxing. The canvas is also placed on whole device pixels, because an
 * off-pixel position makes the browser resample (blur) the whole image.
 */

export interface ViewportInput {
  /** Available space in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  /** World size in world pixels, and the tile size to align to. */
  worldWidth: number;
  worldHeight: number;
  tileSize: number;
}

export interface Viewport {
  /** Canvas backing-buffer size in device pixels. */
  bufferWidth: number;
  bufferHeight: number;
  /** Device pixels per world pixel (the camera zoom). */
  scale: number;
  /** On-screen canvas size and offset within the available space, in CSS pixels. */
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  devicePixelRatio: number;
}

/** Keeps the backing buffer sane on very high-DPI or tiny windows. */
const MAX_DEVICE_PIXEL_RATIO = 3;
const MIN_PIXELS_PER_TILE = 8;

export function computeViewport(input: ViewportInput): Viewport {
  const dpr = Math.min(Math.max(input.devicePixelRatio || 1, 1), MAX_DEVICE_PIXEL_RATIO);
  const availW = Math.max(0, input.cssWidth) * dpr;
  const availH = Math.max(0, input.cssHeight) * dpr;
  const fit = Math.min(availW / input.worldWidth, availH / input.worldHeight);
  // Whole device pixels per tile.
  const pixelsPerTile = Math.max(MIN_PIXELS_PER_TILE, Math.floor(fit * input.tileSize));
  const scale = pixelsPerTile / input.tileSize;
  const bufferWidth = Math.round(input.worldWidth * scale);
  const bufferHeight = Math.round(input.worldHeight * scale);
  // Centre, rounding the offset to whole device pixels.
  const offsetX = Math.max(0, Math.round((availW - bufferWidth) / 2)) / dpr;
  const offsetY = Math.max(0, Math.round((availH - bufferHeight) / 2)) / dpr;
  return {
    bufferWidth,
    bufferHeight,
    scale,
    displayWidth: bufferWidth / dpr,
    displayHeight: bufferHeight / dpr,
    offsetX,
    offsetY,
    devicePixelRatio: dpr,
  };
}
