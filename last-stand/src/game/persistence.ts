import { AUDIO } from '../config/audio';
import type { GameSpeed } from '../config/balance';
import type { MapId } from '../config/maps';
import { sliderForGain } from '../audio/mixing';

/**
 * Settings and personal records, saved in localStorage. Every access is guarded: in private
 * windows, with storage blocked, or when data is corrupt, the game falls back to defaults and
 * keeps working; it just won't remember things.
 */

export interface Settings {
  muted: boolean;
  /** Volume slider positions, 0..1 (shown as 0–100%; gain follows a curve, see audio/mixing.ts). */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  speed: GameSpeed;
  /** Set once the first-run tutorial has been finished or skipped. */
  tutorialDone: boolean;
  /** Start the next wave automatically after a short countdown. */
  autoWave: boolean;
  /** The left tower shop is collapsed to a narrow rail. */
  shopCollapsed: boolean;
}

export interface MapRecord {
  bestWave: number;
  bestKills: number;
  runs: number;
}

/** Personal records, kept per map so different maps never share one leaderboard. */
export type Records = Partial<Record<MapId, MapRecord>>;

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  masterVolume: AUDIO.defaultVolumes.master,
  musicVolume: AUDIO.defaultVolumes.music,
  sfxVolume: AUDIO.defaultVolumes.sfx,
  speed: 1,
  tutorialDone: false,
  autoWave: true,
  shopCollapsed: false,
};

/** Settings as saved by older versions (before 0.7.0 there was one linear `volume` gain). */
type StoredSettings = Partial<Settings> & { volume?: unknown };

const isLevel = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;

const KEYS = { settings: 'lastStand.v1.settings', records: 'lastStand.v1.records' } as const;

/** The subset of the Storage API we use, so tests can pass an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class Persistence {
  constructor(private readonly store: KeyValueStore | null = defaultStore()) {}

  loadSettings(): Settings {
    const raw = this.read<StoredSettings>(KEYS.settings) ?? {};
    const s = { ...DEFAULT_SETTINGS };
    if (typeof raw.muted === 'boolean') s.muted = raw.muted;
    // Before 0.7.0: one linear gain for everything. Keep that loudness as the Master slider.
    if (isLevel(raw.volume)) s.masterVolume = sliderForGain(raw.volume);
    if (isLevel(raw.masterVolume)) s.masterVolume = raw.masterVolume;
    if (isLevel(raw.musicVolume)) s.musicVolume = raw.musicVolume;
    if (isLevel(raw.sfxVolume)) s.sfxVolume = raw.sfxVolume;
    if (raw.speed === 1 || raw.speed === 2 || raw.speed === 3) s.speed = raw.speed;
    if (typeof raw.tutorialDone === 'boolean') s.tutorialDone = raw.tutorialDone;
    if (typeof raw.autoWave === 'boolean') s.autoWave = raw.autoWave;
    if (typeof raw.shopCollapsed === 'boolean') s.shopCollapsed = raw.shopCollapsed;
    return s;
  }

  saveSettings(settings: Settings): void {
    this.write(KEYS.settings, settings);
  }

  loadRecords(): Records {
    const raw = this.read<Records>(KEYS.records);
    return raw && typeof raw === 'object' ? raw : {};
  }

  /**
   * Records a finished run and returns the updated record plus whether it set a new best wave.
   */
  recordRun(map: MapId, wave: number, kills: number): { record: MapRecord; newBest: boolean } {
    const records = this.loadRecords();
    const prev = records[map] ?? { bestWave: 0, bestKills: 0, runs: 0 };
    const newBest = wave > prev.bestWave;
    const record: MapRecord = {
      bestWave: Math.max(prev.bestWave, wave),
      bestKills: Math.max(prev.bestKills, kills),
      runs: prev.runs + 1,
    };
    records[map] = record;
    this.write(KEYS.records, records);
    return { record, newBest };
  }

  private read<T>(key: string): T | null {
    try {
      const text = this.store?.getItem(key);
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.store?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: keep playing without saving.
    }
  }
}
