import { BALANCE } from '../config/balance';
import { ENEMIES } from '../config/enemies';
import { isGlobalRange, MAX_TOWER_LEVEL, TARGETING, TOWERS, type TargetingMode, type TowerTypeId } from '../config/towers';
import type { RunModifiers, TowerModifiers } from '../core/modifiers';
import { mitigate } from '../core/Simulation';

/**
 * Everything a tower tooltip (or, later, a tap-to-inspect panel on mobile) shows, built purely from
 * data. No DOM and no per-tower code: a new tower in config/towers.ts gets a complete card for free.
 */
export interface TowerInfo {
  type: TowerTypeId;
  name: string;
  role: string;
  description: string;
  color: number;
  /** Shop: build cost. Built tower: current level. */
  badge: { kind: 'cost'; gold: number } | { kind: 'level'; level: number; max: number };
  stats: TowerStat[];
  /** Special mechanics explained in plain English. */
  traits: TowerTrait[];
  /** Built towers only: active run-upgrade effects and the upgrades that grant them. */
  bonuses: string[];
  bonusSources: string[];
}

export interface TowerStat {
  label: string;
  value: string;
  /** Short note when run upgrades change the value, e.g. "+30%". */
  boost?: string;
}

export interface TowerTrait {
  title: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => `${+n.toFixed(2)}`;

/** The heaviest armor among regular (non-boss) enemies: the yardstick for armor explanations. */
function armorYardstick() {
  const armored = Object.values(ENEMIES)
    .filter((e) => e.shape !== 'boss')
    .sort((a, b) => b.armor - a.armor)[0];
  return armored && armored.armor > 0 ? armored : null;
}

/**
 * @param level     1-based level; the shop shows level 1.
 * @param mods      The run's upgrades, for built towers; omitted in the shop.
 * @param targeting A built tower's current targeting mode; the shop shows the default.
 * @param cost      What building it costs now (the run's free starter costs 0); defaults to the list price.
 */
export function towerInfo(
  type: TowerTypeId,
  opts: { level?: number; mods?: RunModifiers; targeting?: TargetingMode; cost?: number } = {},
): TowerInfo {
  const cfg = TOWERS[type];
  const level = opts.level ?? 1;
  const targeting = opts.targeting ?? cfg.targeting;
  const stats = cfg.levels[level - 1];
  const m: TowerModifiers | null = opts.mods ? opts.mods.forTower(type) : null;
  const rate = stats.fireRate * (m?.fireRateMultiplier ?? 1);
  const global = isGlobalRange(stats.rangeTiles);

  const out: TowerInfo = {
    type,
    name: cfg.name,
    role: cfg.role,
    description: cfg.description,
    color: cfg.color,
    badge: opts.mods ? { kind: 'level', level, max: MAX_TOWER_LEVEL } : { kind: 'cost', gold: opts.cost ?? cfg.cost },
    stats: [
      { label: 'Damage', value: `${stats.damage}` },
      {
        label: 'Attack speed',
        value: `${num(rate)}/s`,
        boost: m && m.fireRateMultiplier > 1 ? `+${pct(m.fireRateMultiplier - 1)}` : undefined,
      },
      { label: 'Range', value: global ? 'Global' : `${stats.rangeTiles} tiles` },
      { label: 'Targeting', value: TARGETING[targeting].label },
    ],
    traits: [],
    bonuses: [],
    bonusSources: [],
  };

  if (global) {
    out.traits.push({ title: 'Global range', text: 'Can hit enemies anywhere on the map, so placement doesn’t matter.', tone: 'good' });
  }
  if (targeting !== 'first') {
    out.traits.push({ title: `Targets ${TARGETING[targeting].label}`, text: TARGETING[targeting].description, tone: 'neutral' });
  }
  if (stats.slow) {
    out.traits.push({
      title: 'Slows',
      text: `Hits slow enemies by ${pct(1 - stats.slow.factor)} for ${stats.slow.duration}s. Slows don’t stack; the strongest one applies.`,
      tone: 'good',
    });
  }
  const armored = armorYardstick();
  if (armored) {
    const through = mitigate(stats.damage, armored.armor, BALANCE.armorMinDamageFraction) / stats.damage;
    const plural = `${armored.name}s`;
    if (through >= 0.85) {
      out.traits.push({
        title: 'Strong vs armor',
        text: `Big hits shrug off armor: ${plural} block only ${armored.armor} of its ${stats.damage} damage.`,
        tone: 'good',
      });
    } else if (through <= 0.5) {
      out.traits.push({
        title: 'Weak vs armor',
        text: `${plural} block ${armored.armor} damage from every hit. With ${stats.damage} damage per hit, only ${pct(through)} gets through.`,
        tone: 'bad',
      });
    } else {
      out.traits.push({
        title: 'Armor',
        text: `${plural} block ${armored.armor} of each ${stats.damage}-damage hit (${pct(through)} gets through).`,
        tone: 'neutral',
      });
    }
  }

  if (m && opts.mods) {
    if (m.critChance > 0) out.bonuses.push(`${pct(m.critChance)} chance to deal ${m.critMultiplier}x damage`);
    if (m.slowedDamageMultiplier > 1) out.bonuses.push(`+${pct(m.slowedDamageMultiplier - 1)} damage to slowed enemies`);
    if (m.splashFraction > 0) out.bonuses.push(`Hits splash ${pct(m.splashFraction)} damage nearby`);
    if (m.chainBounces > 0) out.bonuses.push(`Hits chain to ${m.chainBounces} more ${m.chainBounces === 1 ? 'enemy' : 'enemies'}`);
    // Attack speed bonuses show on the stat itself (e.g. "7.8/s +30%"), so they aren't repeated here.
    out.bonusSources = opts.mods
      .owned()
      .filter(([def]) => !def.towers || def.towers.includes(type))
      .filter(([def]) => def.effects.some((e) => e.kind !== 'interest'))
      .map(([def, n]) => (def.maxStacks > 1 ? `${def.name} ${n}` : def.name));
  }
  return out;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Places a tooltip next to `anchor` without leaving the viewport. Tries the preferred sides in order
 * and uses the first that fits; otherwise clamps the best one into view.
 */
export function placeTooltip(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  prefer: readonly ('above' | 'below' | 'right' | 'left')[],
  gap = 10,
  margin = 8,
): { left: number; top: number } {
  const centreX = anchor.left + anchor.width / 2 - size.width / 2;
  const centreY = anchor.top + anchor.height / 2 - size.height / 2;
  const options = {
    above: { left: centreX, top: anchor.top - gap - size.height },
    below: { left: centreX, top: anchor.top + anchor.height + gap },
    right: { left: anchor.left + anchor.width + gap, top: centreY },
    left: { left: anchor.left - gap - size.width, top: centreY },
  };
  const fits = (p: { left: number; top: number }) =>
    p.left >= margin &&
    p.top >= margin &&
    p.left + size.width <= viewport.width - margin &&
    p.top + size.height <= viewport.height - margin;
  const clamp = (p: { left: number; top: number }) => ({
    left: Math.min(Math.max(p.left, margin), Math.max(margin, viewport.width - margin - size.width)),
    top: Math.min(Math.max(p.top, margin), Math.max(margin, viewport.height - margin - size.height)),
  });
  // A side "fits" if only the cross-axis needs clamping (e.g. above but nudged sideways).
  for (const side of prefer) {
    const p = clamp(options[side]);
    const mainAxisOk =
      side === 'above' || side === 'below' ? p.top === options[side].top : p.left === options[side].left;
    if (mainAxisOk && fits(p)) return p;
  }
  return clamp(options[prefer[0]]);
}
