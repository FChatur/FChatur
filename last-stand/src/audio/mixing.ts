import { AUDIO, type MusicChunk, type SoundtrackManifest, type VolumeChannel } from '../config/audio';
import type { Phase } from '../core/types';
import type { Screen } from '../core/events';

/**
 * Pure audio rules (no Web Audio), so they can be unit-tested: volume curves, the music level for each
 * game state, and the order and timing of soundtrack chunks.
 */

export type Volumes = Record<VolumeChannel, number>;

/** Slider position (0..1) to linear gain, on a perceptual curve. */
export function sliderGain(slider: number): number {
  const v = Math.min(1, Math.max(0, Number.isFinite(slider) ? slider : 0));
  return v ** AUDIO.sliderCurve;
}

/** Linear gains for the three buses. Music and SFX are multiplied by Master downstream, not here. */
export function busGains(volumes: Volumes, muted: boolean): Volumes {
  return {
    master: muted ? 0 : sliderGain(volumes.master),
    music: sliderGain(volumes.music),
    sfx: sliderGain(volumes.sfx),
  };
}

/** True when nothing can be heard, so the audio context may be suspended to save battery. */
export function silent(volumes: Volumes, muted: boolean): boolean {
  return muted || volumes.master <= 0;
}

/** Converts the old single `volume` setting (a linear gain) to a Master slider with the same loudness. */
export function sliderForGain(gain: number): number {
  return Math.round(Math.min(1, Math.max(0, gain)) ** (1 / AUDIO.sliderCurve) * 100) / 100;
}

export interface MusicInputs {
  screen: Screen;
  paused: boolean;
  phase: Phase;
  /** The window has focus (a visible but unfocused window gets quieter music). */
  focused: boolean;
}

export interface MusicTarget {
  /** Whether the soundtrack should be playing at all. */
  play: boolean;
  /** Level multiplier on top of the Music slider. */
  level: number;
  /** Low-pass the music (pause menu). */
  muffled: boolean;
}

/**
 * What the music should do in a given game state. Music plays during a run (from pressing Play until the
 * run ends); the main menu and the game-over screen are quiet.
 */
export function musicTarget(s: MusicInputs): MusicTarget {
  const play = s.screen === 'playing' && s.phase !== 'gameover';
  let level = 1;
  if (s.paused) level *= AUDIO.musicLevels.paused;
  else if (s.phase === 'draft') level *= AUDIO.musicLevels.draft;
  if (!s.focused) level *= AUDIO.musicLevels.unfocused;
  return { play, level: play ? level : 0, muffled: play && s.paused };
}

/** The chunk that plays after chunk `i`: the next one, or back to the loop start after the last. */
export function chunkAfter(track: SoundtrackManifest, i: number): number {
  return i + 1 < track.chunks.length ? i + 1 : track.loopChunk;
}

/** Seconds a chunk's core lasts. */
export function chunkSeconds(track: SoundtrackManifest, chunk: MusicChunk): number {
  return chunk.length / track.sampleRate;
}

/**
 * How to play one chunk so it joins its neighbours: start the source `overlap` seconds before its core
 * (`when` is the core's start on the audio clock), from that point in the file, for the core plus an
 * overlap at each end. Both overlaps are crossfaded linearly with the neighbouring chunks, which play the
 * same audio there.
 */
export function chunkPlayback(
  track: SoundtrackManifest,
  chunk: MusicChunk,
  when: number,
  overlap: number = AUDIO.chunkOverlap,
): { startAt: number; offset: number; duration: number; fadeInEnd: number; fadeOutStart: number; end: number } {
  const margin = track.margin / track.sampleRate;
  const core = chunkSeconds(track, chunk);
  return {
    startAt: when - overlap,
    offset: margin - overlap,
    duration: core + 2 * overlap,
    fadeInEnd: when,
    fadeOutStart: when + core,
    end: when + core + overlap,
  };
}
