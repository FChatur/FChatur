import Phaser from 'phaser';
import { paintTerrain, type Terrain } from '../art/terrain';
import type { MapConfig } from '../config/maps';
import type { Path } from '../core/Path';
import { ART_SCALE, bitmapTexture } from './pixel';
import { DEPTH } from './palette';

export interface BoardView {
  destroy(): void;
}

/** Tiles of scenery painted around the map; beyond that the camera background shows. */
const SCENERY_MARGIN = 14;

const terrains = new Map<string, Terrain>();

/** The painted battlefield for a map (generated once; it is resolution-independent art). */
export function terrainFor(map: MapConfig, path: Path): Terrain {
  let t = terrains.get(map.id);
  if (!t) {
    t = paintTerrain({
      cols: map.grid.cols,
      rows: map.grid.rows,
      margin: SCENERY_MARGIN,
      road: path.points.map((p) => ({ x: p.x / ART_SCALE, y: p.y / ART_SCALE })),
      seed: 7,
    });
    terrains.set(map.id, t);
  }
  return t;
}

/**
 * Draws the static battlefield: grass, road, scenery, the cave the enemies come from and the gate they
 * attack. One texture at art resolution, scaled by whole pixels, so it never needs redrawing on resize.
 */
export function drawBoard(scene: Phaser.Scene, map: MapConfig, path: Path): BoardView {
  const terrain = terrainFor(map, path);
  const key = bitmapTexture(scene, `terrain:${map.id}`, () => terrain.image);
  const image = scene.add
    .image(-terrain.originX * ART_SCALE, -terrain.originY * ART_SCALE, key)
    .setOrigin(0, 0)
    .setScale(ART_SCALE)
    .setDepth(DEPTH.terrain);
  return { destroy: () => image.destroy() };
}
