import { BALANCE } from '../../config/balance';
import { ENEMIES, type EnemyTypeId } from '../../config/enemies';
import { TOWERS } from '../../config/towers';
import type { Path } from '../../core/Path';

/**
 * Manny the Manhandler, PROVISIONAL (v0.8.0 design work, not in the game). Rules and numbers for the
 * knockback design (docs/KNOCKBACK.md) and a deterministic single-hero simulator used by the balance report
 * and the battle-screen prototype. When Manny is approved, the rules move into src/core and the numbers
 * into config/towers.ts.
 */

export type Weight = 'light' | 'medium' | 'heavy' | 'boss';

export interface MannyLevel {
  /** Damage of a normal punch, per target. */
  punchDamage: number;
  /** Seconds between attacks. */
  interval: number;
  /** Enemies hit by one attack (normal or launch), first along the route first. */
  targets: number;
  /** Knockback of the charged launch, in tiles of route distance, before weight and repeat factors. */
  knockTiles: number;
  /** Seconds a light enemy stays dazed after landing (scaled by weight). */
  dazeSeconds: number;
}

export const MANNY = {
  /** Melee reach from Manny's tile centre, in tiles. */
  reachTiles: 1.25,
  /** Wind-up before an attack lands; targets are chosen when it lands. */
  windupSeconds: 0.25,
  /** Every Nth attack is the charged launch (the others are normal punches with no knockback). */
  launchEvery: 3,
  launchDamageMultiplier: 1.5,
  levels: [
    { punchDamage: 18, interval: 3.2, targets: 1, knockTiles: 0.75, dazeSeconds: 0 },
    { punchDamage: 26, interval: 2.7, targets: 2, knockTiles: 1.75, dazeSeconds: 0.15 },
    { punchDamage: 40, interval: 2.3, targets: 3, knockTiles: 3.0, dazeSeconds: 0.3 },
  ] satisfies MannyLevel[],
  weightFactor: { light: 1, medium: 0.7, heavy: 0.45, boss: 0.2 } satisfies Record<Weight, number>,
  dazeFactor: { light: 1, medium: 0.8, heavy: 0.5, boss: 0 } satisfies Record<Weight, number>,
  /** Diminishing returns: the nth knock on the same enemy within the window uses factors[n-1]. */
  repeat: { windowSeconds: 6, factors: [1, 0.6, 0.35, 0.2] },
  /** Time spent in the air (not moving, not targetable): base + perTile x distance. Bosses aren't launched. */
  air: { base: 0.2, perTile: 0.1 },
  bossStaggerSeconds: 0.15,
  /** A single knock never exceeds this share of the route (protects short maps). */
  maxRouteFraction: 0.12,
} as const;

export const ENEMY_WEIGHT: Record<EnemyTypeId, Weight> = { basic: 'light', runner: 'light', armored: 'heavy', boss: 'boss' };

export interface Knock {
  /** New route progress (world px), always within [0, current progress]. */
  to: number;
  tiles: number;
  /** Seconds airborne (0 for a boss stagger). */
  air: number;
  /** Seconds held in place after landing (stagger for bosses). */
  hold: number;
}

/**
 * The charged launch on one enemy. `recentKnocks` is how many knocks it took within the repeat window
 * before this one. Pure and deterministic.
 */
export function knockback(level: MannyLevel, weight: Weight, recentKnocks: number, progress: number, routeLength: number, tileSize: number): Knock {
  const repeat = MANNY.repeat.factors[Math.min(recentKnocks, MANNY.repeat.factors.length - 1)];
  const capTiles = (MANNY.maxRouteFraction * routeLength) / tileSize;
  const tiles = Math.min(capTiles, level.knockTiles * MANNY.weightFactor[weight] * repeat);
  const to = Math.max(0, progress - tiles * tileSize);
  const realTiles = (progress - to) / tileSize;
  if (weight === 'boss') return { to, tiles: realTiles, air: 0, hold: MANNY.bossStaggerSeconds };
  return { to, tiles: realTiles, air: MANNY.air.base + MANNY.air.perTile * realTiles, hold: level.dazeSeconds * MANNY.dazeFactor[weight] };
}

/** Damage after armour, as in the game (flat reduction, never below the minimum fraction). */
export function afterArmor(damage: number, armor: number): number {
  return Math.max(damage - armor, damage * BALANCE.armorMinDamageFraction);
}

// ---------------------------------------------------------------- simulator

export interface SimEnemy {
  id: number;
  type: EnemyTypeId;
  hp: number;
  progress: number;
  spawnAt: number;
  state: 'waiting' | 'walk' | 'air' | 'hold' | 'leaked' | 'dead';
  until: number;
  /** Times of knocks within the repeat window (older ones are dropped). */
  knockTimes: number[];
  /** Knocks taken over its whole life. */
  knocks: number;
  /** Daze to apply on landing. */
  holdNext: number;
  /** Seconds this enemy lost to Manny: airborne + held + walking back over knocked distance. */
  heldSeconds: number;
  tilesLost: number;
  /** Longest continuous time spent within the first `spawnZoneTiles` of the route after entering it. */
  spawnZoneTime: number;
  spawnZoneMax: number;
}

export interface SimOptions {
  path: Path;
  tileSize: number;
  /** Where the hero stands (world px). */
  at: { x: number; y: number };
  hero: { kind: 'manny'; level: number; launchEvery?: number } | { kind: 'archer'; level: number } | { kind: 'none' };
  spawns: { type: EnemyTypeId; at: number }[];
  hpMultiplier: number;
  speedMultiplier?: number;
  step?: number;
  spawnZoneTiles?: number;
  /** Optional: receives every launch, for the prototype or debugging. */
  onKnock?: (e: SimEnemy, k: Knock) => void;
}

export interface SimResult {
  total: number;
  leaked: number;
  killed: number;
  launches: number;
  punches: number;
  /** Average seconds each enemy lost to knockback (all enemies). */
  avgHeld: number;
  /** Attacks that landed on nobody (the target walked out of reach during the wind-up). */
  whiffs: number;
  maxTilesLost: number;
  maxKnocksOnOne: number;
  /** Longest time any enemy spent in the spawn zone, in seconds. */
  spawnZoneMax: number;
  /** Seconds until the last enemy left (killed or leaked). */
  duration: number;
}

export function simulate(o: SimOptions): SimResult {
  const step = o.step ?? 1 / 60;
  const L = o.path.length;
  const zone = (o.spawnZoneTiles ?? 3) * o.tileSize;
  const enemies: SimEnemy[] = o.spawns.map((s, i) => ({
    id: i, type: s.type, hp: ENEMIES[s.type].maxHp * o.hpMultiplier, progress: 0, spawnAt: s.at, state: 'waiting', until: 0,
    knockTimes: [], knocks: 0, holdNext: 0, heldSeconds: 0, tilesLost: 0, spawnZoneTime: 0, spawnZoneMax: 0,
  }));
  let t = 0, cooldown = 0, attacks = 0, launches = 0, punches = 0, whiffs = 0;
  let pending: { at: number; launch: boolean } | null = null;
  const reach = MANNY.reachTiles * o.tileSize;
  const heroLevel = o.hero.kind === 'none' ? null : o.hero.level;
  const archer = o.hero.kind === 'archer' ? TOWERS.basic.levels[o.hero.level] : null;
  const manny = o.hero.kind === 'manny' ? MANNY.levels[o.hero.level] : null;
  const launchEvery = o.hero.kind === 'manny' ? o.hero.launchEvery ?? MANNY.launchEvery : MANNY.launchEvery;

  const inRange = (e: SimEnemy, r: number) => {
    if (e.state !== 'walk' && e.state !== 'hold') return false;
    const p = o.path.positionAt(e.progress);
    return Math.hypot(p.x - o.at.x, p.y - o.at.y) <= r;
  };
  const firstN = (r: number, n: number) => enemies.filter((e) => inRange(e, r)).sort((a, b) => b.progress - a.progress || a.id - b.id).slice(0, n);
  const hit = (e: SimEnemy, damage: number) => {
    e.hp -= afterArmor(damage, ENEMIES[e.type].armor);
    if (e.hp <= 0) e.state = 'dead';
  };

  let guard = 0;
  while (enemies.some((e) => e.state !== 'leaked' && e.state !== 'dead') && guard++ < 60 * 60 * 30) {
    t += step;
    for (const e of enemies) {
      if (e.state === 'waiting' && t >= e.spawnAt) e.state = 'walk';
      if ((e.state === 'air' || e.state === 'hold') && t >= e.until) {
        // Landing: a daze follows if the knock had one, then the enemy walks on.
        if (e.state === 'air' && e.holdNext > 0) { e.state = 'hold'; e.until = t + e.holdNext; e.holdNext = 0; }
        else e.state = 'walk';
      }
      if (e.state === 'walk') {
        e.progress += ENEMIES[e.type].speedTiles * (o.speedMultiplier ?? 1) * o.tileSize * step;
        if (e.progress >= L) e.state = 'leaked';
      }
      if (e.state === 'air' || e.state === 'hold') e.heldSeconds += step;
      // Spawn-zone time: how long an enemy is kept near the start (a "spawn lock" check).
      if (e.state !== 'waiting' && e.state !== 'dead' && e.state !== 'leaked' && e.progress < zone) {
        e.spawnZoneTime += step;
        e.spawnZoneMax = Math.max(e.spawnZoneMax, e.spawnZoneTime);
      } else e.spawnZoneTime = 0;
    }

    if (archer) {
      cooldown -= step;
      const r = archer.rangeTiles * o.tileSize;
      if (cooldown <= 0) {
        const [target] = firstN(r, 1);
        if (target) { hit(target, archer.damage); cooldown = 1 / archer.fireRate; }
      }
    } else if (manny && heroLevel !== null) {
      cooldown -= step;
      if (!pending && cooldown <= 0 && firstN(reach, 1).length) {
        attacks++;
        pending = { at: t + MANNY.windupSeconds, launch: attacks % launchEvery === 0 };
        cooldown = manny.interval;
      }
      if (pending && t >= pending.at) {
        const targets = firstN(reach, manny.targets);
        if (!targets.length) whiffs++;
        if (pending.launch) launches++; else punches++;
        for (const e of targets) {
          hit(e, manny.punchDamage * (pending.launch ? MANNY.launchDamageMultiplier : 1));
          if (!pending.launch || e.state === 'dead') continue;
          e.knockTimes = e.knockTimes.filter((k) => t - k < MANNY.repeat.windowSeconds);
          const k = knockback(manny, ENEMY_WEIGHT[e.type], e.knockTimes.length, e.progress, L, o.tileSize);
          e.knockTimes.push(t);
          e.knocks++;
          e.heldSeconds += (e.progress - k.to) / (ENEMIES[e.type].speedTiles * (o.speedMultiplier ?? 1) * o.tileSize);
          e.tilesLost += k.tiles;
          e.progress = k.to;
          if (k.air > 0) { e.state = 'air'; e.until = t + k.air; e.holdNext = k.hold; }
          else if (k.hold > 0) { e.state = 'hold'; e.until = t + k.hold; }
          o.onKnock?.(e, k);
        }
        pending = null;
      }
    }
  }
  return {
    total: enemies.length,
    leaked: enemies.filter((e) => e.state === 'leaked').length,
    killed: enemies.filter((e) => e.state === 'dead').length,
    launches,
    punches,
    avgHeld: enemies.reduce((s, e) => s + e.heldSeconds, 0) / enemies.length,
    whiffs,
    maxTilesLost: Math.max(...enemies.map((e) => e.tilesLost)),
    maxKnocksOnOne: Math.max(...enemies.map((e) => e.knocks)),
    spawnZoneMax: Math.max(...enemies.map((e) => e.spawnZoneMax)),
    duration: t,
  };
}

/** Evenly spaced spawns of one enemy type. */
export function stream(type: EnemyTypeId, count: number, spacing: number): { type: EnemyTypeId; at: number }[] {
  return Array.from({ length: count }, (_, i) => ({ type, at: i * spacing }));
}

/**
 * Representative places to stand beside a route (any map): beside a straight stretch near the middle, the
 * tile covering the most road (a corner), and the earliest tile that reaches the road (near spawn).
 */
export function placements(path: Path, cols: number, rows: number, tileSize: number): { name: 'straight' | 'corner' | 'spawn'; at: { x: number; y: number }; coverageTiles: number; progress: number }[] {
  const reach = MANNY.reachTiles * tileSize;
  const cands: { at: { x: number; y: number }; coverageTiles: number; progress: number }[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (path.isPathTile(c, r)) continue;
    const at = { x: (c + 0.5) * tileSize, y: (r + 0.5) * tileSize };
    let covered = 0, first = -1;
    for (let d = 0; d <= path.length; d += 4) {
      const p = path.positionAt(d);
      if (Math.hypot(p.x - at.x, p.y - at.y) <= reach) { covered += 4; if (first < 0) first = d; }
    }
    if (covered > 0) cands.push({ at, coverageTiles: covered / tileSize, progress: first / path.length });
  }
  const straight = cands.filter((k) => k.coverageTiles > 1.2 && k.coverageTiles < 1.8).sort((a, b) => Math.abs(a.progress - 0.5) - Math.abs(b.progress - 0.5))[0];
  const corner = [...cands].sort((a, b) => b.coverageTiles - a.coverageTiles)[0];
  const spawn = [...cands].sort((a, b) => a.progress - b.progress)[0];
  return [{ name: 'straight', ...straight }, { name: 'corner', ...corner }, { name: 'spawn', ...spawn }];
}
