import { BALANCE, type BalanceConfig } from '../config/balance';
import { ENEMIES, type EnemyTypeId } from '../config/enemies';
import { GRID, PATH_WAYPOINTS } from '../config/map';
import { MAX_TOWER_LEVEL, TOWERS, type TowerTypeId } from '../config/towers';
import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { inBounds, tileCenter, tileKey } from './grid';
import { Path } from './Path';
import type { Enemy, Phase, PlacementCheck, Projectile, RunStats, Tower, UpgradeCheck } from './types';
import { planWave, waveClearBonus, type SpawnEntry } from './waves';

/** Distance from a tower's centre to its muzzle, as a fraction of a tile. */
const MUZZLE_OFFSET = 0.4;

/**
 * The whole game state and rules for one run. Pure TypeScript: no Phaser, no DOM.
 * Advance it with `step(dt)` at a fixed rate; read its public fields to render.
 */
export class Simulation {
  readonly path: Path;
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

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly balance: BalanceConfig = BALANCE,
  ) {
    this.path = Path.fromWaypoints(PATH_WAYPOINTS, GRID);
    this.gold = balance.startingGold;
    this.health = balance.startingHealth;
  }

  // ---------------------------------------------------------------- commands

  canPlaceTower(type: TowerTypeId, col: number, row: number): PlacementCheck {
    if (this.phase === 'gameover') return { ok: false, reason: 'game-over' };
    if (!inBounds(col, row, GRID)) return { ok: false, reason: 'out-of-bounds' };
    if (this.path.isPathTile(col, row)) return { ok: false, reason: 'path' };
    if (this.towerByTile.has(tileKey(col, row))) return { ok: false, reason: 'occupied' };
    if (this.gold < TOWERS[type].cost) return { ok: false, reason: 'insufficient-gold' };
    return { ok: true };
  }

  placeTower(type: TowerTypeId, col: number, row: number): Tower | null {
    if (!this.canPlaceTower(type, col, row).ok) return null;
    const cfg = TOWERS[type];
    const { x, y } = tileCenter(col, row, GRID.tileSize);
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

  /** Starts the next wave. Only allowed between waves. */
  startWave(): boolean {
    if (this.phase !== 'build') return false;
    this.wave++;
    const plan = planWave(this.wave, this.balance.waves);
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
    const hp = Math.round(cfg.maxHp * this.hpMultiplier);
    this.enemies.push({
      id: this.nextId++,
      type,
      hp,
      maxHp: hp,
      speed: cfg.speedTiles * GRID.tileSize,
      armor: cfg.armor,
      slowFactor: 1,
      slowTimer: 0,
      reward: cfg.reward,
      leakDamage: cfg.leakDamage,
      radius: cfg.radius,
      distance: 0,
      x: start.x,
      y: start.y,
      prevX: start.x,
      prevY: start.y,
      alive: true,
    });
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
        t.cooldown += t.fireInterval;
      } else {
        // Idle towers stay ready but don't bank shots.
        t.cooldown = 0;
      }
    }
  }

  /**
   * "first": the enemy in range furthest along the path.
   * "strongest": the enemy in range with the most health, ties broken by "first".
   */
  private findTarget(t: Tower): Enemy | null {
    const r2 = t.range * t.range;
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || isBetterTarget(t, e, best)) best = e;
    }
    return best;
  }

  private fire(t: Tower, target: Enemy): void {
    const offset = MUZZLE_OFFSET * GRID.tileSize;
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
        const enemy = p.target;
        this.bus.emit('projectileHit', { projectile: p, enemy });
        if (p.slowFactor < 1) applySlow(enemy, p.slowFactor, p.slowDuration);
        this.damageEnemy(enemy, p.damage);
      }
    }
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
    const bonus = waveClearBonus(this.wave, this.balance.waves);
    this.gold += bonus;
    this.stats.goldEarned += bonus;
    this.phase = 'build';
    this.bus.emit('waveCleared', { wave: this.wave, bonus });
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
  t.range = stats.rangeTiles * GRID.tileSize;
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
