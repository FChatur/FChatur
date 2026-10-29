import { AUDIO, type SoundtrackManifest } from '../config/audio';
import type { AudioEngine } from './AudioEngine';
import { chunkAfter, chunkPlayback } from './mixing';

type Format = 'ogg' | 'm4a';

/**
 * Streams a looping soundtrack from short chunks (see tools/prepare-music.py) with gapless joins.
 *
 * Memory: a whole decoded track would be ~50 MB (decoded audio is ~23 MB per stereo minute). Instead the
 * compressed chunks (~2 MB in all) are downloaded once and kept, and only the chunk playing, the next one
 * queued and the one after that (being decoded) exist as decoded audio: ~10 MB.
 *
 * Timing: chunks are scheduled on the audio clock, a few seconds ahead, each starting exactly where the
 * previous one ends (sample-accurate, independent of frame rate or timers). Neighbouring chunks overlap by
 * a few milliseconds of identical audio and crossfade there, so rounding at a join can't click.
 *
 * Format: Ogg Opus where the browser can decode it, otherwise AAC (.m4a), chosen by trying chunk 0.
 * State for tests is mirrored on `<body data-music="off|loading|playing|error" data-music-format>`.
 */
export class MusicPlayer {
  private formatProbe: Promise<Format | null> | null = null;
  /** Compressed chunk files, kept for the whole session (decoding detaches a buffer, so decode copies). */
  private readonly files = new Map<number, Promise<ArrayBuffer>>();
  /** Decoded chunks waiting to be scheduled. Dropped once scheduled; the playing source holds its own. */
  private readonly decoded = new Map<number, Promise<AudioBuffer | null>>();
  private current: Playthrough | null = null;
  private level!: GainNode;
  private lowpass!: BiquadFilterNode;
  private target = { level: 1, muffled: false };

  constructor(
    private readonly engine: AudioEngine,
    private readonly track: SoundtrackManifest,
    private readonly baseUrl: string,
  ) {
    engine.onReady(() => {
      const ctx = engine.ctx!;
      this.level = ctx.createGain();
      this.lowpass = ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.frequency.value = ctx.sampleRate / 2;
      this.lowpass.Q.value = 0.5;
      this.level.connect(this.lowpass).connect(engine.musicBus);
      this.applyTarget(true);
      // Start downloading after the first interaction, not with the page, so the first load stays small.
      void this.probeFormat();
    });
    this.mirror('off');
  }

  /** Starts the soundtrack from the beginning (fading out any playthrough already running). */
  start(): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    this.stop(AUDIO.fades.musicOutRestart);
    this.current = new Playthrough(this, ctx, this.level, this.track);
    this.mirror('loading');
  }

  /** Fades out over `fade` seconds and stops. */
  stop(fade: number): void {
    this.current?.stop(fade);
    this.current = null;
    this.decoded.clear();
    this.mirror('off');
  }

  /** Level multiplier and muffling for the current game state, smoothed. */
  setTarget(level: number, muffled: boolean): void {
    if (level === this.target.level && muffled === this.target.muffled) return;
    this.target = { level, muffled };
    this.applyTarget(false);
  }

  private applyTarget(immediate: boolean): void {
    const ctx = this.engine.ctx;
    if (!ctx || !this.level) return;
    const cutoff = this.target.muffled ? AUDIO.pausedLowpassHz : ctx.sampleRate / 2;
    if (immediate) {
      this.level.gain.value = this.target.level;
      this.lowpass.frequency.value = cutoff;
      return;
    }
    const tc = AUDIO.fades.levelChange;
    this.level.gain.setTargetAtTime(this.target.level, ctx.currentTime, tc);
    this.lowpass.frequency.setTargetAtTime(cutoff, ctx.currentTime, tc);
  }

  /** Decoded audio for chunk `i`, starting the work if needed; null if it can't be loaded. */
  chunk(i: number): Promise<AudioBuffer | null> {
    let p = this.decoded.get(i);
    if (!p) {
      p = this.decode(i);
      this.decoded.set(i, p);
    }
    return p;
  }

  /** Called when a playthrough has taken chunk `i`: forget the decoded copy. */
  release(i: number): void {
    this.decoded.delete(i);
  }

  started(): void {
    this.mirror('playing');
  }

  failed(): void {
    this.current?.stop(0);
    this.current = null;
    this.mirror('error');
  }

  private async decode(i: number): Promise<AudioBuffer | null> {
    const ctx = this.engine.ctx;
    const format = await this.probeFormat();
    if (!ctx || !format) return null;
    try {
      const bytes = await this.file(i, format);
      return await ctx.decodeAudioData(bytes.slice(0));
    } catch {
      return null;
    }
  }

  private file(i: number, format: Format): Promise<ArrayBuffer> {
    let p = this.files.get(i);
    if (!p) {
      const url = `${this.baseUrl}${this.track.id}/${this.track.chunks[i].file}.${format}`;
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.arrayBuffer();
      });
      // A failed download is retried on the next request instead of being remembered.
      p.catch(() => this.files.delete(i));
      this.files.set(i, p);
    }
    return p;
  }

  /** Picks the format by decoding chunk 0 (Opus first). */
  private probeFormat(): Promise<Format | null> {
    this.formatProbe ??= (async () => {
      const ctx = this.engine.ctx!;
      const probe = document.createElement('audio');
      const candidates: Format[] = probe.canPlayType('audio/ogg; codecs="opus"') ? ['ogg', 'm4a'] : ['m4a', 'ogg'];
      for (const format of candidates) {
        try {
          const bytes = await this.file(0, format);
          await ctx.decodeAudioData(bytes.slice(0));
          document.body.dataset.musicFormat = format;
          return format;
        } catch {
          this.files.delete(0);
        }
      }
      return null;
    })();
    return this.formatProbe;
  }

  private mirror(state: 'off' | 'loading' | 'playing' | 'error'): void {
    if (state === 'off' && document.body.dataset.music === 'error') return;
    document.body.dataset.music = state;
  }
}

/** One run's music: its own fade gain and its own position in the chunk sequence. */
class Playthrough {
  private readonly fade: GainNode;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private next = 0;
  /** Audio-clock time where the next chunk's core starts (null until the first is scheduled). */
  private nextAt: number | null = null;
  private busy = false;
  private stopped = false;
  private readonly timer: number;

  constructor(
    private readonly player: MusicPlayer,
    private readonly ctx: AudioContext,
    out: AudioNode,
    private readonly track: SoundtrackManifest,
  ) {
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.fade.connect(out);
    this.timer = window.setInterval(() => void this.pump(), 250);
    void this.pump();
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    window.clearInterval(this.timer);
    const t = this.ctx.currentTime;
    const g = this.fade.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    const end = t + fade + 0.05;
    for (const src of this.sources) {
      try {
        src.stop(end);
      } catch {
        // Already stopped.
      }
    }
    window.setTimeout(() => this.fade.disconnect(), (fade + 0.2) * 1000);
  }

  /** Keeps `musicLookahead` seconds of chunks scheduled ahead of the audio clock. */
  private async pump(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      while (!this.stopped && (this.nextAt === null || this.nextAt - this.ctx.currentTime < AUDIO.musicLookahead)) {
        const i = this.next;
        const buffer = await this.player.chunk(i);
        if (this.stopped) return;
        if (!buffer) {
          this.player.failed();
          return;
        }
        this.player.release(i);
        const now = this.ctx.currentTime;
        // First chunk, or the download fell behind: (re)start the timeline just ahead of now.
        const late = this.nextAt === null || this.nextAt < now + 0.02;
        if (late) this.nextAt = now + 0.05;
        this.schedule(i, buffer, this.nextAt!, late);
        this.nextAt! += this.track.chunks[i].length / this.track.sampleRate;
        this.next = chunkAfter(this.track, i);
        // Decode the following chunk in the background while this one plays.
        void this.player.chunk(this.next);
      }
    } finally {
      this.busy = false;
    }
  }

  private schedule(i: number, buffer: AudioBuffer, when: number, fadeIn: boolean): void {
    const p = chunkPlayback(this.track, this.track.chunks[i], when);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const join = this.ctx.createGain();
    join.gain.setValueAtTime(0, p.startAt);
    join.gain.linearRampToValueAtTime(1, p.fadeInEnd);
    join.gain.setValueAtTime(1, p.fadeOutStart);
    join.gain.linearRampToValueAtTime(0, p.end);
    src.connect(join).connect(this.fade);
    src.start(p.startAt, p.offset, p.duration);
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      src.disconnect();
      join.disconnect();
    };
    if (fadeIn) {
      const g = this.fade.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(1, when + AUDIO.fades.musicIn);
      this.player.started();
    }
  }
}
