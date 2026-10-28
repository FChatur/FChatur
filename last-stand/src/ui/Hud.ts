import { GAME_SPEEDS, type GameSpeed } from '../config/balance';
import { MAX_TOWER_LEVEL, TOWER_ORDER, TOWERS, type TowerLevel, type TowerTypeId } from '../config/towers';
import type { GameEvents } from '../core/events';
import { MAX_UPGRADE_RANK, UPGRADE_ORDER, UPGRADES, type UpgradeId } from '../config/upgrades';
import { fireRateMultiplier } from '../core/modifiers';
import type { Tower } from '../core/types';
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
  'towerUpgraded',
  'towerSold',
  'waveStarted',
  'waveCleared',
  'gameOver',
  'selectionChanged',
  'speedChanged',
  'draftOffered',
  'upgradeChosen',
  'sessionReset',
];

/**
 * The HTML overlay: stats bar, build bar, speed control, wave button, contextual hint,
 * selected-tower panel and game-over panel. Also owns keyboard shortcuts, since they map onto
 * the same actions as the buttons.
 */
export class Hud {
  private readonly wave = el('stat-wave');
  private readonly gold = el('stat-gold');
  private readonly health = el('stat-health');
  private readonly hint = el('hint');
  private readonly startWave = el<HTMLButtonElement>('btn-start-wave');
  private readonly startWaveLabel = el('start-wave-label');
  private readonly towerButtons = new Map<TowerTypeId, HTMLButtonElement>();
  private readonly speedButtons = new Map<GameSpeed, HTMLButtonElement>();
  private readonly panel = el('tower-panel');
  private readonly panelUpgrade = el<HTMLButtonElement>('tp-upgrade');
  private readonly panelSell = el<HTMLButtonElement>('tp-sell');
  private readonly gameOver = el('overlay-gameover');
  private lastHealth = 0;

  constructor(private readonly session: GameSession) {
    this.buildTowerBar();
    this.buildSpeedControl();
    this.panelUpgrade.addEventListener('click', () => {
      this.session.upgradeSelected();
      this.panelUpgrade.blur();
    });
    this.panelSell.addEventListener('click', () => {
      this.session.sellSelected();
      this.panelSell.blur();
    });
    el('tp-close').addEventListener('click', () => this.session.clearSelection());
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

  private buildSpeedControl(): void {
    const group = el('speed-control');
    for (const speed of GAME_SPEEDS) {
      const btn = document.createElement('button');
      btn.className = 'speed-btn';
      btn.textContent = `${speed}x`;
      btn.addEventListener('click', () => {
        this.session.setSpeed(speed);
        btn.blur();
      });
      group.appendChild(btn);
      this.speedButtons.set(speed, btn);
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
      this.session.clearSelection();
      return;
    }
    if (sim.phase === 'draft') {
      const choice = sim.draftChoices[Number(e.key) - 1];
      if (choice) this.session.chooseUpgrade(choice);
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'f') {
      this.session.cycleSpeed();
      return;
    }
    if (key === 'u') {
      this.session.upgradeSelected();
      return;
    }
    if (key === 's') {
      this.session.sellSelected();
      return;
    }
    if (key === 'r' && sim.phase === 'gameover') {
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

    for (const [speed, btn] of this.speedButtons) {
      btn.classList.toggle('active', this.session.speed === speed);
      btn.setAttribute('aria-pressed', String(this.session.speed === speed));
    }

    const building = sim.phase === 'build';
    this.startWave.disabled = !building;
    this.startWaveLabel.textContent = {
      build: `Start Wave ${sim.wave + 1}`,
      wave: `Wave ${sim.wave} in progress`,
      draft: 'Choose an upgrade',
      gameover: 'Run over',
    }[sim.phase];

    this.hint.textContent = this.hintText();
    this.renderUpgradeList();
    this.renderDraft();
    this.renderTowerPanel();
    this.renderGameOver();
  }

  private renderUpgradeList(): void {
    const ranks = this.session.sim.upgrades;
    el('upgrade-list').innerHTML = UPGRADE_ORDER.filter((id) => ranks[id] > 0)
      .map((id) => {
        const info = UPGRADES[id];
        return `<span class="upgrade-chip" style="--chip-color:${cssColor(info.color)}" title="${info.describe(ranks[id])}">${info.name} ${roman(ranks[id])}</span>`;
      })
      .join('');
  }

  /** Rebuilt only when a new offer appears, so cards don't flicker while the player decides. */
  private renderedDraft = '';

  private renderDraft(): void {
    const sim = this.session.sim;
    const open = sim.phase === 'draft';
    el('overlay-draft').classList.toggle('hidden', !open);
    const key = open ? `${sim.wave}:${sim.draftChoices.join()}` : '';
    if (key === this.renderedDraft) return;
    this.renderedDraft = key;
    const cards = el('draft-cards');
    cards.replaceChildren();
    if (!open) return;
    el('draft-wave').textContent = String(sim.wave);
    sim.draftChoices.forEach((id, i) => cards.appendChild(this.draftCard(id, i + 1)));
  }

  private draftCard(id: UpgradeId, index: number): HTMLButtonElement {
    const info = UPGRADES[id];
    const rank = this.session.sim.upgrades[id];
    const btn = document.createElement('button');
    btn.className = 'draft-card';
    btn.style.setProperty('--card-color', cssColor(info.color));
    btn.innerHTML = `
      <span class="draft-rank">${rank === 0 ? 'New' : `Rank ${roman(rank)} → ${roman(rank + 1)}`}${rank + 1 === MAX_UPGRADE_RANK ? ' (max)' : ''}</span>
      <h3>${info.name}</h3>
      <p class="draft-desc">${info.describe(rank + 1)}</p>
      ${rank > 0 ? `<p class="draft-now">Now: ${info.describe(rank)}</p>` : ''}
      <kbd>${index}</kbd>`;
    btn.addEventListener('click', () => this.session.chooseUpgrade(id));
    return btn;
  }

  private renderTowerPanel(): void {
    const tower = this.session.selectedTowerInstance;
    this.panel.classList.toggle('hidden', !tower);
    if (!tower) return;
    const sim = this.session.sim;
    const cfg = TOWERS[tower.type];
    const current = cfg.levels[tower.level - 1];
    const next = tower.level < MAX_TOWER_LEVEL ? cfg.levels[tower.level] : null;

    this.panel.style.setProperty('--tower-color', cssColor(cfg.color));
    el('tp-name').textContent = cfg.name;
    el('tp-level').textContent = `LV ${tower.level}/${MAX_TOWER_LEVEL}`;
    el('tp-stats').innerHTML = statRows(tower, current, next, fireRateMultiplier(sim.upgrades))
      .map(([label, now, then]) => `<dt>${label}</dt><dd>${now}${then && then !== now ? ` <span class="tp-next">→ ${then}</span>` : ''}</dd>`)
      .join('');

    const upgrade = sim.canUpgradeTower(tower);
    this.panelUpgrade.disabled = !upgrade.ok;
    el('tp-upgrade-cost').textContent = next ? `${next.upgradeCost}g` : '(max)';
    this.panelUpgrade.classList.toggle('unaffordable', !upgrade.ok && upgrade.reason === 'insufficient-gold');
    el('tp-sell-value').textContent = `+${sim.sellValue(tower)}g`;
  }

  private hintText(): string {
    const sim = this.session.sim;
    const selected = this.session.selectedTower;
    if (sim.phase === 'gameover') return '';
    if (sim.phase === 'draft') return 'Pick an upgrade (1-3) to continue.';
    if (selected) return `Click a free tile to build a ${TOWERS[selected].name}. Right-click or Esc to cancel.`;
    if (this.session.selectedTowerInstance) return 'U to upgrade, S to sell, Esc to deselect.';
    if (sim.towers.length === 0) return 'Pick a tower (1-4), then click a free tile beside the path.';
    if (sim.phase === 'build') return 'Click a tower to upgrade or sell it. Space sends the next wave.';
    return 'Enemies that reach the red exit cost health. F changes speed.';
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

const roman = (n: number): string => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);

/**
 * Label, current value and next-level value (null at max level) for the tower panel.
 * Fire rate includes run upgrades (Overclock) so it shows what the tower really does.
 */
function statRows(tower: Tower, now: TowerLevel, next: TowerLevel | null, rateMult: number): [string, string, string | null][] {
  const rate = (l: TowerLevel) => `${+(l.fireRate * rateMult).toFixed(2)}/s`;
  const rows: [string, string, string | null][] = [
    ['Damage', String(now.damage), next && String(next.damage)],
    ['Fire rate', rate(now), next && rate(next)],
    ['Range', `${now.rangeTiles}`, next && `${next.rangeTiles}`],
  ];
  if (now.slow) {
    const slow = (l: TowerLevel) => `${Math.round((1 - l.slow!.factor) * 100)}% / ${l.slow!.duration}s`;
    rows.push(['Slow', slow(now), next && slow(next)]);
  }
  rows.push(['Targets', tower.targeting === 'strongest' ? 'Toughest' : 'First', null]);
  return rows;
}
