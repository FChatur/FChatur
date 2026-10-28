/** True when the player's system asks for reduced motion (checked live, so a change applies at once). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
