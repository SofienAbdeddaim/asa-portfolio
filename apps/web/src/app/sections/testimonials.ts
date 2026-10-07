import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Testimonial } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

const COLORS = ['lilac', 'sun', 'mint'];

@Component({
  selector: 'app-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="kind" class="container-page py-20" aria-labelledby="kind-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-lilac); --shadow: 3px"
      >
        {{ 'kind.eyebrow' | transloco }}
      </p>
      <h2 id="kind-title" class="section-title mt-5">{{ 'kind.title' | transloco }}</h2>

      <ul class="mt-12 grid list-none gap-10 md:grid-cols-3">
        @for (item of items(); track item.id; let i = $index) {
          <li [appReveal]="i * 110" class="relative">
            <figure
              class="sticker sticker-color sticker-lift relative h-full p-6"
              [style.--sticker-bg]="'var(--c-' + color(i) + ')'"
              [style.--tilt]="['-1.5deg', '1.2deg', '-0.8deg'][i % 3]"
            >
              <app-icon name="quote" class="size-9" />
              <blockquote class="mt-3 text-xl font-medium leading-snug">
                {{ item.quote | localized: locale() }}
              </blockquote>
              <figcaption class="mt-5 font-semibold">
                {{ item.authorName }}
                <span class="block text-sm font-normal opacity-80">
                  {{ item.authorRole | localized: locale() }}
                  @if (item.authorCompany) {
                    · {{ item.authorCompany }}
                  }
                </span>
              </figcaption>
            </figure>
          </li>
        }
      </ul>
    </section>
  `,
})
export class Testimonials {
  readonly items = input.required<readonly Testimonial[]>();
  readonly locale = input.required<Locale>();

  protected color(index: number): string {
    return COLORS[index % COLORS.length] ?? 'lilac';
  }
}
