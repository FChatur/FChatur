import { blank, blit, ellipse, flipX, rect, type Bitmap } from '../../src/art/bitmap';
import { frameKey } from '../../src/art/atlas';
import { textBitmap } from '../../src/art/font';
import { COLORS } from '../../src/art/palette';
import { heroTower, type TowerKind } from '../../src/art/sprites/characters';
import { creatureFrames } from '../../src/art/sprites/creatures';
import { effectFrames } from '../../src/art/sprites/effects';
import { projectileFrames, directionIndex, PROJECTILE_DIRECTIONS } from '../../src/art/sprites/projectiles';
import { ART_TILE, paintTerrain } from '../../src/art/terrain';
import { TILE_SIZE } from '../../src/config/map';
import { MAPS } from '../../src/config/maps';
import { Path } from '../../src/core/Path';

void frameKey;

/**
 * A crowded late-wave still composed from the real terrain, hero towers, creatures and effects (issue #2
 * mockup). Shows the proposed declutter rules: thin health bars only on damaged enemies, damage numbers
 * only for heavy hits, few particles. `cropX` trims the forest margin at each side.
 */
export function combatStill(cropX = 32): Bitmap {
  const map = MAPS.switchback;
  const path = Path.fromWaypoints(map.waypoints, map.grid);
  const k = TILE_SIZE / ART_TILE;
  const margin = 3;
  const t = paintTerrain({ cols: map.grid.cols, rows: map.grid.rows, margin, road: path.points.map((p) => ({ x: p.x / k, y: p.y / k })), seed: 7 });
  const img = t.image;
  const ox = t.originX;
  const oy = t.originY;
  const sprites: { x: number; y: number; art: Bitmap; shadow?: number }[] = [];
  const overlays: { x: number; y: number; art: Bitmap }[] = [];

  const tower = (kind: TowerKind, level: number, col: number, row: number, anim: 'idle' | 'attack' | 'victory', frame: number, dir = 1) => {
    const art = heroTower(kind, level, anim, frame, dir);
    sprites.push({ x: ox + col * 16 + Math.floor((16 - art.w) / 2), y: oy + row * 16 + 16 - art.h, art, shadow: 16 });
  };
  tower('basic', 2, 3, 3, 'attack', 0);
  tower('rapid', 1, 5, 5, 'attack', 1);
  tower('frost', 2, 3, 6, 'attack', 1);
  tower('sniper', 3, 7, 4, 'attack', 2, 3);
  tower('basic', 3, 8, 7, 'attack', 0);
  tower('rapid', 3, 10, 4, 'attack', 0);
  tower('frost', 3, 13, 6, 'idle', 1);
  tower('basic', 1, 15, 8, 'idle', 0);
  tower('sniper', 2, 12, 10, 'idle', 0, 6);
  tower('rapid', 2, 15, 4, 'attack', 1);
  tower('basic', 1, 10, 2, 'idle', 2);

  const creatures = creatureFrames();
  const along = (d: number) => path.positionAt(d * TILE_SIZE);
  const enemy = (name: string, frame: number, d: number, hp: number, slowed = false) => {
    const p = along(d);
    const next = along(d + 0.2);
    let art = creatures[name][frame];
    if (next.x < p.x) art = flipX(art);
    const x = ox + Math.round(p.x / k - art.w / 2);
    const y = oy + Math.round(p.y / k + 5 - art.h);
    sprites.push({ x, y, art, shadow: art.w - 2 });
    // Proposed health bar: 1 px fill in a 1 px frame, only when damaged, kept short.
    if (hp < 1) {
      const w = Math.min(12, art.w - 4);
      const bar = blank(w + 2, 3);
      rect(bar, 0, 0, w + 2, 3, COLORS.ink0);
      rect(bar, 1, 1, Math.max(1, Math.round(w * hp)), 1, hp > 0.6 ? COLORS.grass4 : hp > 0.3 ? COLORS.gold3 : COLORS.red3);
      overlays.push({ x: x + Math.round(art.w / 2 - w / 2 - 1), y: y - 4, art: bar });
    }
    if (slowed) overlays.push({ x: x + art.w - 3, y: y - 5, art: effectFrames().snowflake[0] });
  };
  enemy('goblin-walk', 0, 1.6, 0.4);
  enemy('goblin-walk', 2, 2.5, 1);
  enemy('wolf-run', 1, 3.6, 0.7);
  enemy('orc-walk', 1, 5.2, 0.85);
  enemy('goblin-walk', 3, 6.2, 0.55, true);
  enemy('orc-walk', 3, 7.1, 0.3, true);
  enemy('goblin-walk', 1, 8.0, 1, true);
  enemy('wolf-run', 2, 9.4, 0.2, true);
  enemy('goblin-walk', 0, 10.6, 0.9);
  enemy('orc-walk', 0, 12.2, 0.6);
  enemy('goblin-walk', 2, 13.1, 1);
  enemy('wolf-run', 3, 14.6, 0.5);
  enemy('ogre-walk', 1, 17.2, 0.45);
  enemy('goblin-walk', 3, 19.5, 0.75);
  enemy('goblin-walk', 1, 20.3, 1);
  enemy('wolf-run', 0, 22.4, 0.9);

  sprites.sort((a, b) => a.y + a.art.h - (b.y + b.art.h));
  for (const s of sprites) {
    if (s.shadow) {
      const sh = blank(img.w, img.h);
      ellipse(sh, s.x + s.art.w / 2, s.y + s.art.h - 1, s.shadow / 2, 2, 1);
      for (let i = 0; i < img.data.length; i += 4) if (sh.data[i + 3]) (img.data[i] *= 0.68), (img.data[i + 1] *= 0.68), (img.data[i + 2] *= 0.74);
    }
    blit(img, s.art, s.x, s.y);
  }
  // Projectiles in flight and a few impacts.
  const proj = projectileFrames();
  const shot = (name: string, x0: number, y0: number, x1: number, y1: number, tt: number) => {
    const dir = directionIndex(Math.atan2(y1 - y0, x1 - x0), PROJECTILE_DIRECTIONS);
    const art = name === 'shard' ? proj.shard[0] : proj[name][dir];
    overlays.push({ x: ox + Math.round(x0 + (x1 - x0) * tt - art.w / 2), y: oy + Math.round(y0 + (y1 - y0) * tt - art.h / 2), art });
  };
  shot('arrow', 56, 52, 70, 40, 0.5);
  shot('ranger-arrow', 88, 86, 74, 104, 0.4);
  shot('ranger-arrow', 168, 70, 150, 54, 0.6);
  shot('bolt', 120, 70, 228, 150, 0.55);
  shot('shard', 56, 100, 70, 128, 0.5);
  const fx = effectFrames();
  overlays.push({ x: ox + 220, y: oy + 136, art: fx['heavy-impact'][1] });
  overlays.push({ x: ox + 64, y: oy + 124, art: fx['frost-burst'][1] });
  overlays.push({ x: ox + 70, y: oy + 34, art: fx['hit-spark'][1] });
  overlays.push({ x: ox + 223, y: oy + 125, art: textBitmap('482', COLORS.white0) });
  for (const o of overlays) blit(img, o.art, o.x, o.y);
  // Crop to the map plus a little scenery.
  const crop = blank(img.w - 2 * cropX, img.h - 2 * 40);
  return blit(crop, img, -cropX, -40);
}
