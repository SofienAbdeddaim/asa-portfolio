import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContentStore } from '../core/content.store';
import { LocaleService } from '../core/locale.service';
import { ScrollSpy } from '../core/sections';
import { About } from '../sections/about';
import { Contact } from '../sections/contact';
import { Experience } from '../sections/experience';
import { Hero } from '../sections/hero';
import { Playground } from '../sections/playground';
import { Projects } from '../sections/projects';
import { Skills } from '../sections/skills';
import { Testimonials } from '../sections/testimonials';
import { Skeleton } from '../shared/ui/skeleton';

/** The whole portfolio: one scrolling timeline of sections, rendered from the content store. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    Skeleton,
    Hero,
    About,
    Experience,
    Skills,
    Projects,
    Playground,
    Testimonials,
    Contact,
  ],
  template: `
    @if (store.source() === 'stale') {
      <p
        role="status"
        class="container-page mt-4 rounded-xl border-[3px] border-ink bg-sun px-4 py-3 text-sm font-semibold text-on-color"
      >
        {{ 'status.stale' | transloco }}
      </p>
    }

    @if (content(); as c) {
      <app-hero [profile]="c.profile" [locale]="locale.locale()" [tags]="tags()" />
      <app-about
        [profile]="c.profile"
        [education]="c.education"
        [certificates]="c.certificates"
        [locale]="locale.locale()"
      />
      @if (c.experiences.length) {
        <app-experience [items]="c.experiences" [locale]="locale.locale()" />
      }
      @if (c.skills.length) {
        <app-skills [groups]="c.skills" [locale]="locale.locale()" />
      }
      @if (c.projects.length) {
        <app-projects [projects]="c.projects" [locale]="locale.locale()" />
      }
      <app-playground [names]="playNames()" />
      @if (c.testimonials.length) {
        <app-testimonials [items]="c.testimonials" [locale]="locale.locale()" />
      }
      <app-contact [profile]="c.profile" />
    } @else {
      <div class="container-page space-y-6 pt-16" aria-busy="true">
        <div appSkeleton class="h-10 w-48"></div>
        <div appSkeleton class="h-40 w-full max-w-2xl"></div>
        <div appSkeleton class="h-6 w-full max-w-xl"></div>
        <div appSkeleton class="h-6 w-2/3 max-w-lg"></div>
      </div>
    }
  `,
})
export class HomePage implements OnDestroy {
  protected readonly store = inject(ContentStore);
  protected readonly locale = inject(LocaleService);
  private readonly spy = inject(ScrollSpy);

  protected readonly content = this.store.content;
  protected readonly tags = computed(() => [
    ...new Set((this.content()?.skills ?? []).flatMap((group) => group.items.map((i) => i.name))),
  ]);

  protected readonly playNames = computed(() => this.tags().slice(0, 12));

  constructor() {
    void this.store.load();
    afterNextRender(() => this.spy.observe());
  }

  ngOnDestroy(): void {
    this.spy.stop();
  }
}
