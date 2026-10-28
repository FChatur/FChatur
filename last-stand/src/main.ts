import Phaser from 'phaser';
import { DEFAULT_MAP } from './config/maps';
import { GameSession } from './game/GameSession';
import { PALETTE } from './render/palette';
import { GameScene, type GameSceneData } from './scenes/GameScene';
import { Sfx } from './audio/Sfx';
import { Hud } from './ui/Hud';
import './style.css';

const session = new GameSession();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: DEFAULT_MAP.grid.cols * DEFAULT_MAP.grid.tileSize,
  height: DEFAULT_MAP.grid.rows * DEFAULT_MAP.grid.tileSize,
  backgroundColor: PALETTE.background,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  banner: false,
});

game.scene.add('Game', GameScene, true, { session } satisfies GameSceneData);

// Dev-server only (stripped from production builds): lets automated playtests drive the game.
if (import.meta.env.DEV) Object.assign(window, { __lastStand: { session, game } });
new Hud(session);
new Sfx(session);

const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${__APP_VERSION__}`;
