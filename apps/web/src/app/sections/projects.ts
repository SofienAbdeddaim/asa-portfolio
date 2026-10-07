import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Project } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Tilt } from '../core/tilt.directive';
import { Icon } from '../shared/ui/icon';

const COLORS = ['pink', 'sun', 'mint', 'sky', 'lilac', 'coral'];

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Tilt, Icon],
  template: `
    <section id="projects" class="container-page py-20" aria-labelledby="projects-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-pink); --shadow: 3px"
      >
        {{ 'projects.eyebrow' | transloco }}
      </p>
      <h2 id="projects-title" class="section-title mt-5">{{ 'projects.title' | transloco }}</h2>

      <div class="mt-12 grid gap-8 md:grid-cols-2">
        @for (project of projects(); track project.id; let i = $index) {
          <article
            [appReveal]="(i % 2) * 120"
            appTilt
            class="sticker sticker-lift flex flex-col overflow-hidden"
            [class.md:col-span-2]="project.featured && i === 0"
            [style.--tilt]="i % 2 ? '0.8deg' : '-0.8deg'"
          >
            <div
              class="sticker-color flex items-center justify-between gap-3 border-b-[3px] border-ink px-5 py-3"
              [style.background]="'var(--c-' + color(i) + ')'"
              style="color: var(--on-color)"
            >
              <span class="flex gap-1.5" aria-hidden="true">
                <span class="size-3 rounded-full border-2 border-ink bg-surface"></span>
                <span class="size-3 rounded-full border-2 border-ink bg-surface"></span>
                <span class="size-3 rounded-full border-2 border-ink bg-surface"></span>
              </span>
              @if (project.featured) {
                <span class="chip text-xs" style="--chip-bg: var(--surface); --chip-fg: var(--fg)">
                  <app-icon name="star" class="size-3.5 [&_svg]:fill-current" />
                  {{ 'projects.featured' | transloco }}
                </span>
              }
            </div>

            @if (project.images[0]; as image) {
              <img
                class="aspect-video w-full border-b-[3px] border-ink object-cover"
                [src]="image.url"
                [alt]="image.alt | localized: locale()"
                loading="lazy"
                decoding="async"
              />
            }

            <div class="flex flex-1 flex-col p-6 sm:p-8">
              <h3 class="text-3xl sm:text-4xl">{{ project.title | localized: locale() }}</h3>
              <p class="mt-3 text-lg">{{ project.summary | localized: locale() }}</p>

              @if (project.technologies.length) {
                <ul class="mt-5 flex flex-wrap gap-2">
                  @for (tech of project.technologies; track tech) {
                    <li class="chip ltr-island text-xs" style="--chip-bg: var(--surface-2)">
                      {{ tech }}
                    </li>
                  }
                </ul>
              }

              <div class="mt-auto flex flex-wrap gap-3 pt-6">
                @if (project.repoUrl; as url) {
                  <a
                    class="btn min-h-11 text-sm"
                    style="--btn-bg: var(--surface); --btn-fg: var(--fg)"
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
                    class="btn min-h-11 text-sm"
                    style="--btn-bg: var(--c-sun)"
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
    </section>
  `,
})
export class Projects {
  readonly projects = input.required<readonly Project[]>();
  readonly locale = input.required<Locale>();

  protected color(index: number): string {
    return COLORS[index % COLORS.length] ?? 'pink';
  }
}
