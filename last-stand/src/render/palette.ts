/** Shared colours for the Phaser layer. Keep in sync with the CSS custom properties in style.css. */
export const PALETTE = {
  background: 0x0b0f1a,
  gridLine: 0x161e2e,
  buildable: 0x0f1524,
  path: 0x1c2638,
  pathEdge: 0x2b3a57,
  pathCenter: 0x34476b,
  spawn: 0x7b8cff,
  exit: 0xef476f,
  valid: 0x4ade80,
  invalid: 0xef476f,
  range: 0xffffff,
  gold: 0xffd166,
  hpHigh: 0x4ade80,
  hpMid: 0xffd166,
  hpLow: 0xef476f,
  hpBack: 0x000000,
  projectile: 0xfff3b0,
  towerBase: 0x141b2b,
  enemyOutline: 0x0b0f1a,
} as const;

export const FONT_FAMILY = 'ui-monospace, "Cascadia Mono", "SFMono-Regular", Consolas, monospace';

export const DEPTH = {
  board: 0,
  towers: 10,
  enemies: 20,
  projectiles: 30,
  effects: 40,
  preview: 50,
} as const;
