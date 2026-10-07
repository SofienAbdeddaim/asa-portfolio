import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale, Profile } from '@asa/shared';
import { goToSection } from '../core/sections';
import { LocalizedPipe } from '../core/localized.pipe';
import { DOCUMENT } from '@angular/common';
import { Button } from '../shared/ui/button';
import { Icon } from '../shared/ui/icon';
import { Marquee } from '../shared/ui/marquee';

const ARABIC_SCRIPT = /[؀-ۿ]/;

interface Word {
  text: string;
  /** Latin words animate letter by letter; Arabic words stay whole so letters keep joining. */
  letters: string[] | null;
}

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LocalizedPipe, Button, Icon, Marquee],
  template: `
    <section class="container-page relative pt-8 pb-12 sm:pt-14" aria-labelledby="hero-title">
      <div class="grid items-center gap-12 lg:grid-cols-[1.35fr_1fr]">
        <div>
          @if (profile(); as p) {
            <p
              class="sticker sticker-color inline-flex items-center gap-3 px-4 py-1.5 text-sm font-semibold"
              style="--shadow: 4px; --sticker-bg: var(--c-sun)"
            >
              <span
                class="anim-pulse size-3.5 rounded-full border-2 border-ink"
                [style.background]="statusColor()"
              ></span>
              {{ availabilityKey() | transloco }}
            </p>

            <h1 id="hero-title" class="mt-8">
              <span class="block text-2xl font-semibold sm:text-3xl">{{
                'hero.greeting' | transloco
              }}</span>
              <span
                class="mt-2 block text-[clamp(3rem,8.5vw,6.5rem)] leading-[0.95]"
                [attr.aria-label]="p.fullName"
              >
                @for (word of words(); track $index; let wi = $index) {
                  <span class="block" aria-hidden="true">
                    @if (word.letters; as letters) {
                      <span dir="ltr" class="inline-block font-extrabold">
                        @for (letter of letters; track $index) {
                          <span class="anim-letter" [style.--i]="offset(wi) + $index">{{
                            letter
                          }}</span>
                        }
                      </span>
                    } @else {
                      <span class="anim-letter" [style.--i]="$index * 3">{{ word.text }}</span>
                    }
                  </span>
                }
              </span>
            </h1>

            <p class="mt-8 max-w-xl text-xl sm:text-2xl">
              <span class="highlight" style="--hl: var(--c-mint)">{{
                p.headline | localized: locale()
              }}</span>
            </p>

            <div class="mt-10 flex flex-wrap gap-4">
              <button type="button" appButton color="coral" (click)="jump('projects')">
                {{ 'hero.work' | transloco }}
                <app-icon name="arrow" [mirror]="true" />
              </button>
              <button type="button" appButton color="paper" (click)="jump('contact')">
                <app-icon name="mail" />
                {{ 'hero.hello' | transloco }}
              </button>
            </div>
          }
        </div>

        <div class="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
          @if (profile(); as p) {
            <div
              class="sticker sticker-color anim-float absolute inset-[8%] grid place-items-center overflow-hidden"
              style="--sticker-bg: var(--c-coral); --shadow: 12px; border-radius: 58% 42% 55% 45% / 45% 55% 45% 55%"
            >
              <span class="font-display text-[clamp(5rem,16vw,9rem)] leading-none">{{
                initials()
              }}</span>
            </div>

            @if (locale() !== 'ar') {
              <svg
                viewBox="0 0 200 200"
                class="anim-spin absolute inset-0 size-full text-fg"
                style="--spin-time: 26s"
              >
                <defs>
                  <path id="orbit" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
                </defs>
                <text
                  class="font-display"
                  font-size="15"
                  font-weight="700"
                  fill="currentColor"
                  letter-spacing="2.2"
                >
                  <textPath href="#orbit" textLength="508" lengthAdjust="spacing">
                    {{ orbitText(p) }}
                  </textPath>
                </text>
              </svg>
            }

            <app-icon
              name="star"
              class="anim-wobble absolute -top-1 end-4 size-14 text-sun [&_svg]:fill-current"
            />
            <app-icon
              name="star"
              class="anim-wobble absolute bottom-6 -start-2 size-10 text-mint [&_svg]:fill-current"
              style="animation-delay: -1.2s"
            />
            <span
              class="anim-float absolute start-2 top-[18%] size-8 rounded-full border-[3px] border-ink bg-sky"
              style="--delay: -1s"
            ></span>
            <span
              class="anim-float absolute end-0 bottom-[22%] size-6 rotate-12 border-[3px] border-ink bg-pink"
              style="--delay: -2.4s"
            ></span>
          }
        </div>
      </div>

      @if (tags().length) {
        <app-marquee class="mt-16 -mx-4 sm:-mx-8" [items]="tags()" [seconds]="45" />
      }

      <p class="mt-10 flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span class="anim-float inline-block"><app-icon name="arrow" class="rotate-90" /></span>
        {{ 'hero.scroll' | transloco }}
      </p>
    </section>
  `,
})
export class Hero {
  readonly profile = input.required<Profile | null>();
  readonly locale = input.required<Locale>();
  readonly tags = input<readonly string[]>([]);

  private readonly document = inject(DOCUMENT);

  protected readonly words = computed<Word[]>(() => {
    const name = this.profile()?.fullName ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, letters: ARABIC_SCRIPT.test(text) ? null : [...text] }));
  });

  protected readonly initials = computed(() =>
    (this.profile()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => [...part][0] ?? '')
      .join(''),
  );

  protected readonly statusColor = computed(() => {
    const status = this.profile()?.availability.status;
    return status === 'open'
      ? 'var(--c-mint)'
      : status === 'limited'
        ? 'var(--c-sun)'
        : 'var(--c-pink)';
  });

  protected readonly availabilityKey = computed(() => {
    const status = this.profile()?.availability.status;
    return status === 'limited'
      ? 'hero.limited'
      : status === 'closed'
        ? 'hero.closed'
        : 'hero.available';
  });

  protected orbitText(profile: Profile): string {
    return `${profile.headline.en} • `.repeat(2).toUpperCase();
  }

  /** Delay index so letters of later words start after earlier ones. */
  protected offset(wordIndex: number): number {
    return this.words()
      .slice(0, wordIndex)
      .reduce((sum, word) => sum + (word.letters?.length ?? 1), 0);
  }

  protected jump(id: 'projects' | 'contact'): void {
    goToSection(this.document, id);
  }
}
