import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { resolveLocalized, type Locale, type Skill } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';

/**
 * Skill groups as an editorial index: one numbered row per group, its skills flowing as a single
 * line. Levels are not drawn as ratings: the strongest skills (level 5) are set in the text color
 * and listed first. The lead line counts the skills and names the group with the most strong ones.
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

        <div>
          @if (core(); as core) {
            <p class="skills-lead" appReveal="0">
              {{ 'skills.total.' + plural(total()) | transloco: { count: total() } }}
              <span class="text-muted">{{ 'skills.core' | transloco }}</span>
              {{ core }}
            </p>
          }

          <ol class="skills-index">
            @for (group of groups(); track group.id; let i = $index) {
              <li class="skill-row" appReveal="0">
                <span class="skill-num ltr-island" aria-hidden="true">{{ number(i) }}</span>
                <div class="skill-head">
                  <h3>{{ group.category | localized: locale() }}</h3>
                  <p class="skill-count">
                    {{
                      'skills.count.' + plural(group.items.length)
                        | transloco: { count: group.items.length }
                    }}
                  </p>
                </div>
                <div class="skill-items">
                  <ul>
                    @for (skill of sorted(group); track skill.name; let j = $index) {
                      <li [class.strong]="skill.level >= 5" [style.--i]="j">
                        <span class="ltr-island">{{ skill.name }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </li>
            }
          </ol>
        </div>
      </div>
    </section>
  `,
})
export class Skills {
  readonly groups = input.required<readonly Skill[]>();
  readonly locale = input.required<Locale>();

  protected readonly total = computed(() =>
    this.groups().reduce((sum, group) => sum + group.items.length, 0),
  );

  /** The group with the most strong skills (the first one on a tie), named in the lead line. */
  protected readonly core = computed(() => {
    let best: Skill | undefined;
    let bestCount = 0;
    for (const group of this.groups()) {
      const strong = group.items.filter((item) => item.level >= 5).length;
      if (strong > bestCount) {
        best = group;
        bestCount = strong;
      }
    }
    return best ? resolveLocalized(best.category, this.locale()) : '';
  });

  private readonly rules = computed(() => new Intl.PluralRules(this.locale()));

  /** CLDR plural category: Arabic needs zero, one, two, few, many and other. */
  protected plural(count: number): Intl.LDMLPluralRule {
    return this.rules().select(count);
  }

  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  protected sorted(group: Skill): Skill['items'] {
    return [...group.items].sort((a, b) => Number(b.level >= 5) - Number(a.level >= 5));
  }
}
