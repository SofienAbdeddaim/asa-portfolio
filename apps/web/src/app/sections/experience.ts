import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Experience as ExperienceEntry, Locale } from '@asa/shared';
import { resolveLocalized } from '@asa/shared';
import { formatDate } from '../core/locale';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="experience" class="section" aria-labelledby="experience-title">
      <div class="container-page section-grid">
        <h2 id="experience-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'experience.title' | transloco }}
        </h2>

        <div class="timeline">
          <span class="timeline-rail" aria-hidden="true"></span>
          <span class="timeline-fill" aria-hidden="true"></span>

          <ol class="list-none">
            @for (item of items(); track item.id) {
              <li
                appReveal
                class="timeline-item grid gap-1 border-b border-line py-6 first:pt-0 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6"
              >
                <p class="font-mono text-xs leading-6 text-muted tabular-nums">
                  {{ period(item) }}
                </p>
                <div class="min-w-0">
                  <h3 class="text-lg tracking-normal">
                    {{ item.role | localized: locale() }}
                    <span class="font-sans text-base font-normal text-muted">
                      · {{ item.company }}
                      @if (item.location) {
                        · {{ item.location | localized: locale() }}
                      }
                    </span>
                  </h3>
                  <p class="mt-2 max-w-2xl text-muted">{{ item.summary | localized: locale() }}</p>

                  @if (bullets(item); as lines) {
                    @if (lines.length) {
                      <details class="group mt-3">
                        <summary
                          class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-link [&::-webkit-details-marker]:hidden"
                        >
                          <app-icon
                            name="arrow"
                            [mirror]="true"
                            class="size-4 transition-transform duration-300 group-open:rotate-90"
                          />
                          {{ 'experience.details' | transloco }}
                        </summary>
                        <ul class="mt-2 max-w-2xl list-disc space-y-1.5 ps-5 text-muted">
                          @for (line of lines; track line) {
                            <li>{{ line }}</li>
                          }
                        </ul>
                      </details>
                    }
                  }

                  @if (item.technologies.length) {
                    <p class="mt-3 font-mono text-xs text-muted">
                      <span class="sr-only">Technologies: </span>
                      <span class="ltr-island">{{ item.technologies.join(' · ') }}</span>
                    </p>
                  }
                </div>
              </li>
            }
          </ol>
        </div>
      </div>
    </section>
  `,
})
export class Experience {
  readonly items = input.required<readonly ExperienceEntry[]>();
  readonly locale = input.required<Locale>();

  private readonly transloco = inject(TranslocoService);

  protected period(item: ExperienceEntry): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short' };
    const start = formatDate(item.startDate, this.locale(), options);
    if (item.current || !item.endDate) return `${start} – ${this.presentLabel()}`;
    return `${start} – ${formatDate(item.endDate, this.locale(), options)}`;
  }

  /** Markdown-style bullet list ("- text" per line) to plain lines. */
  protected bullets(item: ExperienceEntry): string[] {
    return resolveLocalized(item.highlights ?? {}, this.locale())
      .split('\n')
      .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  private presentLabel(): string {
    return this.transloco.translate('experience.present', {}, this.locale());
  }
}
