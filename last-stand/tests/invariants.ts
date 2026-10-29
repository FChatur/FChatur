import { expect } from 'vitest';
import { MAX_TOWER_LEVEL, TARGETING_MODES, TOWERS } from '../src/config/towers';
import { isEligible } from '../src/core/modifiers';
import type { Simulation } from '../src/core/Simulation';

const PHASES = ['build', 'wave', 'draft', 'gameover'];

/**
 * Everything that must hold for any reachable game state. Used by the fuzz and soak tests.
 * `context` is included in failure messages so a failing seed/step can be replayed.
 */
export function checkInvariants(sim: Simulation, startHealth: number, context: string): void {
  const fail = (msg: string) => expect.fail(`${msg} [${context}]`);
  const { cols, rows, tileSize } = sim.map.grid;

  if (!Number.isInteger(sim.gold) || sim.gold < 0) fail(`gold invalid: ${sim.gold}`);
  if (!Number.isInteger(sim.health) || sim.health < 0 || sim.health > startHealth) fail(`health invalid: ${sim.health}`);
  if (!Number.isInteger(sim.wave) || sim.wave < 0) fail(`wave invalid: ${sim.wave}`);
  if (!PHASES.includes(sim.phase)) fail(`phase invalid: ${sim.phase}`);
  if ((sim.health === 0) !== (sim.phase === 'gameover')) fail(`health ${sim.health} vs phase ${sim.phase}`);

  const tiles = new Set<string>();
  for (const t of sim.towers) {
    const key = `${t.col},${t.row}`;
    if (tiles.has(key)) fail(`two towers on ${key}`);
    tiles.add(key);
    if (t.col < 0 || t.row < 0 || t.col >= cols || t.row >= rows) fail(`tower out of bounds at ${key}`);
    if (sim.path.isPathTile(t.col, t.row)) fail(`tower on path at ${key}`);
    if (sim.towerAt(t.col, t.row) !== t) fail(`tile index out of sync at ${key}`);
    if (t.level < 1 || t.level > MAX_TOWER_LEVEL) fail(`tower level ${t.level}`);
    if (!TARGETING_MODES.includes(t.targeting)) fail(`tower targeting ${t.targeting}`);
    // The run's free starter tower cost nothing and always sells for nothing.
    if (t.invested < (t.free ? 0 : TOWERS[t.type].cost)) fail(`tower invested ${t.invested}`);
    if (t.free && sim.sellValue(t) !== 0) fail(`free tower sells for ${sim.sellValue(t)}`);
    if (!(t.fireInterval > 0) || !Number.isFinite(t.fireInterval)) fail(`fire interval ${t.fireInterval}`);
    if (!Number.isFinite(t.cooldown) || !Number.isFinite(t.angle)) fail('tower cooldown/angle not finite');
  }
  if (sim.towers.filter((t) => t.free).length > 1) fail('more than one free tower');

  for (const e of sim.enemies) {
    if (!e.alive) fail('dead enemy left in list after step');
    if (!(e.hp > 0) || !Number.isFinite(e.hp) || e.hp > e.maxHp) fail(`enemy hp ${e.hp}/${e.maxHp}`);
    if (![e.x, e.y, e.distance, e.speed].every(Number.isFinite)) fail('enemy position not finite');
    if (e.distance < 0 || e.distance > sim.path.length) fail(`enemy distance ${e.distance}`);
    if (!(e.slowFactor > 0 && e.slowFactor <= 1)) fail(`slow factor ${e.slowFactor}`);
    if (e.slowTimer < 0) fail(`slow timer ${e.slowTimer}`);
    if (!Number.isFinite(e.incomingDamage) || e.incomingDamage < -1e-6) fail(`incoming damage ${e.incomingDamage}`);
    if (e.x < -2 * tileSize || e.x > (cols + 2) * tileSize || e.y < -2 * tileSize || e.y > (rows + 2) * tileSize) {
      fail(`enemy far off the map at ${e.x},${e.y}`);
    }
  }
  for (const p of sim.projectiles) {
    if (!p.alive) fail('dead projectile left in list after step');
    if (![p.x, p.y, p.tx, p.ty].every(Number.isFinite)) fail('projectile not finite');
  }

  if (sim.phase === 'draft') {
    if (sim.draftChoices.length === 0) fail('draft with no choices');
    if (new Set(sim.draftChoices).size !== sim.draftChoices.length) fail('duplicate draft choices');
  } else if (sim.draftChoices.length > 0) {
    fail(`draft choices outside draft (${sim.phase})`);
  }
  if (sim.autoWaveCountdown !== null) {
    if (sim.phase !== 'build') fail(`countdown during ${sim.phase}`);
    if (!sim.autoWave) fail('countdown while Auto Wave is off');
    if (!(sim.autoWaveCountdown > -1e-9)) fail(`countdown ${sim.autoWaveCountdown}`);
  }
  for (const [def, n] of sim.mods.owned()) {
    if (n < 1 || n > def.maxStacks) fail(`${def.id} stacks ${n}`);
  }
  const s = sim.stats;
  if ([s.kills, s.leaks, s.towersBuilt, s.towersSold, s.goldEarned].some((v) => v < 0)) fail('negative stat');
  if (s.towersBuilt - s.towersSold !== sim.towers.length) fail('tower count out of sync with stats');
}

/** Checks that every current draft choice is actually eligible (call right after it opens). */
export function checkDraftEligibility(sim: Simulation, context: string): void {
  const builtTowers = new Set(sim.towers.map((t) => t.type));
  for (const id of sim.draftChoices) {
    const def = sim.mods.registry.get(id);
    if (!def) expect.fail(`unknown draft choice ${id} [${context}]`);
    // Eligibility is judged before the pick; stacks are still below max here.
    expect(isEligible(def!, { mods: sim.mods, wave: sim.wave, builtTowers }), `${id} offered but ineligible [${context}]`).toBe(true);
  }
}
