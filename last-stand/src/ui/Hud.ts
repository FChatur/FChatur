import { HEROES } from '../art/catalog';
import { cssHex } from '../art/palette';
import { GAME_SPEEDS, type GameSpeed } from '../config/balance';
import type { TileCoord } from '../config/map';
import {
  isGlobalRange,
  MAX_TOWER_LEVEL,
  TARGETING,
  TARGETING_MODES,
  TOWER_ORDER,
  TOWERS,
  type TargetingMode,
  type TowerLevel,
  type TowerTypeId,
} from '../config/towers';
import type { GameEvents } from '../core/events';
import { describeUpgrade, getUpgrade, RARITY_INFO, type UpgradeDef, type UpgradeId } from '../config/upgrades';
import type { Tower } from '../core/types';
import type { GameSession } from '../game/GameSession';
import { heroPortrait, showPortrait } from './portraits';
import { AudioSettings } from './AudioSettings';
import { TUTORIAL_STEPS, TutorialProgress } from './tutorial';
import { towerInfo } from './towerInfo';
import { TowerTooltip } from './TowerTooltip';

/** Converts between page coordinates and map tiles (provided by main.ts, which owns the canvas). */
export interface BoardGeometry {
  /** The map tile under a page point, or null when it's off the map. */
  tileAt(clientX: number, clientY: number): TileCoord | null;
  /** A tile's rectangle in page coordinates. */
  tileRect(col: number, row: number): { left: number; top: number; width: number; height: number };
  /** True when the page point is over the battlefield (not covered by interface). */
  overBoard(clientX: number, clientY: number): boolean;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

const cssColor = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Screen pixels per art pixel for hero portraits: shop cards, the collapsed rail, the tower panel. */
const PORTRAIT_SCALE = { card: 4, compactCard: 3, rail: 2, panel: 3, preview: 2, drag: 3 } as const;
/** Short windows get compact shop cards (keep in sync with the media query in style.css). */
const COMPACT_SHOP = '(max-height: 779px)';
/** A press on a shop card that moves further than this (CSS px) becomes a drag. */
const DRAG_START_PX = 6;
/** The upgrade draft appears this long after its wave is cleared, so the heroes' celebration is seen. */
const DRAFT_REVEAL_MS = 1400;

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
  'screenChanged',
  'muteChanged',
  'countdownChanged',
  'autoWaveChanged',
  'hoverChanged',
  'dragChanged',
  'towerTargetingChanged',
];

/**
 * The HTML overlay: main menu, stats bar, the left tower shop (click or drag to build; collapsible),
 * speed control, wave button, contextual hint, tutorial, selected-tower panel, upgrade draft, pause and
 * game-over screens. Also owns keyboard
 * shortcuts, since they map onto the same actions as the buttons.
 */
export class Hud {
  private readonly wave = el('stat-wave');
  private readonly gold = el('stat-gold');
  private readonly health = el('stat-health');
  private readonly hint = el('hint');
  private readonly startWave = el<HTMLButtonElement>('btn-start-wave');
  private readonly startWaveLabel = el('start-wave-label');
  private readonly towerButtons = new Map<TowerTypeId, HTMLButtonElement>();
  private readonly targetingButtons = new Map<TargetingMode, HTMLButtonElement>();
  private readonly shop = el('shop');
  private readonly dragAvatar = el<HTMLImageElement>('drag-avatar');
  private readonly speedButtons = new Map<GameSpeed, HTMLButtonElement>();
  private readonly panel = el('tower-panel');
  private readonly panelUpgrade = el<HTMLButtonElement>('tp-upgrade');
  private readonly panelSell = el<HTMLButtonElement>('tp-sell');
  private readonly gameOver = el('overlay-gameover');
  private lastHealth = 0;
  private tutorial: TutorialProgress | null = null;
  private readonly tooltip = new TowerTooltip(el('tower-tooltip'));
  /** Tower type whose shop button is hovered or focused, if any. */
  private shopHover: TowerTypeId | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly board: BoardGeometry,
  ) {
    this.buildTowerBar();
    this.buildShopToggle();
    this.buildTargetingButtons();
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
    this.click('btn-restart', () => this.session.restart());
    this.click('btn-gameover-menu', () => this.session.toMenu());
    this.click('btn-play', () => this.session.play());
    this.click('btn-pause', () => this.session.togglePause());
    this.click('btn-resume', () => this.session.setPaused(false));
    this.click('btn-pause-restart', () => this.session.restart());
    this.click('btn-pause-menu', () => this.session.toMenu());
    this.click('btn-mute', () => this.session.toggleMute());
    this.click('btn-menu-mute', () => this.session.toggleMute());
    this.click('btn-autowave', () => this.session.toggleAutoWave());
    this.click('btn-menu-autowave', () => this.session.toggleAutoWave());
    this.click('btn-menu-tutorial', () => {
      if (this.session.tutorialDone) this.session.resetTutorial();
      else this.session.completeTutorial();
      this.startTutorial();
      this.refresh();
    });
    this.click('tutorial-skip', () => this.tutorial?.skip());
    new AudioSettings(session, el('menu-audio'), 'vol-menu', false);
    new AudioSettings(session, el('pause-audio'), 'vol-pause', true);
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Losing focus (switching tabs, alt-tab) pauses a run in progress.
    document.addEventListener('visibilitychange', () => document.hidden && this.session.setPaused(true));
    this.startTutorial();
    // Many events can fire in one frame (a volley of kills); redraw the HUD at most once per frame.
    for (const type of REFRESH_ON) session.bus.on(type, () => this.scheduleRefresh());
    this.refresh();
  }

  private click(id: string, action: () => void): void {
    const btn = el(id);
    btn.addEventListener('click', () => {
      action();
      btn.blur();
    });
  }

  /** (Re)creates tutorial tracking if the player hasn't finished it. */
  private startTutorial(): void {
    this.tutorial?.dispose();
    this.tutorial = this.session.tutorialDone
      ? null
      : new TutorialProgress(this.session.bus, TUTORIAL_STEPS, () => this.renderTutorial(), () => this.session.completeTutorial());
  }

  /** Shop cards: the hero's portrait, names, role, cost and hotkey. Click to arm, or drag onto the map. */
  private buildTowerBar(): void {
    const bar = el('tower-bar');
    for (const id of TOWER_ORDER) {
      const cfg = TOWERS[id];
      const hero = HEROES[id];
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.dataset.tower = id;
      btn.style.setProperty('--tower-color', cssHex(hero.accent));
      btn.setAttribute('aria-label', `${hero.name}, ${cfg.name}, ${cfg.cost} gold. ${cfg.description}`);
      const showInfo = () => {
        this.shopHover = id;
        this.renderTooltip();
      };
      const hideInfo = () => {
        if (this.shopHover === id) this.shopHover = null;
        this.renderTooltip();
      };
      btn.addEventListener('mouseenter', showInfo);
      btn.addEventListener('focus', showInfo);
      btn.addEventListener('mouseleave', hideInfo);
      btn.addEventListener('blur', hideInfo);
      btn.innerHTML = `
        <span class="tower-portrait"><img alt="" draggable="false" /></span>
        <span class="tower-info">
          <span class="tower-hero">${hero.name}</span>
          <span class="tower-name">${cfg.name}</span>
          <span class="tower-role">${hero.role}</span>
          <span class="tower-cost"><span class="coin" aria-hidden="true"></span><span class="tower-cost-value">${cfg.cost}</span></span>
          <span class="tower-need"></span>
        </span>
        <kbd>${cfg.hotkey}</kbd>`;
      this.wireCard(btn, id);
      bar.appendChild(btn);
      this.towerButtons.set(id, btn);
    }
    this.renderShopPortraits();
  }

  /**
   * A click arms the tower for click-to-place (same as its hotkey). Pressing and moving drags it: the
   * map previews the tile under the pointer, and releasing over the map builds there.
   */
  private wireCard(btn: HTMLButtonElement, id: TowerTypeId): void {
    let press: { x: number; y: number; pointer: number } | null = null;
    let dragging = false;
    let swallowClick = false;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || btn.disabled) return;
      press = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
      dragging = false;
      // Keep receiving the pointer's moves after it leaves the card, however fast it moves.
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!press || e.pointerId !== press.pointer) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_START_PX) return;
        if (!this.session.beginDrag(id)) {
          press = null;
          return;
        }
        dragging = true;
        this.shopHover = null;
        showPortrait(this.dragAvatar, heroPortrait(id, 1), PORTRAIT_SCALE.drag);
      }
      this.moveDrag(e.clientX, e.clientY);
    });
    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!press || e.pointerId !== press.pointer) return;
      press = null;
      if (!dragging) return;
      dragging = false;
      swallowClick = true;
      const drop = !cancelled && this.board.overBoard(e.clientX, e.clientY);
      if (drop) this.session.dragOver(this.board.tileAt(e.clientX, e.clientY));
      this.session.endDrag(drop);
      this.dragAvatar.classList.add('hidden');
      btn.blur();
    };
    btn.addEventListener('pointerup', (e) => finish(e, false));
    btn.addEventListener('pointercancel', (e) => finish(e, true));
    btn.addEventListener('click', () => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      this.session.toggleTower(id);
      btn.blur();
    });
  }

  /** Over the map the board shows the ghost; elsewhere a portrait follows the pointer. */
  private moveDrag(x: number, y: number): void {
    const over = this.board.overBoard(x, y);
    this.session.dragOver(over ? this.board.tileAt(x, y) : null);
    this.dragAvatar.classList.toggle('hidden', over || !this.session.drag);
    this.dragAvatar.style.transform = `translate(${Math.round(x - this.dragAvatar.width / 2)}px, ${Math.round(y - this.dragAvatar.height + 12)}px)`;
  }

  private buildShopToggle(): void {
    const toggle = el<HTMLButtonElement>('shop-toggle');
    toggle.addEventListener('click', () => {
      this.session.setShopCollapsed(!this.session.shopCollapsed);
      this.applyShopLayout();
      toggle.blur();
    });
    window.matchMedia(COMPACT_SHOP).addEventListener('change', () => this.renderShopPortraits());
    this.applyShopLayout();
  }

  /** Expanded: large cards. Collapsed: a narrow rail of portraits and costs, giving the map more room. */
  private applyShopLayout(): void {
    const collapsed = this.session.shopCollapsed;
    this.shop.classList.toggle('collapsed', collapsed);
    const toggle = el('shop-toggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? 'Expand the shop' : 'Collapse the shop';
    this.renderShopPortraits();
  }

  private renderShopPortraits(): void {
    const compact = window.matchMedia(COMPACT_SHOP).matches;
    const scale = this.session.shopCollapsed ? PORTRAIT_SCALE.rail : compact ? PORTRAIT_SCALE.compactCard : PORTRAIT_SCALE.card;
    for (const [id, btn] of this.towerButtons) showPortrait(btn.querySelector('img')!, heroPortrait(id, 1), scale);
  }

  private buildTargetingButtons(): void {
    const group = el('tp-targeting');
    for (const mode of TARGETING_MODES) {
      const btn = document.createElement('button');
      btn.className = 'tgt-btn';
      btn.textContent = TARGETING[mode].label;
      btn.title = TARGETING[mode].description;
      btn.addEventListener('click', () => {
        this.session.setTargetingSelected(mode);
        btn.blur();
      });
      group.appendChild(btn);
      this.targetingButtons.set(mode, btn);
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
    const key = e.key.toLowerCase();
    if (key === 'm') {
      this.session.toggleMute();
      return;
    }
    if (this.session.screen === 'menu') {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.session.play();
      }
      return;
    }
    if (key === 'p') {
      this.session.togglePause();
      return;
    }
    if (key === 'a') {
      this.session.toggleAutoWave();
      return;
    }
    if (e.key === 'Escape') {
      const s = this.session;
      if (s.drag) {
        s.endDrag(false);
        this.dragAvatar.classList.add('hidden');
      } else if (s.paused) s.setPaused(false);
      else if (s.selectedTower || s.selectedTowerInstance) s.clearSelection();
      else s.setPaused(true);
      return;
    }
    if (this.session.paused) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.session.startWave();
      return;
    }
    if (sim.phase === 'draft') {
      const choice = sim.draftChoices[Number(e.key) - 1];
      if (choice) this.session.chooseUpgrade(choice);
      return;
    }
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
    if (key === 't') {
      this.session.cycleTargetingSelected();
      return;
    }
    if (key === 'r' && sim.phase === 'gameover') {
      this.session.restart();
      return;
    }
    const tower = TOWER_ORDER.find((id) => TOWERS[id].hotkey === e.key);
    if (tower && sim.phase !== 'gameover') this.session.toggleTower(tower);
  }

  private refreshQueued = false;

  private scheduleRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      this.refresh();
    });
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
      const cost = sim.buildCost(id);
      const short = cost - sim.gold;
      btn.querySelector('.tower-cost-value')!.textContent = cost === 0 ? 'Free' : String(cost);
      btn.classList.toggle('selected', this.session.selectedTower === id || this.session.drag?.type === id);
      btn.classList.toggle('unaffordable', short > 0);
      btn.querySelector('.tower-need')!.textContent = short > 0 ? `Need ${short} more` : '';
      btn.disabled = sim.phase === 'gameover';
    }
    if (!this.session.drag) this.dragAvatar.classList.add('hidden');

    for (const [speed, btn] of this.speedButtons) {
      btn.classList.toggle('active', this.session.speed === speed);
      btn.setAttribute('aria-pressed', String(this.session.speed === speed));
    }

    const building = sim.phase === 'build';
    const countdown = sim.autoWaveCountdown === null ? null : Math.max(1, Math.ceil(sim.autoWaveCountdown));
    this.startWave.disabled = !building;
    this.startWaveLabel.textContent = {
      build: countdown === null ? `Start Wave ${sim.wave + 1}` : `Wave ${sim.wave + 1} in ${countdown}s`,
      wave: `Wave ${sim.wave} in progress`,
      draft: 'Choose an upgrade',
      gameover: 'Run over',
    }[sim.phase];

    const playing = this.session.screen === 'playing';
    el<HTMLButtonElement>('btn-pause').disabled = !playing || sim.phase === 'gameover';
    el('overlay-menu').classList.toggle('hidden', playing);
    el('overlay-pause').classList.toggle('hidden', !this.session.paused);
    el('btn-mute').classList.toggle('muted', this.session.muted);
    el('btn-mute').setAttribute('aria-label', this.session.muted ? 'Unmute sound' : 'Mute sound');
    el('btn-menu-mute').textContent = `Sound: ${this.session.muted ? 'Off' : 'On'}`;
    el('btn-menu-tutorial').textContent = `Tutorial: ${this.session.tutorialDone ? 'Off' : 'On'}`;
    el('btn-menu-autowave').textContent = `Auto Wave: ${this.session.autoWave ? 'On' : 'Off'}`;
    el('btn-autowave').setAttribute('aria-pressed', String(this.session.autoWave));
    el('autowave-state').textContent = this.session.autoWave ? 'On' : 'Off';
    el('wave-countdown').classList.toggle('hidden', countdown === null || !playing);
    if (countdown !== null) el('wave-countdown-seconds').textContent = String(countdown);
    const record = this.session.record;
    el('menu-record').textContent = record
      ? `Best on ${sim.map.name}: wave ${record.bestWave} (${record.runs} ${record.runs === 1 ? 'run' : 'runs'})`
      : `${sim.map.name}: no runs yet.`;

    this.hint.textContent = this.hintText();
    this.renderTutorial();
    this.renderTooltip();
    this.renderUpgradeList();
    this.renderDraft();
    this.renderTowerPanel();
    this.renderGameOver();
  }

  /**
   * Shop buttons show the base tower; towers on the board show their current level and run bonuses.
   * Hidden whenever a menu, pause, upgrade pick or game-over screen is up, and for the selected tower
   * (its panel already shows the details).
   */
  private renderTooltip(): void {
    const s = this.session;
    const sim = s.sim;
    const active = s.screen === 'playing' && !s.paused && sim.phase !== 'draft' && sim.phase !== 'gameover';
    if (active && this.shopHover) {
      const btn = this.towerButtons.get(this.shopHover)!;
      this.tooltip.show(towerInfo(this.shopHover, { cost: sim.buildCost(this.shopHover) }), btn.getBoundingClientRect(), ['right', 'below']);
      return;
    }
    const t = s.hoveredTower;
    if (!active || !t || t === s.selectedTowerInstance) {
      this.tooltip.hide();
      return;
    }
    this.tooltip.show(
      towerInfo(t.type, { level: t.level, mods: sim.mods, targeting: t.targeting }),
      this.towerScreenRect(t),
      ['right', 'left', 'below', 'above'],
    );
  }

  /** A built tower's tile in page coordinates. */
  private towerScreenRect(t: Tower): { left: number; top: number; width: number; height: number } {
    return this.board.tileRect(t.col, t.row);
  }

  private renderTutorial(): void {
    const t = this.tutorial;
    const show =
      !!t && !t.finished && this.session.screen === 'playing' && !this.session.paused && this.session.sim.phase !== 'gameover';
    el('tutorial').classList.toggle('hidden', !show);
    if (!show || !t.current) return;
    const { step, total } = t.position;
    el('tutorial-step').textContent = `TUTORIAL ${step}/${total}`;
    el('tutorial-text').textContent = t.current.text;
  }

  private renderedUpgradeList = '';

  private renderUpgradeList(): void {
    const html = this.session.sim.mods
      .owned()
      .map(([def, n]) => {
        const stacks = def.maxStacks > 1 ? ` ${roman(n)}` : '';
        return `<span class="upgrade-chip" style="--chip-color:${cssColor(def.color)}" title="${describe(def, n)}">${def.name}${stacks}</span>`;
      })
      .join('');
    // Only touch the DOM when the owned upgrades actually change.
    if (html === this.renderedUpgradeList) return;
    this.renderedUpgradeList = html;
    el('upgrade-list').innerHTML = html;
  }

  /** Rebuilt only when a new offer appears, so cards don't flicker while the player decides. */
  private renderedDraft = '';
  /** When the current offer may be shown (after the heroes' victory celebration). */
  private draftRevealAt = 0;

  private renderDraft(): void {
    const sim = this.session.sim;
    const offered = sim.phase === 'draft';
    const key = offered ? `${sim.wave}:${sim.draftChoices.join()}` : '';
    if (key !== this.renderedDraft && offered) {
      // The game is already halted for the pick; holding the cards back a moment lets the heroes'
      // celebration be seen (the 1-3 keys work straight away).
      this.draftRevealAt = performance.now() + DRAFT_REVEAL_MS;
      setTimeout(() => this.scheduleRefresh(), DRAFT_REVEAL_MS + 20);
    }
    el('overlay-draft').classList.toggle('hidden', !offered || performance.now() < this.draftRevealAt);
    if (key === this.renderedDraft) return;
    this.renderedDraft = key;
    const cards = el('draft-cards');
    cards.replaceChildren();
    if (!open) return;
    el('draft-wave').textContent = String(sim.wave);
    sim.draftChoices.forEach((id, i) => cards.appendChild(this.draftCard(id, i + 1)));
  }

  private draftCard(id: UpgradeId, index: number): HTMLButtonElement {
    const def = getUpgrade(id);
    const rank = this.session.sim.mods.stacksOf(id);
    const rarity = RARITY_INFO[def.rarity];
    const stacking =
      def.maxStacks === 1
        ? 'Unique'
        : rank === 0
          ? `New · max ${roman(def.maxStacks)}`
          : `Rank ${roman(rank)} → ${roman(rank + 1)}${rank + 1 === def.maxStacks ? ' (max)' : ''}`;
    const btn = document.createElement('button');
    btn.className = 'draft-card';
    btn.style.setProperty('--card-color', cssColor(def.color));
    btn.style.setProperty('--rarity-color', cssColor(rarity.color));
    btn.innerHTML = `
      <span class="draft-rarity">${rarity.label}</span>
      <span class="draft-rank">${stacking}</span>
      <h3>${def.name}</h3>
      <p class="draft-desc">${describe(def, rank + 1)}</p>
      ${rank > 0 ? `<p class="draft-now">Now: ${describe(def, rank)}</p>` : ''}
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
    const hero = HEROES[tower.type];
    const current = cfg.levels[tower.level - 1];
    const next = tower.level < MAX_TOWER_LEVEL ? cfg.levels[tower.level] : null;

    // Sits on the side of the map away from the tower, so it never covers the tower or its range.
    this.panel.classList.toggle('tp-left', tower.col >= sim.map.grid.cols / 2);
    this.panel.style.setProperty('--tower-color', cssHex(hero.accent));
    showPortrait(el<HTMLImageElement>('tp-portrait'), heroPortrait(tower.type, tower.level), PORTRAIT_SCALE.panel);
    el('tp-hero').textContent = `${hero.name} · ${hero.ranks[tower.level - 1]}`;
    el('tp-name').textContent = cfg.name;
    el('tp-level').textContent = `LV ${tower.level}/${MAX_TOWER_LEVEL}`;
    el('tp-stats').innerHTML = statRows(current, next, sim.mods.forTower(tower.type).fireRateMultiplier)
      .map(([label, now, then]) => `<dt>${label}</dt><dd>${now}${then && then !== now ? ` <span class="tp-next">→ ${then}</span>` : ''}</dd>`)
      .join('');

    // Upgrade preview: the next level's look, so the player sees what they're buying.
    el('tp-preview').classList.toggle('hidden', !next);
    if (next) {
      el('tp-next-rank').textContent = `${hero.ranks[tower.level]} (LV ${tower.level + 1})`;
      showPortrait(el<HTMLImageElement>('tp-next-portrait'), heroPortrait(tower.type, tower.level + 1), PORTRAIT_SCALE.preview);
      el('tp-next-looks').textContent = hero.looks[tower.level];
    }

    for (const [mode, btn] of this.targetingButtons) {
      btn.classList.toggle('active', tower.targeting === mode);
      btn.setAttribute('aria-pressed', String(tower.targeting === mode));
    }

    const upgrade = sim.canUpgradeTower(tower);
    this.panelUpgrade.disabled = !upgrade.ok;
    el('tp-upgrade-cost').textContent = next ? `${next.upgradeCost}g` : '(max)';
    this.panelUpgrade.classList.toggle('unaffordable', !upgrade.ok && upgrade.reason === 'insufficient-gold');
    el('tp-sell-value').textContent = `+${sim.sellValue(tower)}g`;
    this.panelSell.title = tower.free ? 'Your free starter tower: selling it returns no gold.' : '';
  }

  private hintText(): string {
    const sim = this.session.sim;
    const selected = this.session.selectedTower;
    if (sim.phase === 'gameover') return '';
    if (sim.phase === 'draft') return 'Pick an upgrade (1-3) to continue.';
    if (this.session.drag) return 'Release on a free tile to build. Release elsewhere or press Esc to cancel.';
    if (selected) return `Click a free tile to build a ${TOWERS[selected].name}. Right-click or Esc to cancel.`;
    if (this.session.selectedTowerInstance) return 'U to upgrade, S to sell, T to change targeting, Esc to deselect.';
    if (sim.phase === 'build' && sim.autoWaveCountdown !== null) return 'Next wave starts automatically. Keep building, or Space to send it now.';
    if (sim.towers.length === 0) return 'Drag a tower from the shop onto a free tile beside the path, or press 1-4 and click.';
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
    const last = this.session.lastRun;
    el('go-best').innerHTML = last
      ? `Personal best: wave ${last.record.bestWave}${last.newBest ? ' <span class="new-best">New best!</span>' : ''}`
      : '';
  }
}

const describe = (def: UpgradeDef, stacks: number): string => describeUpgrade(def, stacks, (t) => TOWERS[t].name);

const rangeLabel = (l: TowerLevel): string => (isGlobalRange(l.rangeTiles) ? 'Global' : `${l.rangeTiles} tiles`);

const roman = (n: number): string => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);

/**
 * Label, current value and next-level value (null at max level) for the tower panel. Targeting has its
 * own buttons below the stats.
 * Fire rate includes run upgrades (Overclock) so it shows what the tower really does.
 */
function statRows(now: TowerLevel, next: TowerLevel | null, rateMult: number): [string, string, string | null][] {
  const rate = (l: TowerLevel) => `${+(l.fireRate * rateMult).toFixed(2)}/s`;
  const rows: [string, string, string | null][] = [
    ['Damage', String(now.damage), next && String(next.damage)],
    ['Attack speed', rate(now), next && rate(next)],
    ['Range', rangeLabel(now), next && rangeLabel(next)],
  ];
  if (now.slow) {
    const slow = (l: TowerLevel) => `${Math.round((1 - l.slow!.factor) * 100)}% / ${l.slow!.duration}s`;
    rows.push(['Slow', slow(now), next && slow(next)]);
  }
  return rows;
}
