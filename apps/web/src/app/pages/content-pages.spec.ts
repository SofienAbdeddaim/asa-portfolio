import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter, type Routes } from '@angular/router';
import type { Locale } from '@asa/shared';
import { settle } from '../../testing/admin-helpers';
import { CONTENT_FIXTURE } from '../../testing/content.fixture';
import { ContentStore } from '../core/content.store';
import { provideI18n } from '../core/i18n';
import { LocaleService } from '../core/locale.service';
import { PageTitleStrategy } from '../core/page-title.strategy';
import { cvTitle, homeTitle, postTitle } from '../core/page-titles';
import { routes } from '../app.routes';
import { BlogListPage, readingMinutes } from './blog-list.page';
import { BlogPostPage } from './blog-post.page';
import { CvPage } from './cv.page';

function configure(extra: Routes = []) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(extra.length ? extra : routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideI18n(),
      { provide: TitleStrategy, useClass: PageTitleStrategy },
    ],
  });
  TestBed.inject(ContentStore).seed(CONTENT_FIXTURE);
}

async function render<T>(component: Type<T>, locale: Locale, inputs: Record<string, unknown> = {}) {
  configure();
  await TestBed.inject(LocaleService).activate(locale);
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

describe('BlogListPage', () => {
  it('lists published posts with dates, reading time and a link to each', async () => {
    const { el } = await render(BlogListPage, 'en');
    expect(el.querySelector('h1')?.textContent).toBe('Notes and writing');
    const cards = [...el.querySelectorAll('article')];
    expect(cards.map((c) => c.querySelector('h2')?.textContent?.trim())).toEqual([
      'Hello, world',
      'English only',
    ]);
    expect(cards[0]!.querySelector('h2 a')?.getAttribute('href')).toBe('/en/blog/hello-world');
    expect(cards[0]!.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-02-10T09:00:00.000Z',
    );
    expect(cards[0]!.querySelector('time')?.textContent).toBe('10 February 2026');
    expect(cards[0]!.textContent).toContain('1 min read');
    expect(cards[0]!.querySelector('img')?.getAttribute('src')).toBe('/media/cover.webp');
    expect(cards[1]!.querySelector('img')).toBeNull();
  });

  it('shows each language, and marks text that fell back to English', async () => {
    const { el } = await render(BlogListPage, 'ar');
    const [first, second] = [...el.querySelectorAll('article h2')];
    expect(first?.textContent?.trim()).toBe('مرحبا بالعالم');
    expect(first?.getAttribute('lang')).toBe('ar');
    expect(first?.getAttribute('dir')).toBe('rtl');
    expect(second?.textContent?.trim()).toBe('English only');
    expect(second?.getAttribute('lang')).toBe('en');
    expect(second?.getAttribute('dir')).toBe('ltr');
    expect(el.querySelector('article a')?.getAttribute('href')).toBe('/ar/blog/hello-world');
  });

  it('filters by tag and can show everything again', async () => {
    const { fixture, el } = await render(BlogListPage, 'en');
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('[role="group"] button')];
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['All', 'angular', 'rtl']);
    expect(buttons()[0]!.getAttribute('aria-pressed')).toBe('true');

    buttons()[2]!.click();
    await settle(fixture);
    expect(el.querySelectorAll('article')).toHaveLength(1);
    expect(buttons()[2]!.getAttribute('aria-pressed')).toBe('true');
    buttons()[0]!.click();
    await settle(fixture);
    expect(el.querySelectorAll('article')).toHaveLength(2);
  });

  it('is welcoming when there are no posts yet', async () => {
    configure();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    TestBed.inject(ContentStore).seed({ ...CONTENT_FIXTURE, posts: [] });
    await TestBed.inject(LocaleService).activate('en');
    const fixture = TestBed.createComponent(BlogListPage);
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('No posts yet');
    expect(fixture.nativeElement.querySelector('[role="group"]')).toBeNull();
  });

  it('sets the page metadata', async () => {
    await render(BlogListPage, 'fr');
    expect(meta('meta[property="og:url"]')).toBe('http://localhost:4200/fr/blog');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'http://localhost:4200/fr/blog',
    );
    expect(
      document.head.querySelector('script[type="application/ld+json"]')?.textContent,
    ).toContain('"@type":"Blog"');
  });

  it('estimates reading time from the text only', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(450))).toBe(2);
    expect(readingMinutes('![img](/a.png) ```code block here``` ' + 'word '.repeat(200))).toBe(1);
  });
});

describe('BlogPostPage', () => {
  it('renders the post with sanitized Markdown, tags, cover and metadata', async () => {
    const { el } = await render(BlogPostPage, 'en', { slug: 'hello-world' });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Hello, world');
    const body = el.querySelector('.markdown')!;
    expect(body.querySelector('h1')?.textContent).toBe('Hello');
    expect(body.querySelector('strong')?.textContent).toBe('bold');
    expect(body.innerHTML).not.toContain('<script');
    const link = body.querySelector('a')!;
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect([...el.querySelectorAll('header li')].map((li) => li.textContent?.trim())).toEqual([
      'angular',
      'rtl',
    ]);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/media/cover.webp');
    expect(el.querySelector('[role="note"]')).toBeNull();
    expect(el.querySelector('a[href="/en/blog"]')).not.toBeNull();
  });

  it('describes itself for search engines and link previews', async () => {
    await render(BlogPostPage, 'en', { slug: 'hello-world' });
    expect(meta('meta[name="description"]')).toBe('A first post.');
    expect(meta('meta[property="og:type"]')).toBe('article');
    expect(meta('meta[property="og:title"]')).toBe('Hello, world');
    expect(meta('meta[property="og:image"]')).toBe('http://localhost:4200/media/cover.webp');
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta('meta[property="article:published_time"]')).toBe('2026-02-10T09:00:00.000Z');
    expect(meta('meta[name="robots"]')).toBe('index, follow');
    const alternates = [...document.head.querySelectorAll('link[rel="alternate"]')].map(
      (l) => `${l.getAttribute('hreflang')} ${l.getAttribute('href')}`,
    );
    expect(alternates).toEqual([
      'fr http://localhost:4200/fr/blog/hello-world',
      'en http://localhost:4200/en/blog/hello-world',
      'ar http://localhost:4200/ar/blog/hello-world',
      'x-default http://localhost:4200/en/blog/hello-world',
    ]);
    const jsonLd = JSON.parse(
      document.head.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(jsonLd).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'Hello, world',
      inLanguage: 'en',
      author: { name: 'Alex Placeholder' },
    });
    expect(jsonLd.mainEntityOfPage).toBe('http://localhost:4200/en/blog/hello-world');
  });

  it('replaces the previous page’s tags instead of piling them up', async () => {
    const first = await render(BlogPostPage, 'en', { slug: 'hello-world' });
    first.fixture.componentRef.setInput('slug', 'english-only');
    await settle(first.fixture);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="alternate"]')).toHaveLength(4);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(meta('meta[property="og:image"]')).toBeUndefined();
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(meta('meta[name="twitter:card"]')).toBe('summary');
    expect(document.head.querySelectorAll('meta[property="article:tag"]')).toHaveLength(1);
  });

  it('renders in Arabic with right-to-left text', async () => {
    const { el } = await render(BlogPostPage, 'ar', { slug: 'hello-world' });
    const body = el.querySelector('.markdown')!;
    expect(body.getAttribute('lang')).toBe('ar');
    expect(body.getAttribute('dir')).toBe('rtl');
    expect(body.querySelector('strong')?.textContent).toBe('تجريبي');
    expect(meta('meta[property="og:locale"]')).toBe('ar_AR');
    expect(el.querySelector('a[href="/ar/blog"]')).not.toBeNull();
  });

  it('falls back to English with a notice, and marks the language of the text', async () => {
    const { el } = await render(BlogPostPage, 'fr', { slug: 'english-only' });
    expect(el.querySelector('[role="note"]')?.textContent).toContain('pas encore traduit');
    expect(el.querySelector('.markdown')?.getAttribute('lang')).toBe('en');
    expect(el.querySelector('h1')?.getAttribute('lang')).toBe('en');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('English only');
  });

  it('handles an unknown or unpublished slug without indexing it', async () => {
    const { el } = await render(BlogPostPage, 'en', { slug: 'nope' });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Post not found');
    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow');
    expect(el.querySelector('article')).toBeNull();
  });
});

describe('CvPage', () => {
  it('lays out the whole résumé from the same content, in the active language', async () => {
    const { el } = await render(CvPage, 'en');
    const text = el.textContent ?? '';
    expect(el.querySelector('h1')?.textContent).toBe('Alex Placeholder');
    expect(el.querySelector('.cv-headline')?.textContent).toBe('Senior Software Engineer');
    expect([...el.querySelectorAll('.cv h2')].map((h) => h.textContent)).toEqual([
      'Profile',
      'Experience',
      'Education',
      'Skills',
      'Certificates',
      'Selected projects',
    ]);
    expect(text).toContain('Lead Engineer · Example Corp');
    expect(text).toContain('Jan 2021 – Present');
    expect(text).toContain('Mar 2018 – Dec 2020');
    expect(text).toContain('First bullet');
    expect(text).toContain('Master of Examples · Example University');
    expect(text).toContain('2012 – 2016');
    expect(text).toContain('Angular · CSS');
    expect(text).toContain('Certified Example Builder · Example Institute · 2022');
    expect(text).toContain('Example project');
    expect(el.querySelector('a[href="mailto:hello@example.com"]')).not.toBeNull();
    expect(text).toContain('github.com/example');
    expect(text).not.toContain('https://github.com/example');
  });

  it('is right-to-left in Arabic and keeps Latin technology names left-to-right', async () => {
    const { el } = await render(CvPage, 'ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(el.querySelector('.cv-headline')?.textContent).toBe('مهندس برمجيات أول');
    expect([...el.querySelectorAll('.cv h2')][1]?.textContent).toBe('الخبرة');
    expect(el.textContent).toContain('الآن');
    expect(el.querySelector('.cv-skills dd')?.classList.contains('ltr-island')).toBe(true);
  });

  it('opens the browser print dialog', async () => {
    const { fixture, el } = await render(CvPage, 'en');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    el.querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    expect(print).toHaveBeenCalledOnce();
    expect(el.querySelector('.no-print')).not.toBeNull();
    print.mockRestore();
  });

  it('sets its metadata and shows a placeholder while content loads', async () => {
    await render(CvPage, 'fr');
    expect(meta('meta[property="og:title"]')).toBe('Alex Placeholder · CV');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'http://localhost:4200/fr/cv',
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    await TestBed.inject(LocaleService).activate('en');
    const fixture = TestBed.createComponent(CvPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('page titles', () => {
  @Component({ template: '' })
  class Blank {}

  const titled: Routes = [
    {
      path: ':lang',
      children: [
        { path: '', title: homeTitle, data: { fullTitle: true }, component: Blank },
        { path: 'blog', data: { titleKey: 'blog.title' }, component: Blank },
        { path: 'blog/:slug', title: postTitle, data: { fullTitle: true }, component: Blank },
        { path: 'cv', title: cvTitle, data: { fullTitle: true }, component: Blank },
        { path: 'plain', title: 'Plain page', component: Blank },
      ],
    },
  ];

  async function titleAt(url: string, locale: Locale = 'en') {
    configure(titled);
    await TestBed.inject(LocaleService).activate(locale);
    await TestBed.inject(Router).navigateByUrl(url);
    return TestBed.inject(Title).getTitle();
  }

  it('uses content for the home, post and CV titles, and translations for the rest', async () => {
    expect(await titleAt('/en')).toBe('Alex Placeholder · Senior Software Engineer');
    TestBed.resetTestingModule();
    expect(await titleAt('/ar', 'ar')).toBe('Alex Placeholder · مهندس برمجيات أول');
    TestBed.resetTestingModule();
    expect(await titleAt('/en/blog/hello-world')).toBe('Hello, world · Alex Placeholder');
    TestBed.resetTestingModule();
    expect(await titleAt('/fr/blog/hello-world', 'fr')).toBe('Bonjour le monde · Alex Placeholder');
    TestBed.resetTestingModule();
    expect(await titleAt('/en/blog/missing')).toBe('Blog · Alex Placeholder');
    TestBed.resetTestingModule();
    expect(await titleAt('/en/cv')).toBe('Alex Placeholder · CV');
    TestBed.resetTestingModule();
    expect(await titleAt('/fr/blog', 'fr')).toBe('Notes et articles · ASA');
    TestBed.resetTestingModule();
    expect(await titleAt('/en/plain')).toBe('Plain page · ASA');
  });
});
