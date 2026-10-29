import { blank, blit, ellipse, type Bitmap } from '../../src/art/bitmap';
import { textBitmap } from '../../src/art/font';
import { COLORS } from '../../src/art/palette';
import { creatureFrames } from '../../src/art/sprites/creatures';
import { heroTower } from '../../src/art/sprites/characters';
import { paintTerrain } from '../../src/art/terrain';

/** Every tower at every level and every creature, on meadow ground, labelled: the review lineup. */
export function showcase(): Bitmap {
  const W = 16 * 16;
  const H = 16 * 10;
  // Meadow ground with no road in view.
  const ground = paintTerrain({ cols: 16, rows: 10, margin: 0, road: [{ x: -400, y: -400 }, { x: -380, y: -400 }], seed: 3 }).image;
  const img = blit(blank(W, H), ground, 0, 0);
  const shadow = (cx: number, base: number, w: number) => {
    const s = blank(W, H);
    ellipse(s, cx, base - 1, w / 2, Math.max(1.5, w / 6), 1);
    for (let i = 0; i < img.data.length; i += 4) {
      if (s.data[i + 3] === 0) continue;
      img.data[i] *= 0.68;
      img.data[i + 1] *= 0.68;
      img.data[i + 2] *= 0.75;
    }
  };
  const label = (text: string, x: number, y: number) => {
    const t = textBitmap(text, COLORS.white0);
    blit(img, t, Math.round(x - t.w / 2), y);
  };
  const towers: [Parameters<typeof heroTower>[0], string][] = [
    ['basic', 'ARCHER'],
    ['rapid', 'RANGER'],
    ['sniper', 'BALLISTA'],
    ['frost', 'FROST MAGE'],
  ];
  towers.forEach(([type, name], i) => {
    const gx = (i % 2) * 128;
    const gy = i < 2 ? 0 : 56;
    label(name, gx + 64, gy + 3);
    for (let level = 1; level <= 3; level++) {
      const art = heroTower(type, level);
      const cx = gx + 22 + (level - 1) * 40;
      const base = gy + 50;
      shadow(cx, base, 18);
      blit(img, art, Math.round(cx - art.w / 2), base - art.h);
    }
  });
  const frames = creatureFrames();
  label('GOBLIN   WOLF   ARMORED ORC   OGRE WARLORD', W / 2, 114);
  const creatures: [string, number][] = [['goblin-walk', 40], ['wolf-run', 84], ['orc-walk', 132], ['ogre-walk', 200]];
  for (const [name, cx] of creatures) {
    for (const [i, dx] of [[0, -12], [2, 12]] as const) {
      const art = frames[name][i];
      const x = name === 'ogre-walk' ? cx + (i === 0 ? -16 : 16) : cx + dx;
      shadow(x, 156, art.w - 2);
      blit(img, art, Math.round(x - art.w / 2), 156 - art.h);
    }
  }
  return img;
}
