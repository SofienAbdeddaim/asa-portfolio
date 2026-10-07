import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An endless ticker of short labels. It moves toward the reading direction, pauses on hover or
 * focus, and becomes a static wrapped list under `prefers-reduced-motion`. The duplicated half is
 * hidden from assistive technology.
 */
@Component({
  selector: 'app-marquee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'marquee block overflow-hidden', '[style.--marquee-time]': 'seconds() + "s"' },
  template: `
    <div class="marquee-track flex w-max gap-4 py-2">
      @for (item of items(); track item) {
        <span
          class="chip text-lg"
          [style.--chip-bg]="'var(--c-' + colorFor($index) + ')'"
          style="--chip-fg: var(--on-color)"
          >{{ item }}</span
        >
      }
      @for (item of items(); track item) {
        <span
          data-clone
          aria-hidden="true"
          class="chip text-lg"
          [style.--chip-bg]="'var(--c-' + colorFor($index) + ')'"
          style="--chip-fg: var(--on-color)"
          >{{ item }}</span
        >
      }
    </div>
  `,
})
export class Marquee {
  readonly items = input.required<readonly string[]>();
  readonly seconds = input(40);

  private readonly palette = ['sun', 'mint', 'sky', 'pink', 'lilac', 'coral'];
  protected colorFor(index: number): string {
    return this.palette[index % this.palette.length] ?? 'sun';
  }
}
