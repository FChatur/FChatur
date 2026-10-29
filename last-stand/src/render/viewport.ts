/**
 * Canvas sizing for crisp pixel art at any window size, display scaling or browser zoom.
 *
 * The canvas fills the available space and its backing buffer is sized in *device* pixels, so the browser
 * never stretches it. The map is drawn at a whole number of device pixels per art pixel (`artScale`), so
 * every art pixel is an identical square: no blur, no uneven pixels. The map is centred on whole device
 * pixels; the space around it shows scenery instead of letterboxing.
 */

export interface ViewportInput {
  /** Available space in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  /** Map size in art pixels. */
  mapArtWidth: number;
  mapArtHeight: number;
  /** World units per art pixel (tile size / art pixels per tile). */
  worldPerArt: number;
}

export interface Viewport {
  /** Canvas backing-buffer size in device pixels (the whole available area). */
  bufferWidth: number;
  bufferHeight: number;
  /** Device pixels per art pixel: always a whole number. */
  artScale: number;
  /** Device pixels per world unit (the camera zoom). */
  scale: number;
  /** The map's top-left corner within the canvas, in whole device pixels. */
  mapX: number;
  mapY: number;
  /** On-screen canvas size in CSS pixels. */
  displayWidth: number;
  displayHeight: number;
  devicePixelRatio: number;
}

/** Keeps the backing buffer sane on very high-DPI screens. */
const MAX_DEVICE_PIXEL_RATIO = 3;

export function clampPixelRatio(dpr: number): number {
  return Math.min(Math.max(dpr || 1, 1), MAX_DEVICE_PIXEL_RATIO);
}

export function computeViewport(input: ViewportInput): Viewport {
  const dpr = clampPixelRatio(input.devicePixelRatio);
  const availW = Math.floor(Math.max(0, input.cssWidth) * dpr);
  const availH = Math.floor(Math.max(0, input.cssHeight) * dpr);
  const artScale = Math.max(1, Math.floor(Math.min(availW / input.mapArtWidth, availH / input.mapArtHeight)));
  const mapW = input.mapArtWidth * artScale;
  const mapH = input.mapArtHeight * artScale;
  // The canvas covers the whole area (or the map, if the area is smaller than the map at 1×).
  const bufferWidth = Math.max(availW, mapW);
  const bufferHeight = Math.max(availH, mapH);
  return {
    bufferWidth,
    bufferHeight,
    artScale,
    scale: artScale / input.worldPerArt,
    mapX: Math.floor((bufferWidth - mapW) / 2),
    mapY: Math.floor((bufferHeight - mapH) / 2),
    displayWidth: bufferWidth / dpr,
    displayHeight: bufferHeight / dpr,
    devicePixelRatio: dpr,
  };
}

/** The map's rectangle on the page (CSS pixels), given the canvas's on-page box. */
export function mapScreenRect(v: Viewport, canvasBox: { left: number; top: number }, worldWidth: number, worldHeight: number) {
  return {
    left: canvasBox.left + v.mapX / v.devicePixelRatio,
    top: canvasBox.top + v.mapY / v.devicePixelRatio,
    width: (worldWidth * v.scale) / v.devicePixelRatio,
    height: (worldHeight * v.scale) / v.devicePixelRatio,
  };
}
