/**
 * Audio tuning: default volumes, music levels per game state, fade times, and the soundtrack's chunk
 * manifest. Like the other config files, numbers live here, not in the audio code.
 */

export type VolumeChannel = 'master' | 'music' | 'sfx';

export const AUDIO = {
  /** Slider positions (0..1) for new players. Existing players keep their old level as Master. */
  defaultVolumes: { master: 0.8, music: 0.75, sfx: 1 } satisfies Record<VolumeChannel, number>,
  /** Gain = slider ^ curve, so 50% on a slider sounds about half as loud. */
  sliderCurve: 2,
  /** Music level multipliers (applied on top of the volume sliders). */
  musicLevels: {
    /** Pause menu open: quieter and muffled, not stopped. */
    paused: 0.35,
    /** Upgrade draft on screen. */
    draft: 0.7,
    /** Window visible but not focused (another window in front). */
    unfocused: 0.5,
  },
  /** Low-pass cutoff (Hz) for the muffled music in the pause menu. */
  pausedLowpassHz: 900,
  /** Seconds. */
  fades: {
    musicIn: 0.6,
    /** Back to the main menu. */
    musicOutToMenu: 0.8,
    musicOutGameOver: 2,
    /** A new run replaces the old one's music. */
    musicOutRestart: 0.4,
    /** Time constant for level changes (pause, draft, focus): ~95% there after three of these. */
    levelChange: 0.15,
    /** Mute, unmute, slider moves, tab hidden and shown. */
    output: 0.05,
    /** Hiding the tab: fade out over this, then suspend the audio context. */
    hide: 0.2,
  },
  /** Music scheduling: keep this many seconds queued ahead of the audio clock. */
  musicLookahead: 4,
  /** Overlap between consecutive music chunks (seconds), crossfaded linearly; hides rounding at joins. */
  chunkOverlap: 0.005,
  /** Master limiter (a DynamicsCompressor used as a brick wall) so stacked sounds never clip. */
  limiter: { thresholdDb: -1, kneeDb: 0, ratio: 20, attack: 0.002, release: 0.15 },
} as const;

/** One encoded piece of a soundtrack: `start` and `length` in samples of the edit, at `sampleRate`. */
export interface MusicChunk {
  file: string;
  start: number;
  length: number;
}

/**
 * A soundtrack prepared by tools/prepare-music.py: an intro played once, then chunks from `loopChunk`
 * to the end repeat forever. Every chunk file also holds `margin` samples of the neighbouring audio on
 * both sides; only the core is played.
 */
export interface SoundtrackManifest {
  id: string;
  title: string;
  sampleRate: number;
  margin: number;
  loopChunk: number;
  chunks: readonly MusicChunk[];
}

/** "Picnic at the Tower Gate" (Google Gemini, 2026-10-29). Provenance and licensing: docs/AUDIO.md. */
export const SOUNDTRACK: SoundtrackManifest = {
  id: 'picnic-at-the-tower-gate',
  title: 'Picnic at the Tower Gate',
  sampleRate: 44100,
  margin: 11025,
  loopChunk: 4,
  chunks: [
    { file: '00', start: 0, length: 436528 },
    { file: '01', start: 436528, length: 436527 },
    { file: '02', start: 873055, length: 436527 },
    { file: '03', start: 1309582, length: 436528 },
    { file: '04', start: 1746110, length: 384873 },
    { file: '05', start: 2130983, length: 384873 },
    { file: '06', start: 2515856, length: 384872 },
    { file: '07', start: 2900728, length: 384873 },
    { file: '08', start: 3285601, length: 384873 },
    { file: '09', start: 3670474, length: 384872 },
    { file: '10', start: 4055346, length: 384873 },
    { file: '11', start: 4440219, length: 384873 },
    { file: '12', start: 4825092, length: 384873 },
    { file: '13', start: 5209965, length: 384873 },
    { file: '14', start: 5594838, length: 384872 },
    { file: '15', start: 5979710, length: 384873 },
  ],
};
