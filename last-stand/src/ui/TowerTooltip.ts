import { placeTooltip, type Rect, type TowerInfo } from './towerInfo';

const cssColor = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const COIN_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>';

const TONE_ICON: Record<string, string> = { good: '▲', bad: '▼', neutral: '●' };

/**
 * Renders any TowerInfo as a floating card. Purely presentational: it never receives pointer events,
 * so it can't block placement or selection. The same TowerInfo can be shown elsewhere (e.g. a
 * tap-to-inspect sheet on mobile) without changing how the content is produced.
 */
export class TowerTooltip {
  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  show(info: TowerInfo, anchor: Rect, prefer: readonly ('above' | 'below' | 'right' | 'left')[]): void {
    this.el.innerHTML = render(info);
    this.el.style.setProperty('--tower-color', cssColor(info.color));
    this.el.classList.remove('hidden');
    // Measure after rendering, then place within the window.
    const size = { width: this.el.offsetWidth, height: this.el.offsetHeight };
    const pos = placeTooltip(anchor, size, { width: window.innerWidth, height: window.innerHeight }, prefer);
    this.el.style.left = `${Math.round(pos.left)}px`;
    this.el.style.top = `${Math.round(pos.top)}px`;
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}

function render(info: TowerInfo): string {
  const badge =
    info.badge.kind === 'cost'
      ? `<span class="tt-cost">${COIN_ICON}${info.badge.gold}</span>`
      : `<span class="tt-level">Level ${info.badge.level}/${info.badge.max}</span>`;
  const stats = info.stats
    .map(
      (s) =>
        `<div class="tt-stat"><dt>${escape(s.label)}</dt><dd>${escape(s.value)}${s.boost ? ` <span class="tt-boost">${escape(s.boost)}</span>` : ''}</dd></div>`,
    )
    .join('');
  const traits = info.traits
    .map(
      (t) =>
        `<div class="tt-trait tt-${t.tone}"><p class="tt-trait-title"><span aria-hidden="true">${TONE_ICON[t.tone]}</span>${escape(t.title)}</p><p>${escape(t.text)}</p></div>`,
    )
    .join('');
  const bonuses = info.bonuses.length
    ? `<div class="tt-bonuses"><p class="tt-section">Run bonuses${info.bonusSources.length ? ` <span>(${escape(info.bonusSources.join(', '))})</span>` : ''}</p><ul>${info.bonuses.map((b) => `<li>${escape(b)}</li>`).join('')}</ul></div>`
    : '';
  // Built towers skip the description: the shop card already explained it, and a shorter card covers
  // less of the battlefield.
  const desc = info.badge.kind === 'cost' ? `<p class="tt-desc">${escape(info.description)}</p>` : '<hr class="tt-rule">';
  return `
    <header class="tt-header">
      <span class="tt-icon"><span></span></span>
      <div class="tt-titles">
        <div class="tt-name-row"><h3>${escape(info.name)}</h3>${badge}</div>
        <p>${escape(info.role)}</p>
      </div>
    </header>
    ${desc}
    <dl class="tt-stats">${stats}</dl>
    ${traits}
    ${bonuses}`;
}
