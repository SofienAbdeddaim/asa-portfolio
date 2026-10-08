import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@asa/shared';
import site from '../../site.config.json';
import { LocaleService } from './locale.service';

const OG_LOCALES: Record<Locale, string> = { en: 'en_GB', fr: 'fr_FR', ar: 'ar_AR' };
/** Marks head elements this service owns, so the next page can replace them. */
const MARKER = 'data-seo';

export interface SeoInput {
  title: string;
  description: string;
  /** Path below the locale, such as `''` (home), `/blog` or `/blog/my-post`. */
  path: string;
  type?: 'website' | 'article';
  /** Absolute URL or a site path such as `/media/photo.webp`. */
  image?: string | null | undefined;
  publishedTime?: string | undefined;
  tags?: readonly string[] | undefined;
  /** Structured data (schema.org) rendered as JSON-LD. */
  jsonLd?: Record<string, unknown> | undefined;
  noindex?: boolean | undefined;
}

/** Absolute URL of a site path, based on the configured site address. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${site.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** `/en`, `/en/blog`... for a locale and a path below it. */
export const localizedPath = (locale: Locale, path: string): string => `/${locale}${path}`;

/** JSON that is safe inside a `<script>`: `<` is escaped so `</script>` cannot end the block. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, '');
}

/**
 * Per-page metadata: description, canonical URL, `hreflang` alternates for every language,
 * Open Graph and Twitter cards, and JSON-LD. It runs during prerendering, so crawlers and link
 * previews get everything in the static HTML.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly locale = inject(LocaleService);

  update(input: SeoInput): void {
    const locale = this.locale.locale();
    const url = absoluteUrl(localizedPath(locale, input.path));
    const type = input.type ?? 'website';
    const description = input.description.slice(0, 300);
    const image = input.image ? absoluteUrl(input.image) : null;

    // Everything added for the previous page goes first.
    this.document.head
      .querySelectorAll(`[${MARKER}]`)
      .forEach((node) => node.parentNode?.removeChild(node));

    this.set('name', 'description', description);
    this.set('name', 'robots', input.noindex ? 'noindex, nofollow' : 'index, follow');
    this.set('property', 'og:site_name', site.name);
    this.set('property', 'og:type', type);
    this.set('property', 'og:title', input.title);
    this.set('property', 'og:description', description);
    this.set('property', 'og:url', url);
    this.set('property', 'og:locale', OG_LOCALES[locale]);
    this.set('property', 'og:image', image);
    this.set('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    this.set('name', 'twitter:title', input.title);
    this.set('name', 'twitter:description', description);
    this.set('name', 'twitter:image', image);
    this.set(
      'property',
      'article:published_time',
      type === 'article' ? (input.publishedTime ?? null) : null,
    );

    this.link('canonical', url);
    for (const code of LOCALES) {
      this.link('alternate', absoluteUrl(localizedPath(code, input.path)), code);
      if (code !== locale) this.extra('og:locale:alternate', OG_LOCALES[code]);
    }
    this.link('alternate', absoluteUrl(localizedPath(DEFAULT_LOCALE, input.path)), 'x-default');
    for (const tag of input.tags ?? []) this.extra('article:tag', tag);

    if (input.jsonLd) {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(MARKER, '');
      script.textContent = safeJson({ '@context': 'https://schema.org', ...input.jsonLd });
      this.document.head.appendChild(script);
    }
  }

  /** Sets a single-valued meta tag, or removes it when there is no content. */
  private set(attribute: 'name' | 'property', key: string, content: string | null): void {
    const selector = `${attribute}="${key}"`;
    if (content === null) this.meta.removeTag(selector);
    else this.meta.updateTag({ [attribute]: key, content }, selector);
  }

  /** A repeatable `property` tag (several can exist at once). */
  private extra(property: string, content: string): void {
    const element = this.meta.addTag({ property, content }, true);
    element?.setAttribute(MARKER, '');
  }

  private link(rel: string, href: string, hreflang?: string): void {
    const element = this.document.createElement('link');
    element.rel = rel;
    element.href = href;
    if (hreflang) element.hreflang = hreflang;
    element.setAttribute(MARKER, '');
    this.document.head.appendChild(element);
  }
}
