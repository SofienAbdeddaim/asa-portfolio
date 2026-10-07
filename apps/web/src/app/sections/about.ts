import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Certificate, Education, Locale, Profile } from '@asa/shared';
import { formatDate } from '../core/locale';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="about" class="container-page py-20" aria-labelledby="about-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-sun); --shadow: 3px"
      >
        {{ 'about.eyebrow' | transloco }}
      </p>
      <h2 id="about-title" class="section-title mt-5">{{ 'about.title' | transloco }}</h2>

      <div class="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        @if (profile(); as p) {
          <article appReveal class="sticker p-8 text-lg sm:p-10 sm:text-xl" style="--tilt: -1deg">
            <p class="whitespace-pre-line">{{ p.bio | localized: locale() }}</p>
            @if (p.location) {
              <p class="mt-8 inline-flex items-center gap-2 font-semibold">
                <app-icon name="pin" />
                <span class="text-muted">{{ 'about.basedIn' | transloco }}</span>
                <span class="highlight" style="--hl: var(--c-sky)">{{
                  p.location | localized: locale()
                }}</span>
              </p>
            }
          </article>
        }

        <div class="grid gap-8">
          @if (education().length) {
            <article
              appReveal="120"
              class="sticker sticker-color p-6"
              style="--sticker-bg: var(--c-lilac); --tilt: 1.2deg"
            >
              <h3 class="text-2xl">{{ 'about.education' | transloco }}</h3>
              <ul class="mt-4 space-y-4">
                @for (item of education(); track item.id) {
                  <li>
                    <p class="font-semibold">{{ item.degree | localized: locale() }}</p>
                    <p>{{ item.institution }}</p>
                    <p class="text-sm opacity-80">{{ years(item.startDate, item.endDate) }}</p>
                  </li>
                }
              </ul>
            </article>
          }

          @if (certificates().length) {
            <article
              appReveal="240"
              class="sticker sticker-color p-6"
              style="--sticker-bg: var(--c-mint); --tilt: -1.4deg"
            >
              <h3 class="text-2xl">{{ 'about.certificates' | transloco }}</h3>
              <ul class="mt-4 space-y-3">
                @for (item of certificates(); track item.id) {
                  <li class="flex items-start gap-3">
                    <app-icon name="check" class="mt-1.5" />
                    <span>
                      <span class="font-semibold">{{ item.name | localized: locale() }}</span>
                      <span class="block text-sm opacity-80">
                        {{ 'about.issuedBy' | transloco: { issuer: item.issuer } }} ·
                        {{ year(item.issuedAt) }}
                      </span>
                    </span>
                  </li>
                }
              </ul>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class About {
  readonly profile = input.required<Profile | null>();
  readonly education = input.required<readonly Education[]>();
  readonly certificates = input.required<readonly Certificate[]>();
  readonly locale = input.required<Locale>();

  protected year(date: string): string {
    return formatDate(date, this.locale(), { year: 'numeric' });
  }

  protected years(start: string, end?: string): string {
    return end ? `${this.year(start)} – ${this.year(end)}` : this.year(start);
  }
}
