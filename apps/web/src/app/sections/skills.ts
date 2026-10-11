import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Skill } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';

/**
 * Skill groups as plain lists. Levels are not drawn as ratings: the strongest skills (level 5) are
 * set in the text color and listed first, the rest in the muted color.
 */
@Component({
  selector: 'app-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal],
  template: `
    <section id="skills" class="section" aria-labelledby="skills-title">
      <div class="container-page section-grid">
        <h2 id="skills-title" class="eyebrow self-start lg:sticky lg:top-24">
          {{ 'skills.title' | transloco }}
        </h2>

        <div class="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          @for (group of groups(); track group.id; let i = $index) {
            <div [appReveal]="(i % 3) * 80">
              <h3 class="text-base tracking-normal">{{ group.category | localized: locale() }}</h3>
              <ul class="mt-3 space-y-1">
                @for (skill of sorted(group); track skill.name) {
                  <li
                    class="ltr-island w-fit transition-colors duration-300 hover:text-fg"
                    [class]="skill.level >= 5 ? 'font-semibold text-fg' : 'text-muted'"
                  >
                    {{ skill.name }}
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class Skills {
  readonly groups = input.required<readonly Skill[]>();
  readonly locale = input.required<Locale>();

  protected sorted(group: Skill): Skill['items'] {
    return [...group.items].sort((a, b) => Number(b.level >= 5) - Number(a.level >= 5));
  }
}
