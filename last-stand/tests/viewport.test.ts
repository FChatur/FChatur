import { describe, expect, it } from 'vitest';
import { computeViewport, mapScreenRect } from '../src/render/viewport';

// Switchback: 20 × 12 tiles of 16 art pixels; tiles are 48 world units, so 3 world units per art pixel.
const map = { mapArtWidth: 320, mapArtHeight: 192, worldPerArt: 3 };

describe('computeViewport', () => {
  const cases = [
    { label: '1080p at 100%', cssWidth: 1660, cssHeight: 820, devicePixelRatio: 1 },
    { label: '1440p at 100%', cssWidth: 2300, cssHeight: 1180, devicePixelRatio: 1 },
    { label: '1440p at 125% scaling', cssWidth: 1830, cssHeight: 890, devicePixelRatio: 1.25 },
    { label: '4K laptop at 150%', cssWidth: 1500, cssHeight: 700, devicePixelRatio: 1.5 },
    { label: 'browser zoom 110%', cssWidth: 1520, cssHeight: 745, devicePixelRatio: 1.1 },
    { label: 'small laptop', cssWidth: 1100, cssHeight: 560, devicePixelRatio: 1 },
  ];

  for (const c of cases) {
    it(`renders crisp, whole art pixels: ${c.label}`, () => {
      const v = computeViewport({ ...c, ...map });
      // The backing buffer covers exactly the device pixels shown: no browser stretching.
      expect(v.displayWidth * v.devicePixelRatio).toBeCloseTo(v.bufferWidth, 6);
      expect(v.displayHeight * v.devicePixelRatio).toBeCloseTo(v.bufferHeight, 6);
      // Every art pixel is the same whole number of device pixels, and so is every tile.
      expect(Number.isInteger(v.artScale)).toBe(true);
      expect(v.scale * map.worldPerArt).toBe(v.artScale);
      // The map sits on whole device pixels, centred, and fits inside the canvas.
      expect(Number.isInteger(v.mapX) && Number.isInteger(v.mapY)).toBe(true);
      expect(v.mapX * 2 + map.mapArtWidth * v.artScale).toBeLessThanOrEqual(v.bufferWidth + 1);
      expect(v.mapY * 2 + map.mapArtHeight * v.artScale).toBeLessThanOrEqual(v.bufferHeight + 1);
      // The largest whole scale that fits: one step more would not.
      const availW = Math.floor(c.cssWidth * c.devicePixelRatio);
      const availH = Math.floor(c.cssHeight * c.devicePixelRatio);
      expect(map.mapArtWidth * (v.artScale + 1) > availW || map.mapArtHeight * (v.artScale + 1) > availH).toBe(true);
      // The canvas fills the available space (scenery shows around the map).
      expect(v.displayWidth).toBeLessThanOrEqual(c.cssWidth);
      expect(c.cssWidth - v.displayWidth).toBeLessThan(1);
    });
  }

  it('uses more device pixels on high-DPI screens instead of stretching', () => {
    const lo = computeViewport({ cssWidth: 1300, cssHeight: 800, devicePixelRatio: 1, ...map });
    const hi = computeViewport({ cssWidth: 1300, cssHeight: 800, devicePixelRatio: 2, ...map });
    expect(hi.bufferWidth).toBe(lo.bufferWidth * 2);
    expect(hi.artScale).toBe(lo.artScale * 2);
    expect(hi.displayWidth).toBeCloseTo(lo.displayWidth, 6);
  });

  it('never distorts: both axes always use the same scale', () => {
    for (const [w, h] of [[2000, 400], [500, 1600], [1300, 800]]) {
      const v = computeViewport({ cssWidth: w, cssHeight: h, devicePixelRatio: 1, ...map });
      const rect = mapScreenRect(v, { left: 0, top: 0 }, 960, 576);
      expect(rect.width / rect.height).toBeCloseTo(960 / 576, 6);
    }
  });

  it('stays usable in tiny or degenerate containers', () => {
    const v = computeViewport({ cssWidth: 0, cssHeight: 0, devicePixelRatio: 0, ...map });
    expect(v.artScale).toBe(1);
    expect(v.bufferWidth).toBe(320);
    expect(v.devicePixelRatio).toBe(1);
  });

  it('maps the map rectangle to page coordinates', () => {
    const v = computeViewport({ cssWidth: 1660, cssHeight: 820, devicePixelRatio: 1, ...map });
    const rect = mapScreenRect(v, { left: 220, top: 60 }, 960, 576);
    expect(rect.left).toBe(220 + v.mapX);
    expect(rect.width).toBe(320 * v.artScale);
  });
});
