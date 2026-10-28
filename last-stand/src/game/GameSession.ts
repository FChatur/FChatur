import { GAME_SPEEDS, type GameSpeed } from '../config/balance';
import type { TowerTypeId } from '../config/towers';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Simulation } from '../core/Simulation';
import type { Tower } from '../core/types';

/**
 * Owns the current run and the player's UI-level choices: the tower type armed for building,
 * the built tower selected for upgrade/sell, and game speed.
 * Shared by the Phaser scene and the DOM UI so neither needs to know about the other.
 */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  private _sim: Simulation;
  private _buildType: TowerTypeId | null = null;
  private _selectedTowerId: number | null = null;
  private _speed: GameSpeed = 1;

  constructor() {
    this._sim = new Simulation(this.bus);
    this.bus.on('gameOver', () => this.clearSelection());
    this.bus.on('towerSold', ({ tower }) => {
      if (tower.id === this._selectedTowerId) this.clearSelection();
    });
  }

  get sim(): Simulation {
    return this._sim;
  }

  /** Tower type armed for placement, if any. */
  get selectedTower(): TowerTypeId | null {
    return this._buildType;
  }

  /** The built tower currently selected for upgrade/sell, if any. */
  get selectedTowerInstance(): Tower | null {
    return this._selectedTowerId === null ? null : (this._sim.towerById(this._selectedTowerId) ?? null);
  }

  get speed(): GameSpeed {
    return this._speed;
  }

  /** Arms a tower type for building (clears any built-tower selection). */
  selectTower(type: TowerTypeId | null): void {
    if (this._sim.phase === 'gameover') type = null;
    this.setSelection(type, null);
  }

  toggleTower(type: TowerTypeId): void {
    this.selectTower(this._buildType === type ? null : type);
  }

  /** Selects a built tower for upgrade/sell (clears any armed tower type). */
  selectBuiltTower(tower: Tower | null): void {
    if (this._sim.phase === 'gameover') tower = null;
    this.setSelection(null, tower?.id ?? null);
  }

  clearSelection(): void {
    this.setSelection(null, null);
  }

  upgradeSelected(): boolean {
    const tower = this.selectedTowerInstance;
    return tower ? this._sim.upgradeTower(tower) : false;
  }

  sellSelected(): boolean {
    const tower = this.selectedTowerInstance;
    return tower ? this._sim.sellTower(tower) : false;
  }

  startWave(): boolean {
    return this._sim.startWave();
  }

  setSpeed(speed: GameSpeed): void {
    if (speed === this._speed) return;
    this._speed = speed;
    this.bus.emit('speedChanged', { speed });
  }

  cycleSpeed(): void {
    const i = GAME_SPEEDS.indexOf(this._speed);
    this.setSpeed(GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length]);
  }

  /** New run. Game speed is a player preference and carries over. */
  restart(): void {
    this._sim = new Simulation(this.bus);
    this._buildType = null;
    this._selectedTowerId = null;
    this.bus.emit('sessionReset', {});
    this.bus.emit('selectionChanged', { towerType: null, towerId: null });
  }

  private setSelection(type: TowerTypeId | null, towerId: number | null): void {
    if (type === this._buildType && towerId === this._selectedTowerId) return;
    this._buildType = type;
    this._selectedTowerId = towerId;
    this.bus.emit('selectionChanged', { towerType: type, towerId });
  }
}
