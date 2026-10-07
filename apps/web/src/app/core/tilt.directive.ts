import { isPlatformBrowser } from '@angular/common';
import { hasFinePointer, prefersReducedMotion } from './motion';
import { Directive, ElementRef, PLATFORM_ID, afterNextRender, inject } from '@angular/core';

const MAX_DEGREES = 6;

/**
 * Tilts a card toward the pointer. Only for fine pointers that can hover, and never under
 * `prefers-reduced-motion`. In RTL the horizontal tilt is mirrored so it still follows the pointer.
 */
@Directive({ selector: '[appTilt]' })
export class Tilt {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      if (!hasFinePointer() || prefersReducedMotion()) return;

      const el = this.element;
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('pointermove', (event) => {
        const box = el.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * MAX_DEGREES).toFixed(2)}deg) rotateY(${(x * MAX_DEGREES).toFixed(2)}deg)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  }
}
