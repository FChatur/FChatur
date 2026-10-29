import { AUDIO } from '../config/audio';
import type { GameSession } from '../game/GameSession';
import { busGains, silent } from './mixing';

/**
 * The one Web Audio context and its buses: Music and SFX → Master → limiter → output.
 *
 * Browsers only let audio start inside a user gesture, so the context is created (or resumed) on the first
 * key press, mouse press, or touch release; never on page load. While the tab is hidden, or while nothing
 * can be heard (muted or Master at 0), the output fades out and the context is suspended: the music holds
 * its place and no CPU or battery is spent. It resumes with a short fade.
 *
 * State for tests and debugging is mirrored on `<body data-audio="locked|running|suspended">`.
 */
export class AudioEngine {
  private _ctx: AudioContext | null = null;
  private master!: GainNode;
  /** After the limiter: fades for hide/show and suspend/resume, separate from the volume settings. */
  private output!: GainNode;
  private _music!: GainNode;
  private _sfx!: GainNode;
  private suspendTimer: number | undefined;
  private readonly readyListeners: (() => void)[] = [];

  constructor(private readonly session: GameSession) {
    // Capture phase on window: runs before any other key or click handler, so a Play click or Enter
    // press finds the context already unlocked.
    const unlock = (e: Event) => {
      // Touch counts as a user gesture on release, not on press.
      if (e.type === 'pointerdown' && (e as PointerEvent).pointerType === 'touch') return;
      this.unlock();
    };
    for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) {
      window.addEventListener(type, unlock, { capture: true });
    }
    document.addEventListener('visibilitychange', () => this.update());
    session.bus.on('muteChanged', () => this.applyVolumes());
    session.bus.on('volumeChanged', () => this.applyVolumes());
    this.mirrorState();
  }

  /** The audio context, once the player has interacted with the page. */
  get ctx(): AudioContext | null {
    return this._ctx;
  }

  get musicBus(): GainNode {
    return this._music;
  }

  get sfxBus(): GainNode {
    return this._sfx;
  }

  /** True when sound can play right now. */
  get running(): boolean {
    return this._ctx?.state === 'running';
  }

  /** Runs `fn` once the context exists (immediately if it already does). */
  onReady(fn: () => void): void {
    if (this._ctx) fn();
    else this.readyListeners.push(fn);
  }

  private unlock(): void {
    if (this._ctx) {
      // After an interruption (iOS: phone call, Siri) the context needs a gesture to start again.
      if (this._ctx.state !== 'running' && this.shouldRun()) void this._ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor({ latencyHint: 'playback' });
      const L = AUDIO.limiter;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = L.thresholdDb;
      limiter.knee.value = L.kneeDb;
      limiter.ratio.value = L.ratio;
      limiter.attack.value = L.attack;
      limiter.release.value = L.release;
      this.output = ctx.createGain();
      this.master = ctx.createGain();
      this._music = ctx.createGain();
      this._sfx = ctx.createGain();
      this._music.connect(this.master);
      this._sfx.connect(this.master);
      this.master.connect(limiter).connect(this.output).connect(ctx.destination);
      ctx.addEventListener('statechange', () => this.mirrorState());
      this._ctx = ctx;
      // Some browsers (Firefox) create the context already running, with no statechange event.
      this.mirrorState();
      this.output.gain.value = 0;
      this.applyVolumes(true);
      this.update();
      for (const fn of this.readyListeners.splice(0)) fn();
    } catch {
      this._ctx = null;
    }
  }

  private applyVolumes(immediate = false): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const g = busGains(
      { master: this.session.volume('master'), music: this.session.volume('music'), sfx: this.session.volume('sfx') },
      this.session.muted,
    );
    const set = (param: AudioParam, value: number) => {
      if (immediate) param.value = value;
      else param.setTargetAtTime(value, ctx.currentTime, AUDIO.fades.output / 3);
    };
    set(this.master.gain, g.master);
    set(this._music.gain, g.music);
    set(this._sfx.gain, g.sfx);
    this.update();
  }

  private shouldRun(): boolean {
    return !document.hidden && !silent({ master: this.session.volume('master'), music: 0, sfx: 0 }, this.session.muted);
  }

  /** Fades out and suspends, or resumes and fades in, to match visibility and mute. */
  private update(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    window.clearTimeout(this.suspendTimer);
    const out = this.output.gain;
    if (this.shouldRun()) {
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
      out.cancelScheduledValues(ctx.currentTime);
      out.setTargetAtTime(1, ctx.currentTime, AUDIO.fades.output);
      return;
    }
    const fade = document.hidden ? AUDIO.fades.hide : AUDIO.fades.output;
    out.cancelScheduledValues(ctx.currentTime);
    out.setTargetAtTime(0, ctx.currentTime, fade / 3);
    this.suspendTimer = window.setTimeout(() => {
      if (!this.shouldRun() && ctx.state === 'running') void ctx.suspend().catch(() => {});
    }, fade * 1000 + 50);
  }

  private mirrorState(): void {
    document.body.dataset.audio = !this._ctx ? 'locked' : this._ctx.state === 'running' ? 'running' : 'suspended';
  }
}
