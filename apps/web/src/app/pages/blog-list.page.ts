import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { resolveLocalized, type BlogPost } from '@asa/shared';
import { ContentStore } from '../core/content.store';
import { formatDate } from '../core/locale';
import { LocaleService } from '../core/locale.service';
import { LocalizedPipe } from '../core/localized.pipe';
import { markdownToText } from '../core/markdown-text';
import { Reveal } from '../core/reveal.directive';
import { SeoService } from '../core/seo.service';
import { Skeleton } from '../shared/ui/skeleton';

/** Words per minute used for the reading-time estimate. */
const WORDS_PER_MINUTE = 200;

export function readingMinutes(text: string): number {
  const words = markdownToText(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

@Component({
  selector: 'app-blog-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, LocalizedPipe, Reveal, Skeleton],
  template: `
    <section class="container-page py-14" aria-labelledby="blog-title">
      <p class="eyebrow">{{ 'blog.eyebrow' | transloco }}</p>
      <h1 id="blog-title" class="section-title mt-3">{{ 'blog.title' | transloco }}</h1>
      <p class="mt-3 max-w-2xl text-lg text-muted">{{ 'blog.lead' | transloco }}</p>

      @if (store.content() === null) {
        <div class="mt-10 grid gap-6" aria-busy="true">
          <div appSkeleton class="h-40"></div>
          <div appSkeleton class="h-40"></div>
        </div>
      } @else if (store.posts().length === 0) {
        <p class="card mt-10 p-8 text-lg text-muted">{{ 'blog.empty' | transloco }}</p>
      } @else {
        @if (tags().length > 1) {
          <div
            class="mt-8 flex flex-wrap items-center gap-2"
            role="group"
            [attr.aria-label]="'blog.filter' | transloco"
          >
            <button
              type="button"
              class="chip min-h-8"
              [attr.aria-pressed]="active() === null"
              (click)="active.set(null)"
            >
              {{ 'blog.allTags' | transloco }}
            </button>
            @for (tag of tags(); track tag) {
              <button
                type="button"
                class="chip min-h-8"
                [attr.aria-pressed]="active() === tag"
                (click)="active.set(tag)"
              >
                {{ tag }}
              </button>
            }
          </div>
        }

        <ul class="mt-10 grid list-none gap-8 md:grid-cols-2">
          @for (post of visible(); track post.id; let i = $index) {
            <li [appReveal]="(i % 2) * 100">
              <article class="card card-hover relative flex h-full flex-col overflow-hidden">
                @if (post.coverUrl) {
                  <img
                    class="aspect-video w-full border-b border-line object-cover"
                    [src]="post.coverUrl"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                }
                <div class="flex flex-1 flex-col p-6">
                  <p class="font-mono text-xs text-muted">
                    @if (post.publishedAt) {
                      <time [attr.datetime]="post.publishedAt">{{ date(post) }}</time> ·
                    }
                    {{ 'blog.readingTime' | transloco: { minutes: minutes(post) } }}
                  </p>
                  <h2
                    class="mt-2 text-2xl"
                    [attr.lang]="lang(post.title)"
                    [attr.dir]="dir(post.title)"
                  >
                    <a
                      class="after:absolute after:inset-0"
                      [routerLink]="['/', locale.locale(), 'blog', post.slug]"
                      >{{ post.title | localized: locale.locale() }}</a
                    >
                  </h2>
                  <p
                    class="mt-3 text-muted"
                    [attr.lang]="lang(post.excerpt)"
                    [attr.dir]="dir(post.excerpt)"
                  >
                    {{ post.excerpt | localized: locale.locale() }}
                  </p>
                  @if (post.tags.length) {
                    <ul class="mt-auto flex flex-wrap gap-2 pt-5" aria-hidden="true">
                      @for (tag of post.tags; track tag) {
                        <li class="chip ltr-island">
                          {{ tag }}
                        </li>
                      }
                    </ul>
                  }
                </div>
              </article>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class BlogListPage {
  protected readonly store = inject(ContentStore);
  protected readonly locale = inject(LocaleService);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  protected readonly active = signal<string | null>(null);
  protected readonly tags = computed(() => [
    ...new Set(this.store.posts().flatMap((post) => post.tags)),
  ]);
  protected readonly visible = computed(() => {
    const tag = this.active();
    return tag ? this.store.posts().filter((post) => post.tags.includes(tag)) : this.store.posts();
  });

  constructor() {
    void this.store.load();
    effect(() => {
      this.locale.revision();
      const t = (key: string) => this.transloco.translate(key, {}, this.locale.locale());
      this.seo.update({
        title: `${t('blog.title')} · ${this.store.profile()?.fullName ?? t('app.brand')}`,
        description: t('blog.lead'),
        path: '/blog',
        jsonLd: { '@type': 'Blog', name: t('blog.title'), inLanguage: this.locale.locale() },
      });
    });
  }

  protected minutes(post: BlogPost): number {
    return readingMinutes(resolveLocalized(post.body, this.locale.locale()));
  }

  protected date(post: BlogPost): string {
    return formatDate(post.publishedAt ?? post.createdAt, this.locale.locale(), {
      dateStyle: 'long',
    });
  }

  /** The language a (possibly fallen-back) text is actually in, so assistive tech reads it right. */
  protected lang(field: BlogPost['title']): string {
    return field[this.locale.locale()]?.trim() ? this.locale.locale() : 'en';
  }

  protected dir(field: BlogPost['title']): 'rtl' | 'ltr' {
    return this.lang(field) === 'ar' ? 'rtl' : 'ltr';
  }
}
