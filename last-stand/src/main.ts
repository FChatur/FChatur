import Phaser from 'phaser';
import { GRID } from './config/map';
import { GameSession } from './game/GameSession';
import { PALETTE } from './render/palette';
import { GameScene, type GameSceneData } from './scenes/GameScene';
import { Hud } from './ui/Hud';
import './style.css';

const session = new GameSession();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GRID.cols * GRID.tileSize,
  height: GRID.rows * GRID.tileSize,
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

const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${__APP_VERSION__}`;
