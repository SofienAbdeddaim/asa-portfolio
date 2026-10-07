import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Experience as ExperienceEntry, Locale } from '@asa/shared';
import { resolveLocalized } from '@asa/shared';
import { formatDate } from '../core/locale';
import { LocalizedPipe } from '../core/localized.pipe';
import { Reveal } from '../core/reveal.directive';
import { Icon } from '../shared/ui/icon';

const COLORS = ['mint', 'sun', 'sky', 'pink', 'lilac', 'coral'];

/** A wavy vertical line (viewBox units) that is drawn as the section scrolls into view. */
const WAVE = `M16 0 ${Array.from({ length: 16 }, (_, i) => (i === 0 ? 'Q 30 25 16 50' : 'T 16 ' + (50 + i * 50))).join(' ')}`;

@Component({
  selector: 'app-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Reveal, Icon],
  template: `
    <section id="experience" class="container-page py-20" aria-labelledby="experience-title">
      <p
        class="eyebrow sticker sticker-color px-3 py-1"
        style="--sticker-bg: var(--c-mint); --shadow: 3px"
      >
        {{ 'experience.eyebrow' | transloco }}
      </p>
      <h2 id="experience-title" class="section-title mt-5">{{ 'experience.title' | transloco }}</h2>

      <ol class="relative mt-16 list-none">
        <div
          class="pointer-events-none absolute inset-y-0 start-0 w-8 md:start-1/2 md:-ms-4"
          aria-hidden="true"
        >
          <svg
            class="h-full w-full overflow-visible"
            viewBox="0 0 32 800"
            preserveAspectRatio="none"
          >
            <path
              [attr.d]="wave"
              pathLength="1"
              class="scroll-draw"
              fill="none"
              stroke="var(--ink)"
              stroke-width="4"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="sticky top-[45vh] -ms-2 w-fit">
            <app-icon
              name="star"
              class="scroll-spin size-12 text-sun [&_svg]:fill-current [&_svg]:stroke-ink"
            />
          </div>
        </div>

        @for (item of items(); track item.id; let i = $index; let odd = $odd) {
          <li class="relative mb-14 ps-14 last:mb-0 md:grid md:grid-cols-2 md:gap-24 md:ps-0">
            <span
              class="absolute start-[0.35rem] top-9 size-6 rounded-full border-[3px] border-ink md:start-1/2 md:-ms-3"
              [style.background]="'var(--c-' + color(i) + ')'"
              aria-hidden="true"
            ></span>

            <article
              [appReveal]="odd ? 80 : 0"
              class="sticker sticker-lift sticker-color p-6 sm:p-8"
              [class]="odd ? 'md:col-start-2' : 'md:col-start-1'"
              [style.--sticker-bg]="'var(--surface)'"
              [style.--sticker-fg]="'var(--fg)'"
              [style.--tilt]="odd ? '1deg' : '-1deg'"
            >
              <p
                class="chip"
                [style.--chip-bg]="'var(--c-' + color(i) + ')'"
                style="--chip-fg: var(--on-color)"
              >
                {{ period(item) }}
              </p>
              <h3 class="mt-4 text-3xl">{{ item.role | localized: locale() }}</h3>
              <p class="mt-1 text-lg font-semibold">
                {{ item.company }}
                @if (item.location) {
                  <span class="font-normal text-muted">
                    · {{ item.location | localized: locale() }}</span
                  >
                }
              </p>
              <p class="mt-4">{{ item.summary | localized: locale() }}</p>

              @if (bullets(item).length) {
                <ul class="mt-4 space-y-2">
                  @for (line of bullets(item); track line) {
                    <li class="flex gap-3">
                      <app-icon name="arrow" [mirror]="true" class="mt-1.5 size-4" />
                      <span>{{ line }}</span>
                    </li>
                  }
                </ul>
              }

              @if (item.technologies.length) {
                <ul class="mt-5 flex flex-wrap gap-2" aria-label="Technologies">
                  @for (tech of item.technologies; track tech) {
                    <li class="chip ltr-island text-xs" style="--chip-bg: var(--surface-2)">
                      {{ tech }}
                    </li>
                  }
                </ul>
              }
            </article>
          </li>
        }
      </ol>
    </section>
  `,
})
export class Experience {
  readonly items = input.required<readonly ExperienceEntry[]>();
  readonly locale = input.required<Locale>();

  protected readonly wave = WAVE;

  private readonly transloco = inject(TranslocoService);

  protected color(index: number): string {
    return COLORS[index % COLORS.length] ?? 'sun';
  }

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
