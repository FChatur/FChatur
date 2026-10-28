/**
 * A small, non-blocking message at the top of the page for problems the player should know about
 * (a crash, the browser resetting graphics). One at a time; never covers the board's controls.
 */
export interface NoticeAction {
  label: string;
  run: () => void;
}

export function showNotice(id: string, text: string, actions: NoticeAction[] = []): void {
  hideNotice(id);
  const el = document.createElement('div');
  el.className = 'notice';
  el.id = `notice-${id}`;
  el.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = text;
  el.appendChild(p);
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = a.label;
    btn.addEventListener('click', a.run);
    el.appendChild(btn);
  }
  document.body.appendChild(el);
}

export function hideNotice(id: string): void {
  document.getElementById(`notice-${id}`)?.remove();
}

/**
 * Shows a notice (once) for uncaught errors in the game's own code. Errors from browser extensions
 * or other origins are ignored, since they don't affect the game.
 */
export function watchForCrashes(): void {
  let shown = false;
  const report = (source: string | undefined) => {
    if (shown) return;
    if (source && !source.startsWith(location.origin)) return;
    shown = true;
    showNotice('crash', 'Something went wrong. The game may not behave correctly until you reload.', [
      { label: 'Reload', run: () => location.reload() },
      { label: 'Dismiss', run: () => hideNotice('crash') },
    ]);
  };
  window.addEventListener('error', (e) => report(e.filename || undefined));
  window.addEventListener('unhandledrejection', () => report(undefined));
}
