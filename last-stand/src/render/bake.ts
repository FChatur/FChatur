import Phaser from 'phaser';

/**
 * Static vector art (board, tower bases, enemy bodies) is drawn once into a texture instead of being
 * re-tessellated by Phaser every frame. Textures are rasterised at the current camera zoom (device
 * pixels per world pixel), so each texel maps to one screen pixel and the result is as crisp as the
 * vector version. When the zoom changes (resize, display scaling), callers re-bake at the new scale.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  /** Size in world pixels. */
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  /** Draw with (0, 0) at the texture's centre instead of its top-left corner. */
  centered = false,
): string {
  const scale = scene.cameras.main.zoom;
  const fullKey = `${key}@${scale.toFixed(4)}`;
  if (!scene.textures.exists(fullKey)) {
    const g = scene.make.graphics(undefined, false);
    g.scaleCanvas(scale, scale);
    if (centered) g.translateCanvas(width / 2, height / 2);
    draw(g);
    g.generateTexture(fullKey, Math.ceil(width * scale), Math.ceil(height * scale));
    g.destroy();
  }
  return fullKey;
}

/** An image of a baked texture, displayed at world size (texels map 1:1 to device pixels). */
export function bakedImage(scene: Phaser.Scene, x: number, y: number, textureKey: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, textureKey).setScale(1 / scene.cameras.main.zoom);
}

/** Frees baked textures that were made for a scale other than the current one. */
export function pruneBakedTextures(scene: Phaser.Scene): void {
  const current = `@${scene.cameras.main.zoom.toFixed(4)}`;
  for (const key of scene.textures.getTextureKeys()) {
    if (key.includes('@') && !key.endsWith(current)) scene.textures.remove(key);
  }
}
