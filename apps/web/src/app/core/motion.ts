/** True when the viewer asked for less motion. Safe where `matchMedia` does not exist (tests, SSR). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
