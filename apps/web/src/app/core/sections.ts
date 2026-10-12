import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { prefersReducedMotion } from './motion';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import type { ContentSnapshot } from '@asa/shared';

/** Home page sections, in order. Each has a translated label at `nav.<id>`. */
export const SECTIONS = [
  { id: 'about' },
  { id: 'experience' },
  { id: 'skills' },
  { id: 'projects' },
  { id: 'kind' },
  { id: 'contact' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];
export type Section = (typeof SECTIONS)[number];

/**
 * Sections built from a list. With an empty list the home page leaves them out, so the menu and
 * the palette must not offer them either (ADR 22). The others always render.
 */
const SECTION_DATA: Partial<Record<SectionId, (content: ContentSnapshot) => boolean>> = {
  experience: (content) => content.experiences.length > 0,
  skills: (content) => content.skills.length > 0,
  projects: (content) => content.projects.length > 0,
  kind: (content) => content.testimonials.length > 0,
};

/** Whether a section has something to show. Without content, list sections have nothing. */
export function hasSection(content: ContentSnapshot | null, id: SectionId): boolean {
  const filled = SECTION_DATA[id];
  return !filled || (content !== null && filled(content));
}

/** The sections the home page renders for this content, in order. */
export function visibleSections(content: ContentSnapshot | null): readonly Section[] {
  return SECTIONS.filter(({ id }) => hasSection(content, id));
}

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
