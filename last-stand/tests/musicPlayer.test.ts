import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AudioEngine } from '../src/audio/AudioEngine';
import { MusicPlayer } from '../src/audio/MusicPlayer';
import { AUDIO, SOUNDTRACK } from '../src/config/audio';

/**
 * Runs the real MusicPlayer against a fake Web Audio clock, so minutes of playback (and the loop wrapping
 * around) take milliseconds. Checks what the game actually schedules: chunk order, sample-exact joins,
 * lead time, the decoded-memory bound, and pause muffling.
 */

interface Started {
  chunk: number;
  when: number;
  offset: number;
  duration: number;
  scheduledAt: number;
}

class FakeParam {
  value = 0;
  targets: [number, number][] = [];
  setTargetAtTime(v: number, t: number) {
    this.targets.push([v, t]);
  }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}

class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
  disconnect() {}
}

class FakeBuffer {
  constructor(readonly chunk: number) {}
}

class FakeContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  readonly state = 'running';
  readonly started: Started[] = [];
  readonly playing = new Set<FakeSource>();
  /** Decoded buffers not yet handed to a source. */
  readonly pending = new Set<FakeBuffer>();
  decodes = 0;

  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: '', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createBufferSource() {
    return new FakeSource(this);
  }
  async decodeAudioData(bytes: ArrayBuffer) {
    this.decodes++;
    const buffer = new FakeBuffer(new Uint8Array(bytes)[0]);
    // The very first decode is the format probe, whose result is thrown away.
    if (this.decodes > 1) this.pending.add(buffer);
    return buffer;
  }
  /** Moves the clock and ends sources that have finished. */
  advance(dt: number) {
    this.currentTime += dt;
    for (const s of this.playing) {
      if (this.currentTime >= s.end) {
        this.playing.delete(s);
        s.onended?.();
      }
    }
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  onended: (() => void) | null = null;
  end = Infinity;
  constructor(private readonly ctx: FakeContext) {
    super();
  }
  start(when: number, offset: number, duration: number) {
    this.ctx.pending.delete(this.buffer!);
    this.ctx.playing.add(this);
    this.end = when + duration;
    this.ctx.started.push({ chunk: this.buffer!.chunk, when, offset, duration, scheduledAt: this.ctx.currentTime });
  }
  stop(t: number) {
    this.end = Math.min(this.end, t);
  }
}

let intervals: (() => void)[];
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
  intervals = [];
  const g = globalThis as Record<string, unknown>;
  g.window = {
    setInterval: (fn: () => void) => intervals.push(fn),
    clearInterval: (id: number) => {
      intervals[id - 1] = () => {};
    },
    setTimeout: () => 0,
  };
  g.document = { body: { dataset: {} as Record<string, string> }, createElement: () => ({ canPlayType: () => 'probably' }) };
  // Each chunk file's first byte names the chunk, so decoded buffers know where they came from.
  g.fetch = async (url: string) => {
    const chunk = Number(/(\d\d)\.(ogg|mp4)$/.exec(url)![1]);
    return { ok: true, arrayBuffer: async () => new Uint8Array([chunk]).buffer };
  };
});

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
  delete g.fetch;
});

function setup() {
  const ctx = new FakeContext();
  const musicBus = new FakeNode();
  const engine = { ctx, musicBus, onReady: (fn: () => void) => fn() } as unknown as AudioEngine;
  const player = new MusicPlayer(engine, SOUNDTRACK, 'audio/music/');
  return { ctx, player };
}

/** Plays `seconds` of music in 0.25 s steps (the player's own timer period), tracking peak decoded buffers. */
async function play(ctx: FakeContext, seconds: number): Promise<number> {
  let peak = 0;
  for (let t = 0; t < seconds; t += 0.25) {
    ctx.advance(0.25);
    intervals.forEach((fn) => fn());
    await flush();
    peak = Math.max(peak, ctx.pending.size + ctx.playing.size);
  }
  return peak;
}

describe('music player (fake audio clock)', () => {
  it('plays the intro once, then loops the 48-bar section seamlessly, again and again', async () => {
    const { ctx, player } = setup();
    await flush();
    player.start();
    const peak = await play(ctx, 400); // intro + 3.4 loops: wraps around three times

    const t = SOUNDTRACK;
    const chunks = ctx.started.map((s) => s.chunk);
    const intro = [...Array(t.loopChunk).keys()];
    const loop = t.chunks.map((_, i) => i).slice(t.loopChunk);
    expect(chunks.slice(0, t.chunks.length)).toEqual([...intro, ...loop]);
    expect(chunks.slice(t.chunks.length, t.chunks.length + 2 * loop.length)).toEqual([...loop, ...loop]);
    expect(chunks.length).toBeGreaterThan(t.chunks.length + loop.length); // past the second wrap

    // Every chunk's core starts exactly where the previous one's core ends (no gap, no overlap).
    const X = AUDIO.chunkOverlap;
    for (let k = 1; k < ctx.started.length; k++) {
      const prev = ctx.started[k - 1];
      const cur = ctx.started[k];
      const prevCoreEnd = prev.when + X + t.chunks[prev.chunk].length / t.sampleRate;
      expect(Math.abs(cur.when + X - prevCoreEnd)).toBeLessThan(1e-9);
      // Played from just inside the chunk's leading margin, for the core plus both overlaps.
      expect(cur.offset).toBeCloseTo(t.margin / t.sampleRate - X, 9);
      expect(cur.duration).toBeCloseTo(t.chunks[cur.chunk].length / t.sampleRate + 2 * X, 9);
      // Queued well before it is due.
      expect(cur.when - cur.scheduledAt).toBeGreaterThan(AUDIO.musicLookahead - 0.5);
    }
    // Memory: never more than three decoded chunks (playing, queued, next being prepared).
    expect(peak).toBeLessThanOrEqual(3);
    expect((globalThis as unknown as { document: { body: { dataset: Record<string, string> } } }).document.body.dataset.music).toBe('playing');
  });

  it('muffles and lowers for the pause menu, then restores', async () => {
    const { ctx, player } = setup();
    await flush();
    player.start();
    await play(ctx, 2);
    const nodes = player as unknown as { level: { gain: FakeParam }; lowpass: { frequency: FakeParam } };
    player.setTarget(AUDIO.musicLevels.paused, true);
    expect(nodes.level.gain.targets.at(-1)![0]).toBe(AUDIO.musicLevels.paused);
    expect(nodes.lowpass.frequency.targets.at(-1)![0]).toBe(AUDIO.pausedLowpassHz);
    player.setTarget(1, false);
    expect(nodes.level.gain.targets.at(-1)![0]).toBe(1);
    expect(nodes.lowpass.frequency.targets.at(-1)![0]).toBe(ctx.sampleRate / 2);
  });

  it('stops scheduling after stop(), and a new start begins again from the intro', async () => {
    const { ctx, player } = setup();
    await flush();
    player.start();
    await play(ctx, 60);
    player.stop(AUDIO.fades.musicOutToMenu);
    const count = ctx.started.length;
    await play(ctx, 30);
    expect(ctx.started.length).toBe(count);
    expect(ctx.playing.size).toBe(0);
    player.start();
    await play(ctx, 1);
    expect(ctx.started[count].chunk).toBe(0);
  });
});
