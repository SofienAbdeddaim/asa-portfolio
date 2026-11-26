import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Project } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';
import { ProjectGallery } from './project-gallery';

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon, ProjectGallery],
  template: `
    <section id="projects" class="section" aria-labelledby="projects-title">
      <div class="container-page section-grid">
        <h2 id="projects-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'projects.title' | transloco }}
        </h2>

        <div class="grid gap-6 md:grid-cols-2">
          @for (project of ordered(); track project.id; let i = $index) {
            <article
              [appReveal]="(i % 2) * 100"
              class="card card-hover flex flex-col overflow-hidden"
              [class.md:col-span-2]="project.featured && i === 0"
            >
              @if (imagesFor(project); as images) {
                @if (images.length) {
                  <app-project-gallery
                    [images]="images"
                    [locale]="locale()"
                    [label]="
                      'projects.gallery.label'
                        | transloco: { name: (project.title | localized: locale()) }
                    "
                  />
                }
              }

              <div class="flex flex-1 flex-col p-6 sm:p-8">
                @if (project.featured || project.professional || project.status) {
                  <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    @if (project.featured) {
                      <p class="eyebrow text-accent">{{ 'projects.featured' | transloco }}</p>
                    }
                    @if (project.professional) {
                      <p class="eyebrow">{{ 'projects.professional' | transloco }}</p>
                    }
                    @if (project.status; as status) {
                      <span class="chip" [class.text-accent]="status === 'live'">
                        {{ 'projects.status.' + status | transloco }}
                      </span>
                    }
                  </div>
                }
                <h3 class="text-2xl">{{ project.title | localized: locale() }}</h3>
                <p class="mt-3 text-muted">{{ project.summary | localized: locale() }}</p>

                @if (project.technologies.length) {
                  <ul class="mt-5 flex flex-wrap gap-2">
                    @for (tech of project.technologies; track tech) {
                      <li class="chip ltr-island">{{ tech }}</li>
                    }
                  </ul>
                }

                <div class="mt-auto flex flex-wrap items-center gap-3 pt-6">
                  @if (project.repoUrl; as url) {
                    <a
                      class="btn min-h-11 text-sm"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      [attr.aria-label]="
                        ('projects.codeFor'
                          | transloco: { name: (project.title | localized: locale()) }) +
                        ' (' +
                        ('common.newTab' | transloco) +
                        ')'
                      "
                    >
                      <app-icon name="github" />
                      {{ 'projects.code' | transloco }}
                    </a>
                  }
                  @if (project.demoUrl; as url) {
                    <a
                      class="btn btn-primary min-h-11 text-sm"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      [attr.aria-label]="
                        ('projects.demoFor'
                          | transloco: { name: (project.title | localized: locale()) }) +
                        ' (' +
                        ('common.newTab' | transloco) +
                        ')'
                      "
                    >
                      {{ 'projects.demo' | transloco }}
                      <app-icon name="external" />
                    </a>
                  }
                  @if (project.professional && !project.repoUrl) {
                    <p class="text-sm text-muted">{{ 'projects.privateCode' | transloco }}</p>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class Projects {
  readonly projects = input.required<readonly Project[]>();
  readonly locale = input.required<Locale>();

  /**
   * Screenshots for this language: the ones made for it first, then the ones meant for every
   * language. Screenshots made for another language are left out, unless nothing else exists.
   */
  protected imagesFor(project: Project): Project['images'] {
    const locale = this.locale();
    const own = project.images.filter((image) => image.locale === locale);
    const shared = project.images.filter((image) => !image.locale);
    const chosen = [...own, ...shared];
    return chosen.length ? chosen : project.images;
  }

  /** Personal projects first, then professional ones, each in the back-office order. */
  protected readonly ordered = computed(() => [
    ...this.projects().filter((p) => !p.professional),
    ...this.projects().filter((p) => p.professional),
  ]);
}
