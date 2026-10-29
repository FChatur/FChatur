import { COLORS } from '../art/palette';

/** Colours for the Phaser layer, all from the art palette. Keep in sync with the CSS custom properties in style.css. */
export const PALETTE = {
  /** Beyond the painted scenery (only visible on very large screens). */
  background: COLORS.leaf1,
  valid: COLORS.grass5,
  invalid: COLORS.red3,
  range: 0xffffff,
  gold: COLORS.gold3,
  hpHigh: COLORS.grass4,
  hpMid: COLORS.gold3,
  hpLow: COLORS.red3,
  hpBack: COLORS.ink0,
  lightning: COLORS.frost5,
  lightningGlow: COLORS.frost3,
  /** Tint for slowed creatures. */
  slowed: 0xa8dcff,
  leak: COLORS.red3,
  waveText: COLORS.white0,
  bossText: COLORS.red3,
} as const;

/**
 * Draw order. Creatures and towers share the `units` band and are sorted by where they stand (their feet's
 * y), so whatever is lower on screen is drawn in front.
 */
export const DEPTH = {
  terrain: 0,
  grid: 5,
  shadows: 10,
  units: 100,
  bars: 3000,
  projectiles: 3100,
  effects: 3200,
  text: 3300,
  preview: 3400,
  banner: 3500,
} as const;

/** Depth for a unit whose feet are at world y. */
export const unitDepth = (feetY: number): number => DEPTH.units + feetY / 4;
