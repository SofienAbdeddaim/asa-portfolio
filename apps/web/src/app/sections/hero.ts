import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Experience, Locale, Profile } from '@asa/shared';
import { resolveLocalized } from '@asa/shared';
import { LocalizedPipe } from '../core/localized.pipe';
import { markdownToText } from '../core/markdown-text';
import { prefersReducedMotion } from '../core/motion';
import { goToSection } from '../core/sections';
import { Button } from '../shared/ui/button';
import { Icon } from '../shared/ui/icon';

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const COUNT_DELAY = 600;
const COUNT_DURATION = 1400;

interface Fact {
  key: string;
  value: number;
}

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, LocalizedPipe, Button, Icon],
  template: `
    <section class="container-page pt-12 pb-16 sm:pt-20 sm:pb-24" aria-labelledby="hero-title">
      @if (profile(); as p) {
        <div class="grid items-end gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div class="min-w-0">
            <p class="anim-up inline-flex items-center gap-2.5 text-sm text-muted">
              <span class="status-dot" [style.--dot]="statusColor()"></span>
              {{ availabilityKey() | transloco }}
            </p>

            <h1
              id="hero-title"
              class="mt-5 mb-5 text-[clamp(2.5rem,7.5vw,5.25rem)] wrap-anywhere leading-none font-bold tracking-[-0.035em]"
            >
              <span class="sr-only">{{ p.fullName }}</span>
              @for (word of words(); track $index) {
                <span class="anim-mask" aria-hidden="true">
                  <span [attr.dir]="word.dir" [style.--delay]="$index * 0.1 + 's'">{{
                    word.text
                  }}</span>
                </span>
              }
            </h1>

            <p class="anim-up text-lg font-semibold sm:text-xl" style="--delay: 0.35s">
              {{ p.headline | localized: locale() }}
            </p>
            @if (pitch(); as text) {
              <p class="anim-up mt-3 max-w-xl text-muted" style="--delay: 0.45s">{{ text }}</p>
            }

            <div class="anim-up mt-8 flex flex-wrap gap-3" style="--delay: 0.55s">
              <button type="button" appButton variant="primary" (click)="jump()">
                {{ 'hero.work' | transloco }}
                <app-icon name="arrow" [mirror]="true" class="btn-arrow" />
              </button>
              <a appButton [routerLink]="['/', locale(), 'cv']">{{ 'hero.cv' | transloco }}</a>
            </div>
          </div>

          @if (facts().length) {
            <div
              class="card facts anim-card"
              style="--delay: 0.4s"
              (pointermove)="spotlight($event)"
            >
              <dl class="grid grid-cols-3">
                @for (fact of facts(); track fact.key; let i = $index) {
                  <div
                    class="anim-up flex flex-col-reverse border-b border-line px-5 py-4 not-last:border-e"
                    [style.--delay]="0.6 + i * 0.08 + 's'"
                  >
                    <dt class="text-sm text-muted">{{ 'hero.' + fact.key | transloco }}</dt>
                    <dd class="font-display text-3xl font-semibold tabular-nums">
                      {{ shown(fact.value) }}
                    </dd>
                  </div>
                }
              </dl>
              @if (current(); as job) {
                <p class="anim-up px-5 py-4 text-sm" style="--delay: 1s">
                  <span class="eyebrow block">{{ 'hero.now' | transloco }}</span>
                  {{
                    'experience.at'
                      | transloco: { role: (job.role | localized: locale()), company: job.company }
                  }}
                </p>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class Hero {
  readonly profile = input.required<Profile | null>();
  readonly experiences = input<readonly Experience[]>([]);
  readonly locale = input.required<Locale>();

  private readonly document = inject(DOCUMENT);

  /** 0 → 1 while the figures count up; 1 on the server and when motion is reduced. */
  private readonly progress = signal(1);

  /** Words of the name; Latin words are isolated as left-to-right so RTL pages keep them whole. */
  protected readonly words = computed(() =>
    (this.profile()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, dir: ARABIC_SCRIPT.test(text) ? 'rtl' : 'ltr' })),
  );

  /** The first sentence of the bio, as a one-line pitch under the headline. */
  protected readonly pitch = computed(() => {
    const profile = this.profile();
    if (!profile) return '';
    const text = markdownToText(resolveLocalized(profile.bio, this.locale()));
    return text.match(/^.+?[.!?؟](?=\s|$)/)?.[0] ?? '';
  });

  /** Figures computed from the published experience, so they never drift from the content. */
  protected readonly facts = computed<Fact[]>(() => {
    const items = this.experiences();
    if (!items.length) return [];
    const first = Math.min(...items.map((item) => Date.parse(item.startDate)));
    const years = Math.floor((Date.now() - first) / YEAR_MS);
    return [
      { key: 'years', value: years },
      { key: 'missions', value: items.length },
      { key: 'tech', value: new Set(items.flatMap((item) => item.technologies)).size },
    ].filter((fact) => fact.value > 0);
  });

  protected readonly current = computed(() =>
    this.experiences().find((item) => item.current || !item.endDate),
  );

  protected readonly statusColor = computed(() => {
    const status = this.profile()?.availability.status;
    return status === 'open'
      ? 'var(--ok)'
      : status === 'limited'
        ? 'var(--accent)'
        : 'var(--muted)';
  });

  protected readonly availabilityKey = computed(() => {
    const status = this.profile()?.availability.status;
    return status === 'limited'
      ? 'hero.limited'
      : status === 'closed'
        ? 'hero.closed'
        : 'hero.available';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') return;
      let frame = 0;
      const start = performance.now() + COUNT_DELAY;
      this.progress.set(0);
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / COUNT_DURATION));
        this.progress.set(t);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      destroyRef.onDestroy(() => cancelAnimationFrame(frame));
    });
  }

  /** The value shown while counting up (ease-out), and the exact value at rest. */
  protected shown(value: number): number {
    const t = this.progress();
    return t >= 1 ? value : Math.round(value * (1 - Math.pow(2, -10 * t)));
  }

  protected spotlight(event: PointerEvent): void {
    const card = event.currentTarget as HTMLElement;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - box.left}px`);
    card.style.setProperty('--my', `${event.clientY - box.top}px`);
  }

  protected jump(): void {
    goToSection(this.document, 'experience');
  }
}
