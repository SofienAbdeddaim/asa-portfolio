import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { resolveLocalized, type Experience } from '@asa/shared';
import { ContentStore } from '../core/content.store';
import { formatDate } from '../core/locale';
import { LocaleService } from '../core/locale.service';
import { LocalizedPipe } from '../core/localized.pipe';
import { SeoService } from '../core/seo.service';
import { Icon } from '../shared/ui/icon';
import { Skeleton } from '../shared/ui/skeleton';

/**
 * A one-document résumé in the active language, built from the same content as the site. It is
 * designed for paper: the browser's print dialog ("Save as PDF") does the layout, including
 * Arabic shaping and right-to-left order, which is why no server-side PDF generator is needed
 * (ADR 15). Print rules live in `styles.css` under `.cv`.
 */
@Component({
  selector: 'app-cv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Icon, Skeleton],
  template: `
    <div class="container-page py-10">
      <div class="no-print mb-6 flex flex-wrap items-center gap-4">
        <button type="button" class="btn" style="--btn-bg: var(--c-sun)" (click)="print()">
          <app-icon name="arrow" class="rotate-90" />
          {{ 'cv.print' | transloco }}
        </button>
        <p class="max-w-xl text-sm text-muted">{{ 'cv.hint' | transloco }}</p>
      </div>

      @if (store.content(); as c) {
        @if (c.profile; as p) {
          <article class="cv sticker mx-auto max-w-[56rem] p-8 sm:p-12" style="--shadow: 8px">
            <header class="cv-header">
              <h1 class="cv-name">{{ p.fullName }}</h1>
              <p class="cv-headline">{{ p.headline | localized: locale.locale() }}</p>
              <ul class="cv-contact">
                <li>
                  <a [href]="'mailto:' + p.email">{{ p.email }}</a>
                </li>
                @if (p.location) {
                  <li>{{ p.location | localized: locale.locale() }}</li>
                }
                @for (social of p.socials; track social.url) {
                  <li class="ltr-island">
                    <a [href]="social.url">{{ shortUrl(social.url) }}</a>
                  </li>
                }
              </ul>
            </header>

            <section aria-labelledby="cv-profile">
              <h2 id="cv-profile">{{ 'cv.profile' | transloco }}</h2>
              <p class="whitespace-pre-line">{{ p.bio | localized: locale.locale() }}</p>
            </section>

            @if (c.experiences.length) {
              <section aria-labelledby="cv-experience">
                <h2 id="cv-experience">{{ 'cv.experience' | transloco }}</h2>
                @for (job of c.experiences; track job.id) {
                  <div class="cv-entry">
                    <div class="cv-entry-head">
                      <h3>{{ job.role | localized: locale.locale() }} · {{ job.company }}</h3>
                      <p class="cv-dates">{{ period(job) }}</p>
                    </div>
                    <p>{{ job.summary | localized: locale.locale() }}</p>
                    @if (bullets(job).length) {
                      <ul>
                        @for (line of bullets(job); track line) {
                          <li>{{ line }}</li>
                        }
                      </ul>
                    }
                    @if (job.technologies.length) {
                      <p class="cv-tech ltr-island">{{ job.technologies.join(' · ') }}</p>
                    }
                  </div>
                }
              </section>
            }

            @if (c.education.length) {
              <section aria-labelledby="cv-education">
                <h2 id="cv-education">{{ 'cv.education' | transloco }}</h2>
                @for (item of c.education; track item.id) {
                  <div class="cv-entry">
                    <div class="cv-entry-head">
                      <h3>
                        {{ item.degree | localized: locale.locale() }} · {{ item.institution }}
                      </h3>
                      <p class="cv-dates">{{ years(item.startDate, item.endDate) }}</p>
                    </div>
                  </div>
                }
              </section>
            }

            @if (c.skills.length) {
              <section aria-labelledby="cv-skills">
                <h2 id="cv-skills">{{ 'cv.skills' | transloco }}</h2>
                <dl class="cv-skills">
                  @for (group of c.skills; track group.id) {
                    <div>
                      <dt>{{ group.category | localized: locale.locale() }}</dt>
                      <dd class="ltr-island">{{ names(group.items) }}</dd>
                    </div>
                  }
                </dl>
              </section>
            }

            @if (c.certificates.length) {
              <section aria-labelledby="cv-certificates">
                <h2 id="cv-certificates">{{ 'cv.certificates' | transloco }}</h2>
                <ul>
                  @for (item of c.certificates; track item.id) {
                    <li>
                      {{ item.name | localized: locale.locale() }} · {{ item.issuer }} ·
                      {{ year(item.issuedAt) }}
                    </li>
                  }
                </ul>
              </section>
            }

            @if (featured().length) {
              <section aria-labelledby="cv-projects">
                <h2 id="cv-projects">{{ 'cv.projects' | transloco }}</h2>
                @for (project of featured(); track project.id) {
                  <div class="cv-entry">
                    <h3>{{ project.title | localized: locale.locale() }}</h3>
                    <p>{{ project.summary | localized: locale.locale() }}</p>
                    @if (project.repoUrl || project.demoUrl) {
                      <p class="cv-tech ltr-island">
                        <a [href]="project.repoUrl ?? project.demoUrl">{{
                          shortUrl(project.repoUrl ?? project.demoUrl ?? '')
                        }}</a>
                      </p>
                    }
                  </div>
                }
              </section>
            }
          </article>
        }
      } @else {
        <div appSkeleton class="mx-auto h-96 max-w-[56rem]" aria-busy="true"></div>
      }
    </div>
  `,
})
export class CvPage {
  protected readonly store = inject(ContentStore);
  protected readonly locale = inject(LocaleService);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    void this.store.load();
    effect(() => {
      this.locale.revision();
      const profile = this.store.profile();
      const locale = this.locale.locale();
      this.seo.update({
        title: `${profile?.fullName ?? ''} · ${this.transloco.translate('cv.title', {}, locale)}`,
        description: profile ? resolveLocalized(profile.headline, locale) : '',
        path: '/cv',
      });
    });
  }

  /** Projects marked as featured, or the first three. */
  protected featured() {
    const projects = this.store.content()?.projects ?? [];
    const picked = projects.filter((project) => project.featured);
    return (picked.length ? picked : projects).slice(0, 4);
  }

  protected print(): void {
    window.print();
  }

  protected period(job: Experience): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short' };
    const locale = this.locale.locale();
    const start = formatDate(job.startDate, locale, options);
    const end =
      job.current || !job.endDate
        ? this.transloco.translate('cv.present', {}, locale)
        : formatDate(job.endDate, locale, options);
    return `${start} – ${end}`;
  }

  protected year(date: string): string {
    return formatDate(date, this.locale.locale(), { year: 'numeric' });
  }

  protected years(start: string, end?: string): string {
    return end ? `${this.year(start)} – ${this.year(end)}` : this.year(start);
  }

  protected bullets(job: Experience): string[] {
    return resolveLocalized(job.highlights ?? { en: '' }, this.locale.locale())
      .split('\n')
      .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  protected names(items: readonly { name: string }[]): string {
    return items.map((item) => item.name).join(' · ');
  }

  /** `https://github.com/example` -> `github.com/example`, for a compact printed link. */
  protected shortUrl(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }
}
