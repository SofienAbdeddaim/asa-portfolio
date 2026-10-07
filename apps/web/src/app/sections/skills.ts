import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Skill } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Tilt } from '../core/tilt.directive';

const COLORS = ['sky', 'pink', 'sun', 'mint', 'lilac', 'coral'];
const LEVELS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Tilt],
  template: `
    <section id="skills" class="container-page py-20" aria-labelledby="skills-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-sky); --shadow: 3px"
      >
        {{ 'skills.eyebrow' | transloco }}
      </p>
      <h2 id="skills-title" class="section-title mt-5">{{ 'skills.title' | transloco }}</h2>

      <div class="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        @for (group of groups(); track group.id; let i = $index) {
          <article
            [appReveal]="i * 90"
            appTilt
            class="sticker sticker-color sticker-lift p-6"
            [style.--sticker-bg]="'var(--c-' + color(i) + ')'"
            [style.--tilt]="tilt(i)"
          >
            <h3 class="text-3xl">{{ group.category | localized: locale() }}</h3>
            <ul class="mt-5 space-y-3">
              @for (skill of group.items; track skill.name) {
                <li class="flex items-center justify-between gap-4">
                  <span class="ltr-island text-lg font-semibold">{{ skill.name }}</span>
                  <span
                    role="img"
                    class="flex gap-1.5"
                    [attr.aria-label]="'skills.level' | transloco: { level: skill.level }"
                  >
                    @for (n of levels; track n) {
                      <span
                        class="size-4 rounded-full border-2 border-ink"
                        [style.background]="n <= skill.level ? 'var(--ink)' : 'transparent'"
                      ></span>
                    }
                  </span>
                </li>
              }
            </ul>
          </article>
        }
      </div>
    </section>
  `,
})
export class Skills {
  readonly groups = input.required<readonly Skill[]>();
  readonly locale = input.required<Locale>();
  protected readonly levels = LEVELS;

  protected color(index: number): string {
    return COLORS[index % COLORS.length] ?? 'sky';
  }

  protected tilt(index: number): string {
    return ['-1.2deg', '1deg', '-0.6deg'][index % 3] ?? '0deg';
  }
}
