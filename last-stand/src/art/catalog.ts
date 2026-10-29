import { COLORS } from './palette';
import type { EnemyTypeId } from '../config/enemies';
import type { TowerTypeId } from '../config/towers';

/**
 * How each game entity is drawn: which atlas animations it uses and how they are timed. Gameplay config
 * never refers to art; this is the only bridge, so new content needs one entry here (a test checks).
 */

export interface CreatureArt {
  /** Walk or run animation in the atlas (4 frames, facing right). */
  walk: string;
  /** World units travelled per animation frame, so feet never slide and slowed creatures walk slower. */
  stride: number;
  /** Art pixels from the creature's path position down to its feet (bodies stand centred on the road). */
  feet: number;
  /** Health bar width in art pixels. */
  barWidth: number;
}

export const CREATURE_ART: Record<EnemyTypeId, CreatureArt> = {
  basic: { walk: 'goblin-walk', stride: 9, feet: 5, barWidth: 12 },
  runner: { walk: 'wolf-run', stride: 14, feet: 5, barWidth: 14 },
  armored: { walk: 'orc-walk', stride: 8, feet: 6, barWidth: 14 },
  boss: { walk: 'ogre-walk', stride: 8, feet: 9, barWidth: 26 },
};

export type DefenderKind = 'archer' | 'ballista' | 'mage';

export interface TowerArtInfo {
  defender: DefenderKind;
  /** Projectile animation in the atlas. */
  projectile: string;
  /** Arc height as a fraction of the shot's length (0 = flies straight). */
  arc: number;
  /** Effect animation played where a shot hits. */
  impact: string;
}

export const TOWER_ART: Record<TowerTypeId, TowerArtInfo> = {
  basic: { defender: 'archer', projectile: 'arrow', arc: 0.16, impact: 'hit-spark' },
  sniper: { defender: 'ballista', projectile: 'bolt', arc: 0, impact: 'heavy-impact' },
  rapid: { defender: 'archer', projectile: 'ranger-arrow', arc: 0.08, impact: 'hit-spark' },
  frost: { defender: 'mage', projectile: 'shard', arc: 0, impact: 'frost-burst' },
};

/** The named hero who mans each tower: shown on shop cards, the tower panel and its upgrade preview. */
export interface HeroInfo {
  name: string;
  /** One line on the shop card. */
  role: string;
  /** Card and panel accent (an art palette colour). */
  accent: number;
  /** Title per tower level. */
  ranks: readonly string[];
  /** What visibly changes at each level (shown in the upgrade preview). */
  looks: readonly string[];
}

export const HEROES: Record<TowerTypeId, HeroInfo> = {
  basic: {
    name: 'Wren',
    role: 'Dependable all-rounder',
    accent: COLORS.red3,
    ranks: ['Recruit', 'Veteran', 'Captain'],
    looks: ['Timber lookout', 'Stone tower, feather and steel pauldron', 'Keep with banners, gold-trimmed hood, cape and gilded bow'],
  },
  sniper: {
    name: 'Brakk',
    role: 'Heavy artillery, any range',
    accent: COLORS.gold3,
    ranks: ['Engineer', 'Siege Master', 'Iron Marshal'],
    looks: ['Plank deck and wooden crossbow', 'Sandbagged emplacement, iron-banded bow, apron and lamp', 'Iron bunker, steel and gold bow, gold crest'],
  },
  rapid: {
    name: 'Fen',
    role: 'Rapid-fire sharpshooter',
    accent: COLORS.grass5,
    ranks: ['Scout', 'Pathfinder', 'Warden'],
    looks: ['Mossy stump', 'Sapling platform, leaf circlet, second quiver', 'Great tree with lanterns, glowing bow and a falcon'],
  },
  frost: {
    name: 'Old Rime',
    role: 'Slows the horde',
    accent: COLORS.frost4,
    ranks: ['Hedge Mage', 'Frost Sage', 'Archmage'],
    looks: ['Rune stone', 'Frozen pillar and a taller hat', 'Floating ice dais, crystal on the hat, gold stars'],
  },
};
