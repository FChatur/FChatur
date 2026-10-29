/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { creatureFrames } from '../../src/art/sprites/creatures';
import { towerArt, towerPortrait } from '../../src/art/sprites/towers';
import { effectFrames, explosionFrames } from '../../src/art/sprites/effects';
import { projectileFrames } from '../../src/art/sprites/projectiles';
import { textBitmap } from '../../src/art/font';
import { COLORS } from '../../src/art/palette';
import { TOWER_ORDER } from '../../src/config/towers';
import { encodePng } from './png';
import { sceneStill } from './scene';
import { showcase } from './showcase';
import { contactSheet } from './sheet';

// `npm run art`: writes art-preview/*.png (enlarged) for reviewing sprites.
it('art preview', () => {
  const out = process.env.ART_OUT ?? 'art-preview';
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/creatures.png`, encodePng(contactSheet(creatureFrames()), 8));
  const towers: Record<string, ReturnType<typeof towerPortrait>[]> = {};
  const art = towerArt();
  for (const t of TOWER_ORDER) {
    towers[`${t}-portraits`] = [1, 2, 3].map((l) => towerPortrait(t, l));
    for (const [name, frames] of Object.entries(art[t].defender)) towers[`${t}-${name}`] = frames;
  }
  writeFileSync(`${out}/towers.png`, encodePng(contactSheet(towers), 6));
  writeFileSync(`${out}/scene.png`, encodePng(sceneStill(), 3));
  writeFileSync(`${out}/showcase.png`, encodePng(showcase(), 4));
  for (const t of TOWER_ORDER) writeFileSync(`${out}/portrait-${t}.png`, encodePng(towerPortrait(t, 1), 4));
  const fx: Record<string, ReturnType<typeof explosionFrames>> = { ...projectileFrames(), ...effectFrames(), explosion: explosionFrames(14) };
  fx.text = [textBitmap('WAVE 12', COLORS.white0), textBitmap('+25', COLORS.gold3), textBitmap('LV 2', COLORS.frost4), textBitmap('OGRE WARLORD APPROACHES!', COLORS.red3), textBitmap('0123456789 ABCDEFGHIJKLM NOPQRSTUVWXYZ +-!%:/?')];
  writeFileSync(`${out}/effects.png`, encodePng(contactSheet(fx), 6));
});
