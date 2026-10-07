import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { prefersReducedMotion } from './motion';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** Home page sections, in order. Each has a translated label at `nav.<id>` and a color. */
export const SECTIONS = [
  { id: 'about', color: 'var(--c-sun)' },
  { id: 'experience', color: 'var(--c-mint)' },
  { id: 'skills', color: 'var(--c-sky)' },
  { id: 'projects', color: 'var(--c-pink)' },
  { id: 'play', color: 'var(--c-lilac)' },
  { id: 'kind', color: 'var(--c-sun)' },
  { id: 'contact', color: 'var(--c-coral)' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** Tracks which section is on screen so the header can highlight it. Browser only. */
@Injectable({ providedIn: 'root' })
export class ScrollSpy {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;

  readonly active = signal<SectionId | null>(null);

  /** Starts observing the section elements currently in the DOM. Safe to call repeatedly. */
  observe(): void {
    if (!this.browser || typeof IntersectionObserver === 'undefined') return;
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) this.active.set(top.target.id as SectionId);
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    for (const { id } of SECTIONS) {
      const element = this.document.getElementById(id);
      if (element) this.observer.observe(element);
    }
  }

  stop(): void {
    this.observer?.disconnect();
    this.active.set(null);
  }
}

/** Scrolls to a section, honoring reduced motion. */
export function goToSection(document: Document, id: SectionId): void {
  const smooth = !prefersReducedMotion();
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  element?.setAttribute('tabindex', '-1');
  element?.focus({ preventScroll: true });
}
