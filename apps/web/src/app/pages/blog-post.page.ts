import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { resolveLocalized, type Locale } from '@asa/shared';
import { ContentStore } from '../core/content.store';
import { formatDate } from '../core/locale';
import { LocaleService } from '../core/locale.service';
import { markdownToText, renderMarkdown } from '../core/markdown';
import { SeoService, absoluteUrl, localizedPath } from '../core/seo.service';
import { readingMinutes } from './blog-list.page';

@Component({
  selector: 'app-blog-post-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="container-page py-14">
      <a
        class="inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4"
        [routerLink]="['/', locale.locale(), 'blog']"
      >
        ← {{ 'blog.back' | transloco }}
      </a>

      @if (post(); as post) {
        <article class="mx-auto mt-6 max-w-3xl">
          <header>
            <p class="text-sm font-semibold text-muted">
              @if (post.publishedAt) {
                <time [attr.datetime]="post.publishedAt">{{ date() }}</time> ·
              }
              {{ 'blog.readingTime' | transloco: { minutes: minutes() } }}
            </p>
            <h1
              class="mt-3 text-[clamp(2.25rem,6vw,4rem)]"
              [attr.lang]="titleLocale()"
              [attr.dir]="titleLocale() === 'ar' ? 'rtl' : 'ltr'"
            >
              {{ title() }}
            </h1>
            @if (post.tags.length) {
              <ul class="mt-5 flex flex-wrap gap-2">
                @for (tag of post.tags; track tag) {
                  <li
                    class="chip ltr-island text-sm"
                    style="--chip-bg: var(--c-sun); --chip-fg: var(--on-color)"
                  >
                    {{ tag }}
                  </li>
                }
              </ul>
            }
          </header>

          @if (post.coverUrl) {
            <img
              class="sticker mt-8 aspect-video w-full object-cover"
              style="--shadow: 8px"
              [src]="post.coverUrl"
              alt=""
              decoding="async"
            />
          }

          @if (fallback()) {
            <p
              class="mt-8 rounded-xl border-[3px] border-ink bg-surface-2 px-4 py-3 text-sm font-semibold"
              role="note"
            >
              {{ 'blog.fallbackNote' | transloco }}
            </p>
          }

          <div
            class="markdown mt-8 text-lg"
            [attr.lang]="bodyLocale()"
            [attr.dir]="bodyLocale() === 'ar' ? 'rtl' : 'ltr'"
            [innerHTML]="html()"
          ></div>
        </article>
      } @else if (store.content() !== null) {
        <div class="mx-auto mt-10 max-w-xl">
          <h1 class="text-4xl">{{ 'blog.notFoundTitle' | transloco }}</h1>
          <p class="mt-4 text-lg">{{ 'blog.notFoundBody' | transloco }}</p>
        </div>
      }
    </div>
  `,
})
export class BlogPostPage {
  /** Route parameter `:slug`. */
  readonly slug = input<string>();

  protected readonly store = inject(ContentStore);
  protected readonly locale = inject(LocaleService);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  protected readonly post = computed(() =>
    this.store.posts().find((entry) => entry.slug === this.slug()),
  );

  private readonly resolved = (field: { en: string } & Partial<Record<Locale, string>>): Locale =>
    field[this.locale.locale()]?.trim() ? this.locale.locale() : 'en';

  protected readonly titleLocale = computed(() => {
    const post = this.post();
    return post ? this.resolved(post.title) : this.locale.locale();
  });
  protected readonly bodyLocale = computed(() => {
    const post = this.post();
    return post ? this.resolved(post.body) : this.locale.locale();
  });
  /** True when the body is shown in English because it has no translation yet. */
  protected readonly fallback = computed(() => this.bodyLocale() !== this.locale.locale());

  protected readonly title = computed(() => {
    const post = this.post();
    return post ? resolveLocalized(post.title, this.locale.locale()) : '';
  });
  private readonly markdown = computed(() => {
    const post = this.post();
    return post ? resolveLocalized(post.body, this.locale.locale()) : '';
  });
  protected readonly html = computed(() => renderMarkdown(this.markdown()));
  protected readonly minutes = computed(() => readingMinutes(this.markdown()));
  protected readonly date = computed(() => {
    const post = this.post();
    return post
      ? formatDate(post.publishedAt ?? post.createdAt, this.locale.locale(), { dateStyle: 'long' })
      : '';
  });

  constructor() {
    void this.store.load();
    effect(() => {
      this.locale.revision();
      const post = this.post();
      if (!post) {
        this.seo.update({
          title: this.transloco.translate('blog.notFoundTitle'),
          description: '',
          path: `/blog/${this.slug() ?? ''}`,
          noindex: true,
        });
        return;
      }
      const locale = this.locale.locale();
      const author = this.store.profile()?.fullName;
      const description =
        markdownToText(resolveLocalized(post.excerpt, locale)) ||
        markdownToText(this.markdown()).slice(0, 200);
      const path = `/blog/${post.slug}`;
      this.seo.update({
        title: this.title(),
        description,
        path,
        type: 'article',
        image: post.coverUrl,
        publishedTime: post.publishedAt,
        tags: post.tags,
        jsonLd: {
          '@type': 'BlogPosting',
          headline: this.title(),
          description,
          inLanguage: this.bodyLocale(),
          datePublished: post.publishedAt ?? post.createdAt,
          dateModified: post.updatedAt,
          mainEntityOfPage: absoluteUrl(localizedPath(locale, path)),
          ...(post.coverUrl ? { image: absoluteUrl(post.coverUrl) } : {}),
          ...(author ? { author: { '@type': 'Person', name: author } } : {}),
        },
      });
    });
  }
}
