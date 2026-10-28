import { TOWER_ORDER, TOWERS, type TowerTypeId } from '../config/towers';
import type { GameEvents } from '../core/events';
import type { GameSession } from '../game/GameSession';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

const cssColor = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Events after which the HUD's numbers or button states may be stale. */
const REFRESH_ON: readonly (keyof GameEvents)[] = [
  'enemyKilled',
  'enemyLeaked',
  'towerPlaced',
  'waveStarted',
  'waveCleared',
  'gameOver',
  'selectionChanged',
  'sessionReset',
];

/**
 * The HTML overlay: stats bar, build bar, wave button, contextual hint and game-over panel.
 * Also owns keyboard shortcuts, since they map onto the same actions as the buttons.
 */
export class Hud {
  private readonly wave = el('stat-wave');
  private readonly gold = el('stat-gold');
  private readonly health = el('stat-health');
  private readonly hint = el('hint');
  private readonly startWave = el<HTMLButtonElement>('btn-start-wave');
  private readonly startWaveLabel = el('start-wave-label');
  private readonly towerButtons = new Map<TowerTypeId, HTMLButtonElement>();
  private readonly gameOver = el('overlay-gameover');
  private lastHealth = 0;

  constructor(private readonly session: GameSession) {
    this.buildTowerBar();
    this.startWave.addEventListener('click', () => {
      this.session.startWave();
      this.startWave.blur();
    });
    el('btn-restart').addEventListener('click', () => this.session.restart());
    window.addEventListener('keydown', (e) => this.onKey(e));
    for (const type of REFRESH_ON) session.bus.on(type, () => this.refresh());
    this.refresh();
  }

  private buildTowerBar(): void {
    const bar = el('tower-bar');
    for (const id of TOWER_ORDER) {
      const cfg = TOWERS[id];
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.style.setProperty('--tower-color', cssColor(cfg.color));
      btn.title = `${cfg.name}: ${cfg.description}`;
      btn.innerHTML = `
        <span class="tower-swatch"></span>
        <span class="tower-name">${cfg.name}</span>
        <span class="tower-cost">${cfg.cost}g</span>
        <kbd>${cfg.hotkey}</kbd>`;
      btn.addEventListener('click', () => {
        this.session.toggleTower(id);
        btn.blur();
      });
      bar.appendChild(btn);
      this.towerButtons.set(id, btn);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const sim = this.session.sim;
    if (e.code === 'Space') {
      e.preventDefault();
      this.session.startWave();
      return;
    }
    if (e.key === 'Escape') {
      this.session.selectTower(null);
      return;
    }
    if (e.key.toLowerCase() === 'r' && sim.phase === 'gameover') {
      this.session.restart();
      return;
    }
    const tower = TOWER_ORDER.find((id) => TOWERS[id].hotkey === e.key);
    if (tower && sim.phase !== 'gameover') this.session.toggleTower(tower);
  }

  private refresh(): void {
    const sim = this.session.sim;
    this.wave.textContent = String(sim.wave);
    this.gold.textContent = String(sim.gold);
    this.health.textContent = String(sim.health);

    if (sim.health < this.lastHealth) {
      // Restart the CSS animation.
      this.health.parentElement?.classList.remove('hit');
      void this.health.parentElement?.offsetWidth;
      this.health.parentElement?.classList.add('hit');
    }
    this.lastHealth = sim.health;

    for (const [id, btn] of this.towerButtons) {
      btn.classList.toggle('selected', this.session.selectedTower === id);
      btn.classList.toggle('unaffordable', sim.gold < TOWERS[id].cost);
      btn.disabled = sim.phase === 'gameover';
    }

    const building = sim.phase === 'build';
    this.startWave.disabled = !building;
    this.startWaveLabel.textContent =
      sim.phase === 'gameover' ? 'Run over' : building ? `Start Wave ${sim.wave + 1}` : `Wave ${sim.wave} in progress`;

    this.hint.textContent = this.hintText();
    this.renderGameOver();
  }

  private hintText(): string {
    const sim = this.session.sim;
    const selected = this.session.selectedTower;
    if (sim.phase === 'gameover') return '';
    if (selected) return `Click a free tile to build a ${TOWERS[selected].name}. Right-click or Esc to cancel.`;
    if (sim.towers.length === 0) return 'Select the Turret (1), then click a free tile beside the path.';
    if (sim.phase === 'build') return 'Build more, or press Space to send the next wave.';
    return 'Each enemy that reaches the red exit costs 1 health.';
  }

  private renderGameOver(): void {
    const sim = this.session.sim;
    const over = sim.phase === 'gameover';
    this.gameOver.classList.toggle('hidden', !over);
    if (!over) return;
    el('go-wave').textContent = String(sim.wave);
    el('go-kills').textContent = String(sim.stats.kills);
    el('go-towers').textContent = String(sim.stats.towersBuilt);
    el('go-gold').textContent = String(sim.stats.goldEarned);
  }
}
