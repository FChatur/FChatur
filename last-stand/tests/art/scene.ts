import { blank, blit, ellipse, flipX, type Bitmap } from '../../src/art/bitmap';
import { COLORS } from '../../src/art/palette';
import { creatureFrames } from '../../src/art/sprites/creatures';
import { towerPortrait } from '../../src/art/sprites/towers';
import { ART_TILE, paintTerrain } from '../../src/art/terrain';
import { MAPS } from '../../src/config/maps';
import { TILE_SIZE } from '../../src/config/map';
import { Path } from '../../src/core/Path';

/** A still of the battlefield with some towers and creatures, for judging composition and readability. */
export function sceneStill(margin = 3): Bitmap {
  const map = MAPS.switchback;
  const path = Path.fromWaypoints(map.waypoints, map.grid);
  const k = TILE_SIZE / ART_TILE;
  const t = paintTerrain({
    cols: map.grid.cols,
    rows: map.grid.rows,
    margin,
    road: path.points.map((p) => ({ x: p.x / k, y: p.y / k })),
    seed: 7,
  });
  const img = t.image;
  const sprites: { x: number; y: number; art: Bitmap; shadow?: number }[] = [];
  const tower = (type: 'basic' | 'sniper' | 'rapid' | 'frost', level: number, col: number, row: number) => {
    const art = towerPortrait(type, level);
    sprites.push({ x: t.originX + col * 16 + Math.floor((16 - art.w) / 2), y: t.originY + row * 16 + 15 - art.h, art, shadow: 14 });
  };
  tower('basic', 1, 3, 3);
  tower('basic', 3, 5, 5);
  tower('rapid', 2, 5, 7);
  tower('frost', 3, 8, 5);
  tower('sniper', 3, 12, 6);
  tower('rapid', 3, 10, 2);
  tower('frost', 1, 15, 8);
  tower('sniper', 1, 13, 10);
  tower('basic', 2, 16, 5);
  const frames = creatureFrames();
  const along = (d: number) => path.positionAt(d * TILE_SIZE);
  const creature = (name: string, frame: number, d: number) => {
    const p = along(d);
    const next = along(d + 0.2);
    let art = frames[name][frame];
    if (next.x < p.x) art = flipX(art);
    sprites.push({ x: t.originX + Math.round(p.x / k - art.w / 2), y: t.originY + Math.round(p.y / k + 5 - art.h), art, shadow: art.w - 2 });
  };
  creature('goblin-walk', 0, 2);
  creature('goblin-walk', 2, 3.2);
  creature('wolf-run', 1, 6);
  creature('goblin-walk', 1, 8.5);
  creature('orc-walk', 0, 11);
  creature('goblin-walk', 3, 14);
  creature('wolf-run', 3, 17);
  creature('orc-walk', 2, 21);
  creature('goblin-walk', 0, 24);
  creature('ogre-walk', 0, 28);
  creature('goblin-walk', 2, 33);
  creature('wolf-run', 0, 36);
  sprites.sort((a, b) => a.y + a.art.h - (b.y + b.art.h));
  for (const s of sprites) {
    if (s.shadow) {
      const sh = blank(img.w, img.h);
      ellipse(sh, s.x + s.art.w / 2, s.y + s.art.h - 1, s.shadow / 2, 2, COLORS.grass1);
      darken(img, sh);
    }
    blit(img, s.art, s.x, s.y);
  }
  return img;
}

/** Applies a shadow mask by darkening what's underneath (preview only; the game uses alpha). */
function darken(img: Bitmap, mask: Bitmap): void {
  for (let i = 0; i < img.data.length; i += 4) {
    if (mask.data[i + 3] === 0) continue;
    img.data[i] = img.data[i] * 0.7;
    img.data[i + 1] = img.data[i + 1] * 0.7;
    img.data[i + 2] = img.data[i + 2] * 0.75;
  }
}
