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
