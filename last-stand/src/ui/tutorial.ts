import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

/** One step of the first-run tutorial: shown until `on` fires (and `when` passes, if given). */
export interface TutorialStep<K extends keyof GameEvents = keyof GameEvents> {
  text: string;
  on: K;
  when?: (payload: GameEvents[K]) => boolean;
}

const step = <K extends keyof GameEvents>(s: TutorialStep<K>): TutorialStep => s as unknown as TutorialStep;

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  step({ text: 'Pick a tower: press 1 or click Turret below, then click a dark tile next to the path.', on: 'towerPlaced' }),
  step({ text: 'Press Space (or Start Wave) to send the first wave. Towers fire on their own.', on: 'waveStarted' }),
  step({
    text: 'Click one of your towers to see its stats. U upgrades it, S sells it.',
    on: 'selectionChanged',
    when: (e) => e.towerId !== null,
  }),
  step({ text: 'Tip: F switches between 1x, 2x and 3x speed. P pauses. Clear the wave to continue.', on: 'waveCleared' }),
  step({ text: 'Every 5th wave you pick an upgrade that lasts the whole run. Survive as long as you can!', on: 'upgradeChosen' }),
];

/**
 * Tracks progress through the tutorial steps by listening to game events. No DOM here, so it can be
 * unit-tested; the HUD renders `current` and calls `skip()`.
 */
export class TutorialProgress {
  private index = 0;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    bus: EventBus<GameEvents>,
    private readonly steps: readonly TutorialStep[],
    private readonly onChange: () => void,
    private readonly onFinish: () => void,
  ) {
    for (const [i, s] of steps.entries()) {
      this.unsubscribe.push(
        bus.on(s.on, (payload) => {
          if (this.index !== i) return;
          if (s.when && !s.when(payload as never)) return;
          this.advance();
        }),
      );
    }
  }

  get current(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  get position(): { step: number; total: number } {
    return { step: this.index + 1, total: this.steps.length };
  }

  get finished(): boolean {
    return this.index >= this.steps.length;
  }

  /** Stops listening without marking the tutorial as done (used when it is restarted). */
  dispose(): void {
    for (const off of this.unsubscribe) off();
  }

  skip(): void {
    if (this.finished) return;
    this.index = this.steps.length;
    this.finish();
  }

  private advance(): void {
    this.index++;
    if (this.finished) this.finish();
    else this.onChange();
  }

  private finish(): void {
    this.dispose();
    this.onFinish();
    this.onChange();
  }
}
