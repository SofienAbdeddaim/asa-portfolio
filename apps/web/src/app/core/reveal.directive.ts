import { isPlatformBrowser } from '@angular/common';
import { prefersReducedMotion } from './motion';
import {
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
  numberAttribute,
} from '@angular/core';

/**
 * Pops an element in when it scrolls into view. Server-rendered content is always visible: only
 * elements that start below the fold are hidden (after hydration) and revealed later, and nothing
 * is hidden at all under `prefers-reduced-motion` or without IntersectionObserver.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal {
  /** Delay in milliseconds, to stagger siblings. */
  readonly delay = input(0, { alias: 'appReveal', transform: numberAttribute });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    afterNextRender(() => {
      if (!this.browser || typeof IntersectionObserver === 'undefined') return;
      if (prefersReducedMotion()) return;
      if (this.element.getBoundingClientRect().top < innerHeight) return;

      this.element.style.setProperty('--reveal-delay', `${this.delay()}ms`);
      this.element.dataset['reveal'] = 'pending';
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          this.element.dataset['reveal'] = 'in';
          observer.disconnect();
        },
        { rootMargin: '0px 0px -12% 0px' },
      );
      observer.observe(this.element);
    });
  }
}
