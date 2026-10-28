import type { TowerTypeId } from '../config/towers';
import type { GameSession } from '../game/GameSession';

interface ToneOptions {
  freq: number;
  /** Frequency at the end of the sound, for slides. */
  to?: number;
  type?: OscillatorType;
  duration: number;
  volume: number;
  /** Seconds from now. */
  delay?: number;
}

interface NoiseOptions {
  duration: number;
  volume: number;
  filter: BiquadFilterType;
  freq: number;
  delay?: number;
}

/** Shortest gap between two plays of the same sound, so fast towers at 3x don't become noise. */
const MIN_GAP_MS: Record<string, number> = {
  shoot: 55,
  kill: 45,
  crit: 70,
  splash: 90,
  chain: 90,
};

/**
 * Procedural sound effects (Web Audio, no files). Listens to game events; never affects gameplay.
 * The audio context starts on the first click or key press, as browsers require.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<string, number>();

  constructor(private readonly session: GameSession) {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const bus = session.bus;
    bus.on('muteChanged', () => this.applyVolume());
    bus.on('towerFired', ({ tower }) => this.shoot(tower.type));
    bus.on('projectileHit', ({ crit }) => crit && this.limited('crit', () => this.tone({ freq: 1500, to: 2200, type: 'square', duration: 0.05, volume: 0.05 })));
    bus.on('enemyKilled', ({ enemy }) => {
      if (enemy.type === 'boss') {
        this.tone({ freq: 220, to: 60, type: 'sawtooth', duration: 0.6, volume: 0.2 });
        this.noise({ duration: 0.5, volume: 0.25, filter: 'lowpass', freq: 600 });
        return;
      }
      this.limited('kill', () => this.tone({ freq: 320, to: 110, type: 'square', duration: 0.08, volume: 0.045 }));
    });
    bus.on('enemyLeaked', () => this.tone({ freq: 120, to: 50, type: 'sine', duration: 0.3, volume: 0.35 }));
    bus.on('enemySpawned', ({ enemy }) => {
      if (enemy.type !== 'boss') return;
      this.tone({ freq: 70, to: 55, type: 'sawtooth', duration: 1.2, volume: 0.18 });
      this.tone({ freq: 105, to: 82, type: 'sawtooth', duration: 1.2, volume: 0.1 });
    });
    bus.on('splash', () => this.limited('splash', () => this.noise({ duration: 0.12, volume: 0.12, filter: 'lowpass', freq: 900 })));
    bus.on('chainArc', () => this.limited('chain', () => this.noise({ duration: 0.06, volume: 0.07, filter: 'highpass', freq: 2500 })));
    bus.on('towerPlaced', () => this.tone({ freq: 520, to: 780, type: 'triangle', duration: 0.08, volume: 0.12 }));
    bus.on('towerUpgraded', () => this.arpeggio([523, 659, 784], 0.06, 0.1));
    bus.on('towerSold', () => this.arpeggio([1319, 1760], 0.05, 0.08));
    bus.on('waveStarted', () => this.tone({ freq: 196, to: 294, type: 'sawtooth', duration: 0.35, volume: 0.08 }));
    bus.on('waveCleared', () => this.arpeggio([659, 880, 1319], 0.08, 0.09));
    bus.on('draftOffered', () => this.arpeggio([784, 988, 1175, 1568], 0.06, 0.07));
    bus.on('upgradeChosen', () => this.arpeggio([523, 784, 1047], 0.04, 0.12));
    bus.on('gameOver', () => this.tone({ freq: 440, to: 80, type: 'triangle', duration: 1.2, volume: 0.25 }));
  }

  private unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setValueAtTime(this.session.muted ? 0 : this.session.volume, this.ctx.currentTime);
  }

  private get live(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.session.muted;
  }

  private shoot(type: TowerTypeId): void {
    this.limited(`shoot:${type}`, () => {
      switch (type) {
        case 'basic':
          return this.tone({ freq: 480, to: 300, type: 'square', duration: 0.05, volume: 0.035 });
        case 'sniper':
          this.noise({ duration: 0.1, volume: 0.1, filter: 'bandpass', freq: 1800 });
          return this.tone({ freq: 220, to: 110, type: 'sawtooth', duration: 0.12, volume: 0.06 });
        case 'rapid':
          return this.tone({ freq: 900, to: 700, type: 'triangle', duration: 0.03, volume: 0.03 });
        case 'frost':
          return this.tone({ freq: 1400, to: 700, type: 'sine', duration: 0.09, volume: 0.05 });
      }
    });
  }

  private limited(key: string, play: () => void): void {
    if (!this.live) return;
    const now = performance.now();
    // "shoot:rapid" uses the "shoot" gap but is tracked separately from "shoot:sniper".
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < (MIN_GAP_MS[key.split(':')[0]] ?? 0)) return;
    this.lastPlayed.set(key, now);
    play();
  }

  private arpeggio(freqs: number[], step: number, volume: number): void {
    freqs.forEach((freq, i) => this.tone({ freq, type: 'triangle', duration: 0.12, volume, delay: i * step }));
  }

  private tone(o: ToneOptions): void {
    if (!this.live || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(o.volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + o.duration + 0.02);
  }

  private noise(o: NoiseOptions): void {
    if (!this.live || !this.ctx || !this.master) return;
    if (!this.noiseBuffer) {
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = this.ctx.currentTime + (o.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.value = o.freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(o.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + o.duration + 0.02);
  }
}
