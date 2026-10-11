import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Testimonial } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="kind" class="section" aria-labelledby="kind-title">
      <div class="container-page section-grid">
        <h2 id="kind-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'kind.title' | transloco }}
        </h2>

        <ul class="grid list-none gap-6 md:grid-cols-2">
          @for (item of items(); track item.id; let i = $index) {
            <li [appReveal]="(i % 2) * 100">
              <figure class="card h-full p-6 sm:p-8">
                <app-icon name="quote" class="size-6 text-accent" />
                <blockquote class="mt-3 text-lg leading-relaxed">
                  {{ item.quote | localized: locale() }}
                </blockquote>
                <figcaption class="mt-5 font-semibold">
                  {{ item.authorName }}
                  <span class="block text-sm font-normal text-muted">
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
      </div>
    </section>
  `,
})
export class Testimonials {
  readonly items = input.required<readonly Testimonial[]>();
  readonly locale = input.required<Locale>();
}
