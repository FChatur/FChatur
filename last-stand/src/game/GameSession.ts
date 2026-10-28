import { GAME_SPEEDS, type GameSpeed } from '../config/balance';
import type { TowerTypeId } from '../config/towers';
import type { UpgradeId } from '../config/upgrades';
import { EventBus } from '../core/EventBus';
import type { GameEvents, Screen } from '../core/events';
import { Simulation } from '../core/Simulation';
import type { Tower } from '../core/types';
import { Persistence, type MapRecord, type Settings } from './persistence';

/**
 * Owns the current run and the player's UI-level state: which screen is showing, pause, the tower
 * type armed for building, the built tower selected for upgrade/sell, game speed, sound settings and
 * personal records. Shared by the Phaser scene and the DOM UI so neither needs to know about the other.
 */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  private _sim: Simulation;
  private _buildType: TowerTypeId | null = null;
  private _selectedTowerId: number | null = null;
  private _hoveredTowerId: number | null = null;
  private _screen: Screen = 'menu';
  private _paused = false;
  private readonly settings: Settings;
  /** Result of the last finished run, for the game-over screen. */
  lastRun: { record: MapRecord; newBest: boolean } | null = null;

  constructor(private readonly persistence = new Persistence()) {
    this.settings = persistence.loadSettings();
    this._sim = this.newSimulation();
    this.bus.on('gameOver', ({ wave }) => {
      this.lastRun = this.persistence.recordRun(this._sim.map.id, wave, this._sim.stats.kills);
      this.clearSelection();
    });
    this.bus.on('towerSold', ({ tower }) => {
      if (tower.id === this._selectedTowerId) this.clearSelection();
      if (tower.id === this._hoveredTowerId) this.setHoveredTower(null);
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

  /** The built tower under the pointer, if any (drives tooltips; never affects gameplay). */
  get hoveredTower(): Tower | null {
    return this._hoveredTowerId === null ? null : (this._sim.towerById(this._hoveredTowerId) ?? null);
  }

  setHoveredTower(tower: Tower | null): void {
    const id = tower?.id ?? null;
    if (id === this._hoveredTowerId) return;
    this._hoveredTowerId = id;
    this.bus.emit('hoverChanged', { towerId: id });
  }

  get speed(): GameSpeed {
    return this.settings.speed;
  }

  get screen(): Screen {
    return this._screen;
  }

  get paused(): boolean {
    return this._paused;
  }

  /** True while the simulation should advance. */
  get running(): boolean {
    return this._screen === 'playing' && !this._paused && this._sim.phase !== 'gameover';
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  get volume(): number {
    return this.settings.volume;
  }

  get tutorialDone(): boolean {
    return this.settings.tutorialDone;
  }

  /** Personal record on the current map, if any runs have finished there. */
  get record(): MapRecord | null {
    return this.persistence.loadRecords()[this._sim.map.id] ?? null;
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

  chooseUpgrade(id: UpgradeId): boolean {
    return this._sim.chooseUpgrade(id);
  }

  setSpeed(speed: GameSpeed): void {
    if (speed === this.settings.speed) return;
    this.settings.speed = speed;
    this.saveSettings();
    this.bus.emit('speedChanged', { speed });
  }

  cycleSpeed(): void {
    const i = GAME_SPEEDS.indexOf(this.settings.speed);
    this.setSpeed(GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length]);
  }

  setMuted(muted: boolean): void {
    if (muted === this.settings.muted) return;
    this.settings.muted = muted;
    this.saveSettings();
    this.bus.emit('muteChanged', { muted });
  }

  toggleMute(): void {
    this.setMuted(!this.settings.muted);
  }

  completeTutorial(): void {
    if (this.settings.tutorialDone) return;
    this.settings.tutorialDone = true;
    this.saveSettings();
  }

  /** Makes the tutorial run again on the next game. */
  resetTutorial(): void {
    this.settings.tutorialDone = false;
    this.saveSettings();
  }

  setPaused(paused: boolean): void {
    if (this._screen !== 'playing' || this._sim.phase === 'gameover') paused = false;
    if (paused === this._paused) return;
    this._paused = paused;
    this.emitScreen();
  }

  togglePause(): void {
    this.setPaused(!this._paused);
  }

  /** From the main menu: start a fresh run. */
  play(): void {
    this.restart();
    this._screen = 'playing';
    this.emitScreen();
  }

  /** Abandon the current run and go back to the main menu. */
  toMenu(): void {
    this.restart();
    this._screen = 'menu';
    this.emitScreen();
  }

  get autoWave(): boolean {
    return this.settings.autoWave;
  }

  /** Toggles Auto Wave for this run and every later one. Off cancels a running countdown. */
  setAutoWave(on: boolean): void {
    if (on === this.settings.autoWave) return;
    this.settings.autoWave = on;
    this.saveSettings();
    this._sim.setAutoWave(on);
    this.bus.emit('autoWaveChanged', { on });
  }

  toggleAutoWave(): void {
    this.setAutoWave(!this.settings.autoWave);
  }

  /** New run. Speed, sound and Auto Wave are player preferences and carry over. */
  restart(): void {
    this._sim = this.newSimulation();
    this._buildType = null;
    this._selectedTowerId = null;
    this._hoveredTowerId = null;
    this._paused = false;
    this.lastRun = null;
    this.bus.emit('sessionReset', {});
    this.bus.emit('selectionChanged', { towerType: null, towerId: null });
    this.emitScreen();
  }

  private newSimulation(): Simulation {
    return new Simulation(this.bus, { autoWave: this.settings.autoWave });
  }

  private emitScreen(): void {
    this.bus.emit('screenChanged', { screen: this._screen, paused: this._paused });
  }

  private saveSettings(): void {
    this.persistence.saveSettings(this.settings);
  }

  private setSelection(type: TowerTypeId | null, towerId: number | null): void {
    if (type === this._buildType && towerId === this._selectedTowerId) return;
    this._buildType = type;
    this._selectedTowerId = towerId;
    this.bus.emit('selectionChanged', { towerType: type, towerId });
  }
}
