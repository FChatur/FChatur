import Phaser from 'phaser';
import { ART_TILE } from './art/terrain';
import { DEFAULT_MAP } from './config/maps';
import type { TileCoord } from './config/map';
import { GameSession } from './game/GameSession';
import { PALETTE } from './render/palette';
import { clampPixelRatio, computeViewport, mapScreenRect, type Viewport } from './render/viewport';
import { GameScene, type GameSceneData } from './scenes/GameScene';
import { AudioEngine } from './audio/AudioEngine';
import { Music } from './audio/Music';
import { Sfx } from './audio/Sfx';
import { Hud, type BoardGeometry } from './ui/Hud';
import { hideNotice, showNotice, watchForCrashes } from './ui/notice';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-600.css';
import './style.css';

watchForCrashes();
const session = new GameSession();

// Rendering: the canvas fills the stage and its buffer matches the device pixels it covers (see
// render/viewport.ts), so the browser never stretches it. The map is drawn at a whole number of device
// pixels per art pixel and centred; scenery fills the rest.
const container = document.getElementById('game-container')!;
const { grid } = DEFAULT_MAP;
const worldWidth = grid.cols * grid.tileSize;
const worldHeight = grid.rows * grid.tileSize;
const viewportInput = () => ({
  cssWidth: container.clientWidth,
  cssHeight: container.clientHeight,
  devicePixelRatio: window.devicePixelRatio,
  mapArtWidth: grid.cols * ART_TILE,
  mapArtHeight: grid.rows * ART_TILE,
  worldPerArt: grid.tileSize / ART_TILE,
});
const measure = (): Viewport => computeViewport(viewportInput());
let viewport = measure();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  width: viewport.bufferWidth,
  height: viewport.bufferHeight,
  backgroundColor: PALETTE.background,
  // Pixel art: nearest-neighbour sampling and whole-pixel positions everywhere.
  render: { antialias: false, antialiasGL: false, pixelArt: true, roundPixels: true },
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / viewport.devicePixelRatio },
  banner: false,
  // All sound goes through src/audio. Without this Phaser opens its own audio context on page load,
  // before the player has interacted (browsers then warn and keep it suspended).
  audio: { noAudio: true },
});
game.registry.set('viewport', viewport);

function applyViewport(): void {
  const next = measure();
  const same =
    next.bufferWidth === viewport.bufferWidth &&
    next.bufferHeight === viewport.bufferHeight &&
    next.devicePixelRatio === viewport.devicePixelRatio &&
    next.mapX === viewport.mapX &&
    next.mapY === viewport.mapY;
  if (same) {
    positionCanvas();
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

/**
 * Places the canvas on whole device pixels (an off-pixel position makes the browser resample, i.e. blur,
 * the whole image), then has Phaser re-read its on-page bounds for input. Also publishes where the map
 * is, for the interface and for tests.
 */
function positionCanvas(): void {
  const dpr = viewport.devicePixelRatio;
  const box = container.getBoundingClientRect();
  const snap = (v: number) => (Math.ceil(v * dpr - 1e-6) - v * dpr) / dpr;
  game.canvas.style.marginLeft = `${snap(box.left)}px`;
  game.canvas.style.marginTop = `${snap(box.top)}px`;
  game.scale.refresh();
  const tile = (grid.tileSize * viewport.scale) / dpr;
  container.dataset.mapLeft = String(viewport.mapX / dpr);
  container.dataset.mapTop = String(viewport.mapY / dpr);
  container.dataset.tile = String(tile);
}

/** Converts between the page and the map, for drag and drop and tooltips. */
const geometry: BoardGeometry = {
  tileAt(clientX: number, clientY: number): TileCoord | null {
    const rect = mapScreenRect(viewport, game.canvas.getBoundingClientRect(), worldWidth, worldHeight);
    const col = Math.floor(((clientX - rect.left) / rect.width) * grid.cols);
    const row = Math.floor(((clientY - rect.top) / rect.height) * grid.rows);
    return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows ? { col, row } : null;
  },
  tileRect(col: number, row: number) {
    const rect = mapScreenRect(viewport, game.canvas.getBoundingClientRect(), worldWidth, worldHeight);
    const w = rect.width / grid.cols;
    const h = rect.height / grid.rows;
    return { left: rect.left + col * w, top: rect.top + row * h, width: w, height: h };
  },
  overBoard(clientX: number, clientY: number): boolean {
    const box = game.canvas.getBoundingClientRect();
    const hit = document.elementFromPoint(clientX, clientY);
    return clientX >= box.left && clientX < box.right && clientY >= box.top && clientY < box.bottom && hit === game.canvas;
  },
};

game.events.once(Phaser.Core.Events.READY, () => {
  positionCanvas();
  // The browser can reset the GPU context (driver hiccup, sleep/wake, too many tabs). Phaser restores
  // its resources when the context comes back; pause meanwhile so the run isn't lost blind.
  const renderer = game.renderer;
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
    renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => {
      session.setPaused(true);
      showNotice('graphics', 'Your browser reset the game’s graphics. Waiting for them to come back…', [
        { label: 'Reload', run: () => location.reload() },
      ]);
    });
    renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
      hideNotice('graphics');
      showNotice('graphics-restored', 'Graphics restored. The game is paused; press P to continue.', [
        { label: 'OK', run: () => hideNotice('graphics-restored') },
      ]);
    });
  }
});

game.scene.add('Game', GameScene, true, { session } satisfies GameSceneData);

// Dev-server only (stripped from production builds): lets automated playtests drive the game.
if (import.meta.env.DEV) Object.assign(window, { __lastStand: { session, game } });
// Audio first: its unlock listeners must see a Play click or key press before the HUD acts on it.
const audio = new AudioEngine(session);
new Hud(session, geometry);
new Sfx(session, audio);
// Without the soundtrack files (withheld while licensing is checked) the game runs without music.
if (__SOUNDTRACK_AVAILABLE__) new Music(session, audio);
else document.body.dataset.music = 'unavailable';
document.getElementById('menu-credits')?.toggleAttribute('hidden', !__SOUNDTRACK_AVAILABLE__);

const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${__APP_VERSION__}`;
