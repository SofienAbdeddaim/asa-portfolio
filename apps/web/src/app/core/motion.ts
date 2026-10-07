/** True when the viewer asked for less motion. Safe where `matchMedia` does not exist (tests, SSR). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True for a mouse-like pointer that can hover (tilt effects are skipped on touch). */
export function hasFinePointer(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}
