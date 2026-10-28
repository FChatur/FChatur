import { describe, expect, it } from 'vitest';
import { computeViewport } from '../src/render/viewport';

const world = { worldWidth: 960, worldHeight: 576, tileSize: 48 };

describe('computeViewport', () => {
  const cases = [
    { label: '1080p at 100%', cssWidth: 1896, cssHeight: 805, devicePixelRatio: 1 },
    { label: '1440p at 100%', cssWidth: 2536, cssHeight: 1165, devicePixelRatio: 1 },
    { label: '1440p at 125% scaling', cssWidth: 2024, cssHeight: 876, devicePixelRatio: 1.25 },
    { label: '4K laptop at 150%', cssWidth: 1683, cssHeight: 684, devicePixelRatio: 1.5 },
    { label: 'browser zoom 110%', cssWidth: 1724, cssHeight: 732, devicePixelRatio: 1.1 },
  ];

  for (const c of cases) {
    it(`renders 1:1 with whole-pixel tiles: ${c.label}`, () => {
      const v = computeViewport({ ...c, ...world });
      // The backing buffer covers exactly the device pixels shown: no browser stretching.
      expect(v.displayWidth * v.devicePixelRatio).toBeCloseTo(v.bufferWidth, 6);
      expect(v.displayHeight * v.devicePixelRatio).toBeCloseTo(v.bufferHeight, 6);
      // Each tile is a whole number of device pixels.
      expect(Number.isInteger(v.scale * world.tileSize)).toBe(true);
      // The canvas sits on whole device pixels.
      expect(Number.isInteger(Math.round(v.offsetX * v.devicePixelRatio * 1e6) / 1e6)).toBe(true);
      expect(Number.isInteger(Math.round(v.offsetY * v.devicePixelRatio * 1e6) / 1e6)).toBe(true);
      // It fits, keeps the aspect ratio, and wastes less than one tile per axis.
      expect(v.displayWidth).toBeLessThanOrEqual(c.cssWidth);
      expect(v.displayHeight).toBeLessThanOrEqual(c.cssHeight);
      expect(v.bufferWidth / v.bufferHeight).toBeCloseTo(960 / 576, 6);
      const fit = Math.min((c.cssWidth * c.devicePixelRatio) / 960, (c.cssHeight * c.devicePixelRatio) / 576);
      expect(fit - v.scale).toBeLessThan(1 / world.tileSize + 1e-9);
    });
  }

  it('uses more device pixels on high-DPI screens instead of stretching', () => {
    const lo = computeViewport({ cssWidth: 1200, cssHeight: 720, devicePixelRatio: 1, ...world });
    const hi = computeViewport({ cssWidth: 1200, cssHeight: 720, devicePixelRatio: 2, ...world });
    expect(hi.bufferWidth).toBe(lo.bufferWidth * 2);
    expect(hi.displayWidth).toBeCloseTo(lo.displayWidth, 6);
  });

  it('stays usable in tiny or degenerate containers', () => {
    const v = computeViewport({ cssWidth: 0, cssHeight: 0, devicePixelRatio: 0, ...world });
    expect(v.bufferWidth).toBeGreaterThan(0);
    expect(v.devicePixelRatio).toBe(1);
  });
});
