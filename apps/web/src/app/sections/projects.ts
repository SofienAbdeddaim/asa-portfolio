import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Project } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="projects" class="section" aria-labelledby="projects-title">
      <div class="container-page section-grid">
        <h2 id="projects-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'projects.title' | transloco }}
        </h2>

        <div class="grid gap-6 md:grid-cols-2">
          @for (project of projects(); track project.id; let i = $index) {
            <article
              [appReveal]="(i % 2) * 100"
              class="card card-hover flex flex-col overflow-hidden"
              [class.md:col-span-2]="project.featured && i === 0"
            >
              @if (project.images[0]; as image) {
                <img
                  class="aspect-video w-full border-b border-line object-cover"
                  [src]="image.url"
                  [alt]="image.alt | localized: locale()"
                  loading="lazy"
                  decoding="async"
                />
              }

              <div class="flex flex-1 flex-col p-6 sm:p-8">
                @if (project.featured) {
                  <p class="eyebrow mb-3 text-accent">{{ 'projects.featured' | transloco }}</p>
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

                <div class="mt-auto flex flex-wrap gap-3 pt-6">
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
}
