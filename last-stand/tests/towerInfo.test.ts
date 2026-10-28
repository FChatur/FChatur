import { describe, expect, it } from 'vitest';
import { TOWER_ORDER, TOWERS } from '../src/config/towers';
import { RunModifiers } from '../src/core/modifiers';
import { UPGRADES } from '../src/config/upgrades';
import { placeTooltip, towerInfo } from '../src/ui/towerInfo';

const stat = (info: ReturnType<typeof towerInfo>, label: string) => info.stats.find((s) => s.label === label)!;
const trait = (info: ReturnType<typeof towerInfo>, title: string) => info.traits.find((t) => t.title === title);

describe('towerInfo', () => {
  it('builds a complete card for every tower with the same fields and labels', () => {
    for (const type of TOWER_ORDER) {
      const info = towerInfo(type);
      expect(info.name).toBe(TOWERS[type].name);
      expect(info.role.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(info.badge).toEqual({ kind: 'cost', gold: TOWERS[type].cost });
      expect(info.stats.map((s) => s.label)).toEqual(['Damage', 'Attack speed', 'Range', 'Targeting']);
      // Every tower explains how it fares against armor.
      expect(info.traits.some((t) => /armor/i.test(t.title))).toBe(true);
    }
  });

  it('shows Global range and toughest targeting for the Sniper', () => {
    const info = towerInfo('sniper');
    expect(stat(info, 'Range').value).toBe('Global');
    expect(stat(info, 'Targeting').value).toBe('Toughest');
    expect(trait(info, 'Global range')).toBeDefined();
    expect(trait(info, 'Strong vs armor')?.tone).toBe('good');
  });

  it('explains in plain English why Rapid struggles against armor', () => {
    const t = trait(towerInfo('rapid'), 'Weak vs armor');
    expect(t?.tone).toBe('bad');
    expect(t?.text).toMatch(/Brutes block 4 damage from every hit/);
    expect(t?.text).toMatch(/only \d+% gets through/);
    expect(stat(towerInfo('basic'), 'Range').value).toBe(`${TOWERS.basic.levels[0].rangeTiles} tiles`);
  });

  it('describes Frost slows', () => {
    expect(trait(towerInfo('frost'), 'Slows')?.text).toMatch(/slow enemies by 40% for 1.5s/);
  });

  it('shows current level stats and active run bonuses for built towers', () => {
    const mods = new RunModifiers(UPGRADES);
    mods.add('overclock');
    mods.add('overclock');
    mods.add('criticalStrike');
    mods.add('compoundInterest'); // economy only: not a tower bonus
    const info = towerInfo('basic', { level: 3, mods });
    expect(info.badge).toEqual({ kind: 'level', level: 3, max: 3 });
    expect(stat(info, 'Damage').value).toBe(String(TOWERS.basic.levels[2].damage));
    expect(stat(info, 'Attack speed').value).toBe(`${+(TOWERS.basic.levels[2].fireRate * 1.3).toFixed(2)}/s`);
    expect(stat(info, 'Attack speed').boost).toBe('+30%');
    expect(info.bonuses).toContain('15% chance to deal 2x damage');
    // Attack speed is shown on the stat, not repeated in the bonus list.
    expect(info.bonuses.some((b) => /attack speed/.test(b))).toBe(false);
    expect(info.bonusSources).toEqual(['Overclock 2', 'Critical Strike 1']);
  });

  it('has no bonus section in the shop', () => {
    expect(towerInfo('basic').bonuses).toEqual([]);
  });
});

describe('placeTooltip', () => {
  const view = { width: 1280, height: 720 };
  const size = { width: 300, height: 260 };

  it('uses the preferred side when it fits', () => {
    const p = placeTooltip({ left: 400, top: 300, width: 60, height: 60 }, size, view, ['right', 'left']);
    expect(p.left).toBe(470);
  });

  it('flips to the other side near the right edge', () => {
    const p = placeTooltip({ left: 1200, top: 300, width: 60, height: 60 }, size, view, ['right', 'left']);
    expect(p.left + size.width).toBeLessThanOrEqual(1200);
  });

  it('stays inside the window near every edge', () => {
    for (const anchor of [
      { left: 0, top: 0, width: 40, height: 40 },
      { left: 1240, top: 680, width: 40, height: 40 },
      { left: 20, top: 690, width: 120, height: 30 },
    ]) {
      const p = placeTooltip(anchor, size, view, ['above', 'right', 'left', 'below']);
      expect(p.left).toBeGreaterThanOrEqual(8);
      expect(p.top).toBeGreaterThanOrEqual(8);
      expect(p.left + size.width).toBeLessThanOrEqual(view.width - 8);
      expect(p.top + size.height).toBeLessThanOrEqual(view.height - 8);
    }
  });

  it('never covers its anchor when there is room beside it', () => {
    const anchor = { left: 600, top: 300, width: 60, height: 60 };
    const p = placeTooltip(anchor, size, view, ['right', 'left']);
    const overlaps = p.left < anchor.left + anchor.width && p.left + size.width > anchor.left && p.top < anchor.top + anchor.height && p.top + size.height > anchor.top;
    expect(overlaps).toBe(false);
  });
});
