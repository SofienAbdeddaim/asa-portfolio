import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  'search' | 'sun' | 'moon' | 'monitor' | 'arrow' | 'home' | 'globe' | 'command';

/**
 * Decorative inline icons (24px grid, stroke follows `currentColor`). Pass `mirror` for icons
 * that point somewhere (arrows, chevrons): they flip automatically in right-to-left layouts.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'inline-flex size-5 shrink-0',
    '[class.rtl:-scale-x-100]': 'mirror()',
  },
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
    >
      @switch (name()) {
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        }
        @case ('moon') {
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        }
        @case ('monitor') {
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        }
        @case ('arrow') {
          <path d="M5 12h14M13 6l6 6-6 6" />
        }
        @case ('home') {
          <path d="m3 11 9-8 9 8M5 10v10h14V10" />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
        }
        @case ('command') {
          <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly mirror = input(false);
}
