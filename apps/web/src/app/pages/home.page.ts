import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContentStore } from '../core/content.store';
import { formatDate, formatNumber } from '../core/locale';
import { LocaleService } from '../core/locale.service';
import { Button } from '../shared/ui/button';
import { Icon } from '../shared/ui/icon';
import { Skeleton } from '../shared/ui/skeleton';

/** Foundations preview. The timeline-shaped home page replaces this in the next phase. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Button, Icon, Skeleton],
  template: `
    @if (store.source() === 'stale') {
      <p
        role="status"
        class="mb-8 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted"
      >
        {{ 'status.stale' | transloco }}
      </p>
    }

    <section class="reveal max-w-3xl">
      <p class="text-sm font-medium text-accent">{{ 'home.eyebrow' | transloco }}</p>
      <h1 class="mt-3 text-4xl sm:text-5xl">{{ 'home.heading' | transloco }}</h1>
      <p class="mt-6 text-lg text-muted">{{ 'home.lead' | transloco }}</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <button type="button" appButton>
          {{ 'home.primary' | transloco }}
          <app-icon name="arrow" [mirror]="true" />
        </button>
        <button type="button" appButton variant="outline">
          {{ 'home.secondary' | transloco }}
        </button>
      </div>
    </section>

    <section class="mt-16 grid gap-6 md:grid-cols-3">
      <article class="rounded-card border border-border bg-surface p-6">
        <h2 class="text-lg">{{ 'home.direction' | transloco }}</h2>
        <p class="mt-3 text-muted">
          {{ (locale.direction() === 'rtl' ? 'home.dirRtl' : 'home.dirLtr') | transloco }}
        </p>
        <p class="mt-2 font-mono text-sm text-muted">
          <code>dir="{{ locale.direction() }}"</code>
        </p>
      </article>

      <article class="rounded-card border border-border bg-surface p-6">
        <h2 class="text-lg">{{ 'home.formatting' | transloco }}</h2>
        <dl class="mt-3 space-y-1 text-muted">
          <div class="flex justify-between gap-4">
            <dt>{{ 'home.dateSample' | transloco }}</dt>
            <dd>{{ sampleDate() }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt>{{ 'home.numberSample' | transloco }}</dt>
            <dd>{{ sampleNumber() }}</dd>
          </div>
        </dl>
      </article>

      <article class="rounded-card border border-border bg-surface p-6">
        <h2 class="text-lg">{{ 'home.loading' | transloco }}</h2>
        <div class="mt-4 space-y-3">
          <div appSkeleton class="h-4 w-3/4"></div>
          <div appSkeleton class="h-4 w-full"></div>
          <div appSkeleton class="h-4 w-1/2"></div>
        </div>
      </article>
    </section>
  `,
})
export class HomePage {
  protected readonly locale = inject(LocaleService);
  protected readonly store = inject(ContentStore);

  private readonly sample = signal(new Date(Date.UTC(2026, 2, 14)));
  protected readonly sampleDate = computed(() =>
    formatDate(this.sample(), this.locale.locale(), { dateStyle: 'long' }),
  );
  protected readonly sampleNumber = computed(() => formatNumber(1234567.89, this.locale.locale()));

  constructor() {
    void this.store.load();
  }
}
