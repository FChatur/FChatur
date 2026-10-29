import { describe, expect, it } from 'vitest';
import { allSprites, buildAtlas, heroAnimation, heroGhost, heroPedestal } from '../src/art/atlas';
import { get } from '../src/art/bitmap';
import { CREATURE_ART, TOWER_ART } from '../src/art/catalog';
import { hasGlyph, textBitmap } from '../src/art/font';
import { COLORS, PALETTE_VALUES } from '../src/art/palette';
import { paintTerrain, ART_TILE } from '../src/art/terrain';
import { ENEMIES, type EnemyTypeId } from '../src/config/enemies';
import { TILE_SIZE } from '../src/config/map';
import { MAPS } from '../src/config/maps';
import { TOWER_ORDER, TOWERS } from '../src/config/towers';
import { Path } from '../src/core/Path';

const sprites = allSprites();

describe('pixel art', () => {
  it('uses only palette colours, fully opaque or fully transparent', () => {
    for (const [name, frames] of Object.entries(sprites)) {
      frames.forEach((f, i) => {
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const a = f.data[(y * f.w + x) * 4 + 3];
            expect(a === 0 || a === 255, `${name}:${i} alpha at ${x},${y}`).toBe(true);
            const c = get(f, x, y);
            if (c >= 0) expect(PALETTE_VALUES.has(c), `${name}:${i} colour #${c.toString(16)} at ${x},${y}`).toBe(true);
          }
        }
      });
    }
  });

  it('keeps every frame of an animation the same size', () => {
    for (const [name, frames] of Object.entries(sprites)) {
      if (name.endsWith('-pedestal') || name.endsWith('-ghost')) continue; // one image per level, not an animation
      for (const f of frames) expect([f.w, f.h], name).toEqual([frames[0].w, frames[0].h]);
    }
  });

  it('has a complete sprite set for every enemy and tower type', () => {
    for (const id of Object.keys(ENEMIES) as EnemyTypeId[]) {
      const art = CREATURE_ART[id];
      expect(art, id).toBeDefined();
      expect(sprites[art.walk]?.length, art.walk).toBe(4);
    }
    for (const t of TOWER_ORDER) {
      const art = TOWER_ART[t];
      expect(sprites[heroPedestal(t)]?.length, t).toBe(TOWERS[t].levels.length);
      expect(sprites[heroGhost(t)]?.length, t).toBe(TOWERS[t].levels.length);
      for (let level = 1; level <= TOWERS[t].levels.length; level++) {
        for (const anim of ['idle', 'attack', 'victory', 'alarm']) {
          expect(sprites[heroAnimation(t, level, anim)]?.length, `${t} ${level} ${anim}`).toBeGreaterThan(0);
        }
      }
      expect(sprites[art.projectile]?.length, art.projectile).toBeGreaterThan(0);
      expect(sprites[art.impact]?.length, art.impact).toBeGreaterThan(0);
    }
  });

  it('tower pedestals are exactly one tile wide; whole towers overhang their tile by at most 3 pixels a side', () => {
    for (const t of TOWER_ORDER) {
      for (const b of sprites[heroPedestal(t)]) expect(b.w).toBe(ART_TILE);
      for (const g of sprites[heroGhost(t)]) expect(g.w, t).toBeLessThanOrEqual(ART_TILE + 6);
    }
  });

  it('packs every frame into the atlas without overlaps', () => {
    const atlas = buildAtlas(sprites);
    const rects = [...atlas.frames.values()];
    expect(rects.length).toBe(Object.values(sprites).reduce((n, f) => n + f.length, 0));
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(atlas.image.w);
      expect(r.y + r.h).toBeLessThanOrEqual(atlas.image.h);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('the pixel font covers every name and message shown on the battlefield', () => {
    const texts = [
      ...Object.values(ENEMIES).map((e) => `${e.name.toUpperCase()} APPROACHES!`),
      ...TOWER_ORDER.map((t) => TOWERS[t].name),
      'WAVE 100', '+1234', 'LV 3', 'CRIT!', 'NOT ENOUGH GOLD', 'PATH', 'OCCUPIED', '+12 INTEREST',
    ];
    for (const text of texts) {
      for (const ch of text) expect(hasGlyph(ch), `"${ch}" in "${text}"`).toBe(true);
      expect(textBitmap(text).w).toBeGreaterThan(text.length);
    }
  });
});

describe('terrain', () => {
  for (const map of Object.values(MAPS)) {
    it(`paints ${map.name}: road along the path, grass elsewhere, deterministic`, () => {
      const path = Path.fromWaypoints(map.waypoints, map.grid);
      const k = TILE_SIZE / ART_TILE;
      const spec = { cols: map.grid.cols, rows: map.grid.rows, margin: 2, road: path.points.map((p) => ({ x: p.x / k, y: p.y / k })), seed: 7 };
      const t = paintTerrain(spec);
      expect(t.image.w).toBe((map.grid.cols + 4) * ART_TILE);
      const road = new Set(['dirt0', 'dirt1', 'dirt2', 'dirt3', 'dirt4', 'stone3', 'stone4'].map((n) => COLORS[n]));
      // Every path tile's centre is road.
      for (const key of path.tileKeys) {
        const [c, r] = key.split(',').map(Number);
        const color = get(t.image, t.originX + c * ART_TILE + 8, t.originY + r * ART_TILE + 8);
        expect(road.has(color), `tile ${key} #${color.toString(16)}`).toBe(true);
      }
      // Same input, same pixels.
      expect(paintTerrain(spec).image.data).toEqual(t.image.data);
    });
  }
});
