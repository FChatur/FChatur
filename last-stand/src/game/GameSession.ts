import type { TowerTypeId } from '../config/towers';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Simulation } from '../core/Simulation';

/**
 * Owns the current run and the player's UI-level choices (e.g. which tower is selected).
 * Shared by the Phaser scene and the DOM UI so neither needs to know about the other.
 */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  private _sim: Simulation;
  private _selectedTower: TowerTypeId | null = null;

  constructor() {
    this._sim = new Simulation(this.bus);
    this.bus.on('gameOver', () => this.selectTower(null));
  }

  get sim(): Simulation {
    return this._sim;
  }

  get selectedTower(): TowerTypeId | null {
    return this._selectedTower;
  }

  selectTower(type: TowerTypeId | null): void {
    if (this._sim.phase === 'gameover') type = null;
    if (type === this._selectedTower) return;
    this._selectedTower = type;
    this.bus.emit('selectionChanged', { towerType: type });
  }

  toggleTower(type: TowerTypeId): void {
    this.selectTower(this._selectedTower === type ? null : type);
  }

  startWave(): boolean {
    return this._sim.startWave();
  }

  restart(): void {
    this._sim = new Simulation(this.bus);
    this._selectedTower = null;
    this.bus.emit('sessionReset', {});
    this.bus.emit('selectionChanged', { towerType: null });
  }
}
