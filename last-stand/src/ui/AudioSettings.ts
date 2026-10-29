import type { VolumeChannel } from '../config/audio';
import type { GameSession } from '../game/GameSession';

const CHANNELS: { channel: VolumeChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'music', label: 'Music' },
  { channel: 'sfx', label: 'Effects' },
];

/**
 * Master, Music and Effects sliders (0–100%), plus an optional Sound on/off toggle, rendered into `host`.
 * Used by both the main menu and the pause menu; every copy follows the saved settings. Sliders work
 * with arrow keys, Page Up/Down and Home/End like any range input.
 */
export class AudioSettings {
  private readonly inputs = new Map<VolumeChannel, { input: HTMLInputElement; value: HTMLOutputElement }>();
  private readonly mute: HTMLButtonElement | null = null;

  constructor(
    private readonly session: GameSession,
    host: HTMLElement,
    idPrefix: string,
    withMute: boolean,
  ) {
    host.classList.add('audio-settings');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Audio');
    for (const { channel, label } of CHANNELS) {
      const id = `${idPrefix}-${channel}`;
      const row = document.createElement('div');
      row.className = 'vol-row';
      const name = document.createElement('label');
      name.htmlFor = id;
      name.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.min = '0';
      input.max = '100';
      input.step = '1';
      const value = document.createElement('output');
      value.htmlFor.add(id);
      input.addEventListener('input', () => session.setVolume(channel, Number(input.value) / 100));
      // Keep game shortcuts (P, M, Space…) working while a slider has focus, but let it use its own keys.
      input.addEventListener('keydown', (e) => {
        if (e.key.startsWith('Arrow') || ['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.stopPropagation();
      });
      row.append(name, input, value);
      host.appendChild(row);
      this.inputs.set(channel, { input, value });
    }
    if (withMute) {
      this.mute = document.createElement('button');
      this.mute.id = `${idPrefix}-mute`;
      this.mute.className = 'btn';
      this.mute.addEventListener('click', () => {
        session.toggleMute();
        this.mute?.blur();
      });
      host.appendChild(this.mute);
    }
    session.bus.on('volumeChanged', () => this.refresh());
    session.bus.on('muteChanged', () => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    for (const [channel, { input, value }] of this.inputs) {
      const percent = Math.round(this.session.volume(channel) * 100);
      if (Number(input.value) !== percent) input.value = String(percent);
      input.style.setProperty('--fill', `${percent}%`);
      input.setAttribute('aria-valuetext', `${percent}%`);
      value.textContent = `${percent}%`;
    }
    this.inputs.forEach(({ input }) => input.closest('.vol-row')?.classList.toggle('muted', this.session.muted));
    if (this.mute) this.mute.textContent = `Sound: ${this.session.muted ? 'Off' : 'On'}`;
  }
}
