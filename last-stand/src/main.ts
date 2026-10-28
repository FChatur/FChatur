import Phaser from 'phaser';
import { DEFAULT_MAP } from './config/maps';
import { GameSession } from './game/GameSession';
import { PALETTE } from './render/palette';
import { clampPixelRatio, computeViewport, type Viewport } from './render/viewport';
import { GameScene, type GameSceneData } from './scenes/GameScene';
import { Sfx } from './audio/Sfx';
import { Hud } from './ui/Hud';
import './style.css';

const session = new GameSession();

// Rendering: the canvas buffer matches the device pixels it covers (see render/viewport.ts), so the
// browser never stretches it. The world is fitted in with the camera zoom (GameScene.applyViewport).
const container = document.getElementById('game-container')!;
const { grid } = DEFAULT_MAP;
const viewportInput = () => ({
  cssWidth: container.clientWidth,
  cssHeight: container.clientHeight,
  devicePixelRatio: window.devicePixelRatio,
  worldWidth: grid.cols * grid.tileSize,
  worldHeight: grid.rows * grid.tileSize,
  tileSize: grid.tileSize,
});
const measure = (): Viewport => computeViewport(viewportInput());
let viewport = measure();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  width: viewport.bufferWidth,
  height: viewport.bufferHeight,
  backgroundColor: PALETTE.background,
  // Smooth vector art: Phaser switches to pixel-art mode (no antialiasing, snapped positions) whenever
  // the canvas zoom isn't 1, so these are set explicitly.
  render: { antialias: true, antialiasGL: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / viewport.devicePixelRatio },
  banner: false,
});
game.registry.set('viewport', viewport);

function applyViewport(): void {
  const next = measure();
  if (
    next.bufferWidth === viewport.bufferWidth &&
    next.bufferHeight === viewport.bufferHeight &&
    next.devicePixelRatio === viewport.devicePixelRatio &&
    next.offsetX === viewport.offsetX &&
    next.offsetY === viewport.offsetY
  ) {
    return;
  }
  viewport = next;
  game.scale.resize(viewport.bufferWidth, viewport.bufferHeight);
  game.scale.setZoom(1 / viewport.devicePixelRatio);
  positionCanvas();
  game.registry.set('viewport', viewport);
  game.events.emit('viewport', viewport);
}

let resizeQueued = false;
const queueResize = () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    applyViewport();
  });
};
new ResizeObserver(queueResize).observe(container);
window.addEventListener('resize', queueResize);
// Browser zoom or moving to a monitor with different display scaling changes devicePixelRatio,
// sometimes without any resize event. A per-frame comparison is cheap and never misses it.
// Reads only devicePixelRatio (no layout), so it costs nothing per frame.
game.events.on(Phaser.Core.Events.PRE_STEP, () => {
  if (clampPixelRatio(window.devicePixelRatio) !== viewport.devicePixelRatio) queueResize();
});
/** Places the canvas on whole device pixels, then has Phaser re-read its on-page bounds for input. */
function positionCanvas(): void {
  game.canvas.style.marginLeft = `${viewport.offsetX}px`;
  game.canvas.style.marginTop = `${viewport.offsetY}px`;
  game.scale.refresh();
}
game.events.once(Phaser.Core.Events.READY, positionCanvas);

game.scene.add('Game', GameScene, true, { session } satisfies GameSceneData);

// Dev-server only (stripped from production builds): lets automated playtests drive the game.
if (import.meta.env.DEV) Object.assign(window, { __lastStand: { session, game } });
new Hud(session);
new Sfx(session);

const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${__APP_VERSION__}`;
