import { BALANCE, type BalanceConfig } from '../config/balance';
import { ENEMIES, type EnemyTypeId } from '../config/enemies';
import { TILE_SIZE } from '../config/map';
import { DEFAULT_MAP, type MapConfig } from '../config/maps';
import { MAX_TOWER_LEVEL, TOWERS, type TowerTypeId } from '../config/towers';
import { UPGRADES, type UpgradeDef, type UpgradeId } from '../config/upgrades';
import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { inBounds, tileCenter, tileKey } from './grid';
import { rollDraft, RunModifiers, type TowerModifiers } from './modifiers';
import { Path } from './Path';
import { createRng, randomSeed, type Rng } from './random';
import type { Enemy, Phase, PlacementCheck, Projectile, RunStats, Tower, UpgradeCheck } from './types';
import { planWave, waveClearBonus, type SpawnEntry } from './waves';

/** Distance from a tower's centre to its muzzle, as a fraction of a tile. */
const MUZZLE_OFFSET = 0.4;

export interface SimulationOptions {
  balance?: BalanceConfig;
  map?: MapConfig;
  /** Seeds every random roll in the run (upgrade offers, critical hits). Random if omitted. */
  seed?: number;
  /** The upgrade pool. Defaults to config/upgrades.ts; tests can pass their own. */
  upgradeRegistry?: ReadonlyMap<UpgradeId, UpgradeDef>;
}

/**
 * The whole game state and rules for one run. Pure TypeScript: no Phaser, no DOM.
 * Advance it with `step(dt)` at a fixed rate; read its public fields to render.
 */
export class Simulation {
  readonly path: Path;
  readonly map: MapConfig;
  readonly seed: number;
  /** Run upgrades owned so far, and their combined effects. */
  readonly mods: RunModifiers;
  /** Upgrades on offer while `phase === 'draft'`. */
  draftChoices: UpgradeId[] = [];
  gold: number;
  health: number;
  /** The most recently started wave (0 before the first). */
  wave = 0;
  phase: Phase = 'build';
  readonly stats: RunStats = { kills: 0, leaks: 0, towersBuilt: 0, towersSold: 0, goldEarned: 0 };

  readonly enemies: Enemy[] = [];
  readonly towers: Tower[] = [];
  readonly projectiles: Projectile[] = [];

  private readonly towerByTile = new Map<string, Tower>();
  private spawnQueue: SpawnEntry[] = [];
  private spawnIndex = 0;
  private spawnTimer = 0;
  private hpMultiplier = 1;
  private nextId = 1;
  private readonly balance: BalanceConfig;
  private readonly rng: Rng;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    options: SimulationOptions = {},
  ) {
    this.balance = options.balance ?? BALANCE;
    this.map = options.map ?? DEFAULT_MAP;
    this.seed = options.seed ?? randomSeed();
    this.rng = createRng(this.seed);
    this.mods = new RunModifiers(options.upgradeRegistry ?? UPGRADES);
    this.path = Path.fromWaypoints(this.map.waypoints, this.map.grid);
    this.gold = Math.round(this.balance.startingGold * this.map.modifiers.startingGold);
    this.health = this.balance.startingHealth;
  }

  // ---------------------------------------------------------------- commands

  canPlaceTower(type: TowerTypeId, col: number, row: number): PlacementCheck {
    if (this.phase === 'gameover') return { ok: false, reason: 'game-over' };
    if (!inBounds(col, row, this.map.grid)) return { ok: false, reason: 'out-of-bounds' };
    if (this.path.isPathTile(col, row)) return { ok: false, reason: 'path' };
    if (this.towerByTile.has(tileKey(col, row))) return { ok: false, reason: 'occupied' };
    if (this.gold < TOWERS[type].cost) return { ok: false, reason: 'insufficient-gold' };
    return { ok: true };
  }

  placeTower(type: TowerTypeId, col: number, row: number): Tower | null {
    if (!this.canPlaceTower(type, col, row).ok) return null;
    const cfg = TOWERS[type];
    const { x, y } = tileCenter(col, row, TILE_SIZE);
    const tower: Tower = {
      id: this.nextId++,
      type,
      col,
      row,
      x,
      y,
      level: 1,
      invested: cfg.cost,
      targeting: cfg.targeting,
      damage: 0,
      fireInterval: 0,
      range: 0,
      projectileSpeed: 0,
      slowFactor: 1,
      slowDuration: 0,
      cooldown: 0,
      angle: -Math.PI / 2,
    };
    applyLevelStats(tower);
    this.gold -= cfg.cost;
    this.towers.push(tower);
    this.towerByTile.set(tileKey(col, row), tower);
    this.stats.towersBuilt++;
    this.bus.emit('towerPlaced', { tower });
    return tower;
  }

  towerAt(col: number, row: number): Tower | undefined {
    return this.towerByTile.get(tileKey(col, row));
  }

  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  canUpgradeTower(tower: Tower): UpgradeCheck {
    if (this.phase === 'gameover') return { ok: false, reason: 'game-over' };
    if (tower.level >= MAX_TOWER_LEVEL) return { ok: false, reason: 'max-level' };
    const cost = TOWERS[tower.type].levels[tower.level].upgradeCost;
    if (this.gold < cost) return { ok: false, reason: 'insufficient-gold' };
    return { ok: true, cost };
  }

  upgradeTower(tower: Tower): boolean {
    const check = this.canUpgradeTower(tower);
    if (!check.ok) return false;
    this.gold -= check.cost;
    tower.invested += check.cost;
    tower.level++;
    applyLevelStats(tower);
    this.bus.emit('towerUpgraded', { tower, cost: check.cost });
    return true;
  }

  /** Gold returned if this tower were sold now. */
  sellValue(tower: Tower): number {
    return Math.floor(tower.invested * this.balance.sellRefundRatio);
  }

  /** Removes a tower and refunds part of its cost. Allowed during waves. */
  sellTower(tower: Tower): boolean {
    if (this.phase === 'gameover') return false;
    const index = this.towers.indexOf(tower);
    if (index < 0) return false;
    const refund = this.sellValue(tower);
    this.towers.splice(index, 1);
    this.towerByTile.delete(tileKey(tower.col, tower.row));
    this.gold += refund;
    this.stats.towersSold++;
    this.bus.emit('towerSold', { tower, refund });
    return true;
  }

  /** Picks one of the offered run upgrades and ends the draft. */
  chooseUpgrade(id: UpgradeId): boolean {
    if (this.phase !== 'draft' || !this.draftChoices.includes(id)) return false;
    this.mods.add(id);
    this.draftChoices = [];
    this.phase = 'build';
    this.bus.emit('upgradeChosen', { id, rank: this.mods.stacksOf(id) });
    return true;
  }

  /** Adds upgrade stacks outside the draft (tests, balance tools). Respects max stacks. */
  grantUpgrade(id: UpgradeId, stacks = 1): void {
    for (let i = 0; i < stacks; i++) this.mods.add(id);
  }

  /** Starts the next wave. Only allowed between waves, after any pending upgrade pick. */
  startWave(): boolean {
    if (this.phase !== 'build') return false;
    this.wave++;
    const plan = planWave(this.wave, this.balance.waves, this.map.modifiers.enemyCount);
    this.spawnQueue = plan.spawns;
    this.spawnIndex = 0;
    this.spawnTimer = plan.spawns[0]?.delay ?? 0;
    this.hpMultiplier = plan.hpMultiplier;
    this.phase = 'wave';
    this.bus.emit('waveStarted', { wave: this.wave, enemyCount: plan.spawns.length });
    return true;
  }

  // ---------------------------------------------------------------- update

  step(dt: number): void {
    if (this.phase === 'gameover') return;

    for (const e of this.enemies) {
      e.prevX = e.x;
      e.prevY = e.y;
    }
    for (const p of this.projectiles) {
      p.prevX = p.x;
      p.prevY = p.y;
    }

    if (this.phase === 'wave') this.updateSpawning(dt);
    this.updateEnemies(dt);
    if (this.health <= 0) {
      this.endRun();
      return;
    }
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    removeDead(this.enemies);
    removeDead(this.projectiles);
    this.checkWaveCleared();
  }

  private updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    while (this.spawnIndex < this.spawnQueue.length && this.spawnTimer <= 0) {
      this.spawnEnemy(this.spawnQueue[this.spawnIndex].enemy);
      this.spawnIndex++;
      this.spawnTimer += this.spawnQueue[this.spawnIndex]?.delay ?? 0;
    }
  }

  private spawnEnemy(type: EnemyTypeId): void {
    const cfg = ENEMIES[type];
    const start = this.path.positionAt(0);
    const hp = Math.round(cfg.maxHp * this.hpMultiplier * this.map.modifiers.enemyHp);
    const enemy: Enemy = {
      id: this.nextId++,
      type,
      hp,
      maxHp: hp,
      speed: cfg.speedTiles * TILE_SIZE * this.map.modifiers.enemySpeed,
      armor: cfg.armor,
      incomingDamage: 0,
      slowFactor: 1,
      slowTimer: 0,
      reward: Math.max(1, Math.round(cfg.reward * this.map.modifiers.goldIncome)),
      leakDamage: cfg.leakDamage,
      radius: cfg.radius,
      distance: 0,
      x: start.x,
      y: start.y,
      prevX: start.x,
      prevY: start.y,
      alive: true,
    };
    this.enemies.push(enemy);
    this.bus.emit('enemySpawned', { enemy });
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowTimer = 0;
          e.slowFactor = 1;
        }
      }
      e.distance += e.speed * e.slowFactor * dt;
      if (e.distance >= this.path.length) {
        e.alive = false;
        this.health = Math.max(0, this.health - e.leakDamage);
        this.stats.leaks++;
        this.bus.emit('enemyLeaked', { enemy: e });
        continue;
      }
      const pos = this.path.positionAt(e.distance);
      e.x = pos.x;
      e.y = pos.y;
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      const target = this.findTarget(t);
      if (target) t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      if (target) {
        this.fire(t, target);
        t.cooldown += t.fireInterval / this.mods.forTower(t.type).fireRateMultiplier;
      } else {
        // Idle towers stay ready but don't bank shots.
        t.cooldown = 0;
      }
    }
  }

  /**
   * "first": the enemy in range furthest along the path.
   * "strongest": the enemy in range with the most health, ties broken by "first".
   * Only enemies on the map can be targeted; global-range towers consider every one of them.
   * Enemies that shots already in flight will kill are skipped (no wasted overkill), unless every
   * candidate is covered, in which case the tower fires at its normal pick anyway.
   */
  private findTarget(t: Tower): Enemy | null {
    const global = t.range === Number.POSITIVE_INFINITY;
    const r2 = t.range * t.range;
    let best: Enemy | null = null;
    let bestUncovered: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive || !this.isOnMap(e)) continue;
      if (!global) {
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy > r2) continue;
      }
      if (!best || isBetterTarget(t, e, best)) best = e;
      if (e.incomingDamage < e.hp && (!bestUncovered || isBetterTarget(t, e, bestUncovered))) bestUncovered = e;
    }
    return bestUncovered ?? best;
  }

  /** Enemies walk in from (and out to) just beyond the map edge; they can't be shot until visible. */
  private isOnMap(e: Enemy): boolean {
    const { cols, rows } = this.map.grid;
    return e.x >= 0 && e.y >= 0 && e.x <= cols * TILE_SIZE && e.y <= rows * TILE_SIZE;
  }

  private fire(t: Tower, target: Enemy): void {
    const offset = MUZZLE_OFFSET * TILE_SIZE;
    const x = t.x + Math.cos(t.angle) * offset;
    const y = t.y + Math.sin(t.angle) * offset;
    const projectile: Projectile = {
      id: this.nextId++,
      towerType: t.type,
      x,
      y,
      prevX: x,
      prevY: y,
      target,
      tx: target.x,
      ty: target.y,
      speed: t.projectileSpeed,
      damage: t.damage,
      slowFactor: t.slowFactor,
      slowDuration: t.slowDuration,
      alive: true,
    };
    target.incomingDamage += mitigate(t.damage, target.armor, this.balance.armorMinDamageFraction);
    this.projectiles.push(projectile);
    this.bus.emit('towerFired', { tower: t, projectile });
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      if (p.target?.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      } else {
        p.target = null;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const travel = p.speed * dt;
      if (dist > travel) {
        p.x += (dx / dist) * travel;
        p.y += (dy / dist) * travel;
        continue;
      }
      p.x = p.tx;
      p.y = p.ty;
      p.alive = false;
      if (p.target) {
        p.target.incomingDamage -= mitigate(p.damage, p.target.armor, this.balance.armorMinDamageFraction);
        this.resolveHit(p, p.target);
      }
    }
  }

  /**
   * Applies a projectile hit and every run-upgrade effect on it, in a fixed order:
   * critical roll → frostbite (per target, from slows already on it) → primary damage → slow →
   * explosive splash → chain lightning jumps.
   */
  private resolveHit(p: Projectile, enemy: Enemy): void {
    const m = this.mods.forTower(p.towerType);
    const crit = m.critChance > 0 && this.rng() < m.critChance;
    const base = crit ? p.damage * m.critMultiplier : p.damage;
    this.bus.emit('projectileHit', { projectile: p, enemy, crit });

    this.damageEnemy(enemy, withSlowedBonus(enemy, base, m));
    if (p.slowFactor < 1) applySlow(enemy, p.slowFactor, p.slowDuration);

    const splash = m.splashFraction;
    if (splash > 0) {
      const radius = m.splashRadius * TILE_SIZE;
      this.bus.emit('splash', { x: p.x, y: p.y, radius });
      for (const e of this.enemies) {
        if (e === enemy || !e.alive) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > radius + e.radius) continue;
        this.damageEnemy(e, withSlowedBonus(e, base * splash, m));
      }
    }

    const bounces = m.chainBounces;
    if (bounces > 0) {
      const reach = m.chainRange * TILE_SIZE;
      const jump = base * m.chainDamageFraction;
      const hit = new Set<Enemy>([enemy]);
      let from: { x: number; y: number } = { x: p.x, y: p.y };
      for (let i = 0; i < bounces; i++) {
        const next = this.nearestEnemy(from.x, from.y, reach, hit);
        if (!next) break;
        hit.add(next);
        this.bus.emit('chainArc', { fromX: from.x, fromY: from.y, toX: next.x, toY: next.y });
        from = { x: next.x, y: next.y };
        this.damageEnemy(next, withSlowedBonus(next, jump, m));
      }
    }
  }

  private nearestEnemy(x: number, y: number, reach: number, exclude: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = reach;
    for (const e of this.enemies) {
      if (!e.alive || exclude.has(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  private damageEnemy(e: Enemy, raw: number): void {
    if (!e.alive) return;
    e.hp -= mitigate(raw, e.armor, this.balance.armorMinDamageFraction);
    if (e.hp > 0) return;
    e.hp = 0;
    e.alive = false;
    this.gold += e.reward;
    this.stats.kills++;
    this.stats.goldEarned += e.reward;
    this.bus.emit('enemyKilled', { enemy: e });
  }

  private checkWaveCleared(): void {
    if (this.phase !== 'wave') return;
    if (this.spawnIndex < this.spawnQueue.length || this.enemies.length > 0) return;
    // Interest is paid on gold held when the wave ends, before the clear bonus arrives.
    const interest = this.mods.interestPayout(this.gold);
    const bonus = Math.round(waveClearBonus(this.wave, this.balance.waves) * this.map.modifiers.goldIncome);
    this.gold += bonus + interest;
    this.stats.goldEarned += bonus + interest;
    this.phase = 'build';
    this.bus.emit('waveCleared', { wave: this.wave, bonus, interest });

    if (this.wave % this.balance.roguelite.draftEvery === 0) {
      const { draftChoices, rarityWeights } = this.balance.roguelite;
      const builtTowers = new Set(this.towers.map((t) => t.type));
      const choices = rollDraft({ mods: this.mods, wave: this.wave, builtTowers }, this.rng, draftChoices, rarityWeights);
      if (choices.length > 0) {
        this.draftChoices = choices;
        this.phase = 'draft';
        this.bus.emit('draftOffered', { choices });
      }
    }
  }

  private endRun(): void {
    this.phase = 'gameover';
    this.bus.emit('gameOver', { wave: this.wave });
  }
}

/** Damage after flat armor, never below `minFraction` of the raw hit. */
export function mitigate(raw: number, armor: number, minFraction: number): number {
  return Math.max(raw * minFraction, raw - armor);
}

/** Damage bonus against enemies that are currently slowed (e.g. Frostbite). */
function withSlowedBonus(e: Enemy, damage: number, m: TowerModifiers): number {
  return e.slowFactor < 1 ? damage * m.slowedDamageMultiplier : damage;
}

/** The strongest slow wins; reapplying the same strength refreshes its duration. */
function applySlow(e: Enemy, factor: number, duration: number): void {
  if (factor < e.slowFactor) {
    e.slowFactor = factor;
    e.slowTimer = duration;
  } else if (factor === e.slowFactor) {
    e.slowTimer = Math.max(e.slowTimer, duration);
  }
}

function isBetterTarget(t: Tower, candidate: Enemy, current: Enemy): boolean {
  if (t.targeting === 'strongest' && candidate.hp !== current.hp) return candidate.hp > current.hp;
  return candidate.distance > current.distance;
}

/** Copies the stats for the tower's current level from config. */
function applyLevelStats(t: Tower): void {
  const stats = TOWERS[t.type].levels[t.level - 1];
  t.damage = stats.damage;
  t.fireInterval = 1 / stats.fireRate;
  t.range = stats.rangeTiles * TILE_SIZE;
  t.projectileSpeed = stats.projectileSpeed;
  t.slowFactor = stats.slow?.factor ?? 1;
  t.slowDuration = stats.slow?.duration ?? 0;
}

/** Removes entries with `alive === false` in place, preserving order. */
function removeDead<T extends { alive: boolean }>(list: T[]): void {
  let w = 0;
  for (let r = 0; r < list.length; r++) if (list[r].alive) list[w++] = list[r];
  list.length = w;
}
