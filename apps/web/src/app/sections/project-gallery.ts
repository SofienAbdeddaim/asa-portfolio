import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, LocalizedString } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { prefersReducedMotion } from '../core/motion';
import { Icon } from '../shared/ui/icon';

export interface GalleryImage {
  url: string;
  alt?: LocalizedString;
}

/** Time each screenshot stays on screen while the gallery plays. */
export const GALLERY_INTERVAL_MS = 1000;

/**
 * Screenshots of one project, one at a time. With several images it moves on by itself while it
 * is on screen, and stops while the pointer or the keyboard focus is on it, when the viewer
 * pauses it, or for good under `prefers-reduced-motion`. Dots pick a screenshot directly. On the
 * server and without JavaScript the first screenshot shows, and the others stay hidden.
 */
@Component({
  selector: 'app-project-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Icon],
  host: {
    class: 'gallery relative block aspect-video overflow-hidden border-b border-line',
    role: 'group',
    'aria-roledescription': 'carousel',
    '[attr.aria-label]': 'label()',
    '(mouseenter)': 'hovered.set(true)',
    '(mouseleave)': 'hovered.set(false)',
    '(focusin)': 'focused.set(true)',
    '(focusout)': 'focused.set(false)',
  },
  template: `
    @for (image of images(); track image.url; let i = $index) {
      <img
        class="gallery-slide absolute inset-0 size-full object-cover"
        [class.is-active]="i === index()"
        [attr.aria-hidden]="i === index() ? null : 'true'"
        [src]="image.url"
        [alt]="image.alt | localized: locale()"
        loading="lazy"
        decoding="async"
      />
    }

    @if (images().length > 1) {
      <div
        class="gallery-controls absolute bottom-3 end-3 flex items-center gap-1 rounded-full px-1.5 py-1"
      >
        <button
          type="button"
          class="gallery-control"
          [attr.aria-label]="
            (paused() ? 'projects.gallery.play' : 'projects.gallery.pause') | transloco
          "
          (click)="paused.set(!paused())"
        >
          <app-icon [name]="paused() ? 'play' : 'pause'" class="size-4" />
        </button>
        @for (image of images(); track image.url; let i = $index) {
          <button
            type="button"
            class="gallery-dot"
            [attr.aria-current]="i === index() ? 'true' : null"
            [attr.aria-label]="
              'projects.gallery.show' | transloco: { index: i + 1, total: images().length }
            "
            (click)="show(i)"
          ></button>
        }
      </div>
      <p class="sr-only" aria-live="polite">
        @if (paused() || focused()) {
          {{ 'projects.gallery.show' | transloco: { index: index() + 1, total: images().length } }}
        }
      </p>
    }
  `,
})
export class ProjectGallery {
  readonly images = input.required<readonly GalleryImage[]>();
  readonly locale = input.required<Locale>();
  readonly label = input('');

  protected readonly index = signal(0);
  protected readonly paused = signal(false);
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  private readonly visible = signal(false);
  /** Re-arms the timer when a turn was skipped (tab in the background). */
  private readonly tick = signal(0);

  /** True while the gallery should move on by itself. */
  readonly playing = computed(
    () =>
      this.images().length > 1 &&
      this.visible() &&
      !this.paused() &&
      !this.hovered() &&
      !this.focused(),
  );

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setTimeout> | undefined;

    // One timer at a time, armed only while playing: nothing ticks off screen or when paused.
    effect(() => {
      clearTimeout(timer);
      this.index();
      this.tick();
      if (!this.playing()) return;
      timer = setTimeout(() => {
        if (document.visibilityState !== 'hidden') this.next();
        else this.tick.update((n) => n + 1);
      }, GALLERY_INTERVAL_MS);
    });

    afterNextRender(() => {
      // Without IntersectionObserver the gallery never knows it is on screen, so it stays still.
      if (!browser || typeof IntersectionObserver === 'undefined') return;
      if (prefersReducedMotion()) this.paused.set(true);
      const observer = new IntersectionObserver((entries) =>
        this.visible.set(entries.some((entry) => entry.isIntersecting)),
      );
      observer.observe(this.element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => clearTimeout(timer));
  }

  protected show(index: number): void {
    this.index.set(index);
    this.paused.set(true);
  }

  private next(): void {
    this.index.update((current) => (current + 1) % this.images().length);
  }
}
