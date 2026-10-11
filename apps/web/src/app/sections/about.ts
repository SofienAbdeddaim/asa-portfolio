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
    <section id="about" class="section" aria-labelledby="about-title">
      <div class="container-page section-grid">
        <h2 id="about-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'about.title' | transloco }}
        </h2>

        <div>
          @if (profile(); as p) {
            <div appReveal class="max-w-3xl">
              <p class="text-lg whitespace-pre-line sm:text-xl">
                {{ p.bio | localized: locale() }}
              </p>
              @if (p.location) {
                <p class="mt-6 inline-flex items-center gap-2 text-muted">
                  <app-icon name="pin" />
                  {{ 'about.basedIn' | transloco }} {{ p.location | localized: locale() }}
                </p>
              }
            </div>
          }

          @if (education().length || certificates().length) {
            <div class="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-2">
              @if (education().length) {
                <div appReveal="100">
                  <h3 class="text-lg">{{ 'about.education' | transloco }}</h3>
                  <ul class="mt-4 space-y-4">
                    @for (item of education(); track item.id) {
                      <li>
                        <p class="font-semibold">{{ item.degree | localized: locale() }}</p>
                        <p class="text-muted">{{ item.institution }}</p>
                        <p class="font-mono text-xs text-muted">
                          {{ years(item.startDate, item.endDate) }}
                        </p>
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (certificates().length) {
                <div appReveal="200">
                  <h3 class="text-lg">{{ 'about.certificates' | transloco }}</h3>
                  <ul class="mt-4 space-y-4">
                    @for (item of certificates(); track item.id) {
                      <li class="flex items-start gap-3">
                        <app-icon name="check" class="mt-1 text-accent" />
                        <span>
                          <span class="font-semibold">{{ item.name | localized: locale() }}</span>
                          <span class="block text-sm text-muted">
                            {{ 'about.issuedBy' | transloco: { issuer: item.issuer } }} ·
                            {{ year(item.issuedAt) }}
                          </span>
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
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
