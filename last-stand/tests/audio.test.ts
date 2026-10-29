import { describe, expect, it } from 'vitest';
import { busGains, chunkAfter, chunkPlayback, chunkSeconds, musicTarget, silent, sliderForGain, sliderGain, type MusicInputs } from '../src/audio/mixing';
import { AUDIO, SOUNDTRACK } from '../src/config/audio';
import { GameSession } from '../src/game/GameSession';
import { DEFAULT_SETTINGS, Persistence, type KeyValueStore } from '../src/game/persistence';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('volume maths', () => {
  it('maps sliders to gain on a perceptual curve, clamped to 0..1', () => {
    expect(sliderGain(0)).toBe(0);
    expect(sliderGain(1)).toBe(1);
    expect(sliderGain(0.5)).toBeCloseTo(0.25);
    expect(sliderGain(-0.2)).toBe(0);
    expect(sliderGain(3)).toBe(1);
    expect(sliderGain(Number.NaN)).toBe(0);
  });

  it('mute silences Master but keeps the slider values', () => {
    const v = { master: 0.8, music: 0.5, sfx: 1 };
    expect(busGains(v, false)).toEqual({ master: sliderGain(0.8), music: 0.25, sfx: 1 });
    expect(busGains(v, true)).toEqual({ master: 0, music: 0.25, sfx: 1 });
    expect(silent(v, true)).toBe(true);
    expect(silent({ ...v, master: 0 }, false)).toBe(true);
    expect(silent({ ...v, music: 0, sfx: 0 }, false)).toBe(false);
  });

  it('converts the old linear volume to a Master slider with the same loudness', () => {
    expect(sliderForGain(0.6)).toBe(0.77);
    expect(Math.abs(sliderGain(sliderForGain(0.6)) - 0.6)).toBeLessThan(0.01); // within 0.1 dB
    expect(sliderForGain(0)).toBe(0);
    expect(sliderForGain(1)).toBe(1);
  });
});

describe('audio settings', () => {
  it('new players get the default levels', () => {
    const s = new Persistence(new MemoryStore()).loadSettings();
    expect([s.masterVolume, s.musicVolume, s.sfxVolume]).toEqual([AUDIO.defaultVolumes.master, AUDIO.defaultVolumes.music, AUDIO.defaultVolumes.sfx]);
  });

  it('migrates the pre-0.7.0 single volume into Master and keeps mute', () => {
    const store = new MemoryStore();
    store.setItem('lastStand.v1.settings', JSON.stringify({ muted: true, volume: 0.6, speed: 2, tutorialDone: true, autoWave: true }));
    const s = new Persistence(store).loadSettings();
    expect(s.masterVolume).toBe(0.77);
    expect(s.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(s.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
    expect(s.muted).toBe(true);
    expect(s.speed).toBe(2);
  });

  it('new volume fields win over the old one', () => {
    const store = new MemoryStore();
    store.setItem('lastStand.v1.settings', JSON.stringify({ volume: 0.6, masterVolume: 0.4 }));
    expect(new Persistence(store).loadSettings().masterVolume).toBe(0.4);
  });

  it('the session clamps, saves and announces volume changes; the old field is not written back', () => {
    const store = new MemoryStore();
    const session = new GameSession(new Persistence(store));
    const events: unknown[] = [];
    session.bus.on('volumeChanged', (e) => events.push(e));
    session.setVolume('music', 0.42);
    session.setVolume('sfx', 0.3);
    session.setVolume('sfx', 7);
    session.setVolume('master', -1);
    session.setVolume('master', 0); // no change: no event
    expect(events).toEqual([
      { channel: 'music', value: 0.42 },
      { channel: 'sfx', value: 0.3 },
      { channel: 'sfx', value: 1 },
      { channel: 'master', value: 0 },
    ]);
    const saved = JSON.parse(store.data.get('lastStand.v1.settings')!);
    expect(saved).toMatchObject({ masterVolume: 0, musicVolume: 0.42, sfxVolume: 1 });
    expect(saved).not.toHaveProperty('volume');
    // A fresh session (a reload) sees the same levels.
    const reloaded = new GameSession(new Persistence(store));
    expect([reloaded.volume('master'), reloaded.volume('music'), reloaded.volume('sfx')]).toEqual([0, 0.42, 1]);
  });
});

describe('music state', () => {
  const base: MusicInputs = { screen: 'playing', paused: false, phase: 'build', focused: true };

  it('plays during a run and is silent on the menu and after game over', () => {
    expect(musicTarget(base)).toEqual({ play: true, level: 1, muffled: false });
    expect(musicTarget({ ...base, phase: 'wave' }).play).toBe(true);
    expect(musicTarget({ ...base, screen: 'menu' })).toEqual({ play: false, level: 0, muffled: false });
    expect(musicTarget({ ...base, phase: 'gameover' })).toEqual({ play: false, level: 0, muffled: false });
  });

  it('pause lowers and muffles without stopping; the draft and an unfocused window lower the level', () => {
    expect(musicTarget({ ...base, paused: true })).toEqual({ play: true, level: AUDIO.musicLevels.paused, muffled: true });
    expect(musicTarget({ ...base, phase: 'draft' })).toEqual({ play: true, level: AUDIO.musicLevels.draft, muffled: false });
    expect(musicTarget({ ...base, focused: false }).level).toBeCloseTo(AUDIO.musicLevels.unfocused);
    // Pause wins over the draft level (the draft is behind the pause menu); focus still applies on top.
    expect(musicTarget({ ...base, phase: 'draft', paused: true, focused: false }).level).toBeCloseTo(
      AUDIO.musicLevels.paused * AUDIO.musicLevels.unfocused,
    );
  });
});

describe('soundtrack chunks', () => {
  const t = SOUNDTRACK;

  it('the chunks tile the edit with no gaps or overlaps', () => {
    t.chunks.forEach((c, i) => {
      expect(c.length).toBeGreaterThan(0);
      if (i > 0) expect(c.start).toBe(t.chunks[i - 1].start + t.chunks[i - 1].length);
    });
    expect(t.chunks[0].start).toBe(0);
  });

  it('plays the intro once, then loops from the loop chunk forever', () => {
    const order: number[] = [0];
    for (let n = 0; n < 40; n++) order.push(chunkAfter(t, order[order.length - 1]));
    const loopLen = t.chunks.length - t.loopChunk;
    expect(order.slice(0, t.chunks.length)).toEqual(t.chunks.map((_, i) => i));
    for (let k = t.chunks.length; k < order.length; k++) expect(order[k]).toBe(order[k - loopLen]);
    expect(order.filter((i) => i < t.loopChunk)).toEqual([0, 1, 2, 3].slice(0, t.loopChunk));
  });

  it('the loop is 48 bars at 110 BPM, starting 39.594 s into the edit', () => {
    const loop = t.chunks.slice(t.loopChunk).reduce((s, c) => s + chunkSeconds(t, c), 0);
    expect(loop).toBeCloseTo((48 * 4 * 60) / 110, 3);
    expect(t.chunks[t.loopChunk].start / t.sampleRate).toBeCloseTo(39.594, 3);
  });

  it('each chunk plays its core plus a crossfaded overlap inside its margins', () => {
    const c = t.chunks[5];
    const p = chunkPlayback(t, c, 100, 0.005);
    const core = chunkSeconds(t, c);
    expect(p.startAt).toBeCloseTo(99.995);
    expect(p.offset).toBeCloseTo(t.margin / t.sampleRate - 0.005);
    expect(p.offset).toBeGreaterThan(0.2); // room for decoders that keep their start-up delay
    expect(p.duration).toBeCloseTo(core + 0.01);
    expect(p.fadeOutStart).toBeCloseTo(100 + core);
    // The next chunk's fade-in spans exactly this chunk's fade-out.
    const next = chunkPlayback(t, t.chunks[6], 100 + core, 0.005);
    expect(next.startAt).toBeCloseTo(p.fadeOutStart);
    expect(next.fadeInEnd).toBeCloseTo(p.end);
  });
});
