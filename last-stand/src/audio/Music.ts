import { AUDIO, SOUNDTRACK } from '../config/audio';
import type { GameEvents } from '../core/events';
import type { GameSession } from '../game/GameSession';
import type { AudioEngine } from './AudioEngine';
import { musicTarget } from './mixing';
import { MusicPlayer } from './MusicPlayer';

/** Game events after which the music's target may have changed. */
const REEVALUATE_ON: (keyof GameEvents)[] = [
  'screenChanged',
  'sessionReset',
  'waveStarted',
  'waveCleared',
  'draftOffered',
  'upgradeChosen',
  'gameOver',
];

/**
 * Decides what the soundtrack does from the game state (rules in audio/mixing.ts `musicTarget`): starts
 * with a run, quietens for the upgrade draft and for an unfocused window, muffles in the pause menu,
 * fades out on game over and on return to the menu, and starts over with a new run.
 */
export class Music {
  private readonly player: MusicPlayer;
  private playing = false;
  /** A new run began while music was playing: start the soundtrack over. */
  private newRun = false;
  private queued = false;

  constructor(
    private readonly session: GameSession,
    engine: AudioEngine,
  ) {
    this.player = new MusicPlayer(engine, SOUNDTRACK, `${import.meta.env.BASE_URL}audio/music/`);
    for (const type of REEVALUATE_ON) {
      session.bus.on(type, () => {
        if (type === 'sessionReset') this.newRun = true;
        this.queueUpdate();
      });
    }
    window.addEventListener('focus', () => this.queueUpdate());
    window.addEventListener('blur', () => this.queueUpdate());
    // The run may already be underway when the context unlocks (Enter pressed on the menu).
    engine.onReady(() => {
      this.playing = false;
      this.update();
    });
  }

  /** Several events can fire for one action (Main menu = new run + screen change); act once on the result. */
  private queueUpdate(): void {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      this.update();
    });
  }

  private update(): void {
    const target = musicTarget({
      screen: this.session.screen,
      paused: this.session.paused,
      phase: this.session.sim.phase,
      focused: document.hasFocus(),
    });
    if (target.play && (!this.playing || this.newRun)) {
      this.player.start();
    } else if (!target.play && this.playing) {
      const fade = this.session.sim.phase === 'gameover' ? AUDIO.fades.musicOutGameOver : AUDIO.fades.musicOutToMenu;
      this.player.stop(fade);
    }
    if (target.play) this.newRun = false;
    this.playing = target.play;
    if (target.play) this.player.setTarget(target.level, target.muffled);
  }
}
