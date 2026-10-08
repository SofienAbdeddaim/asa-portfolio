import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { CONTENT_FIXTURE } from '../../testing/content.fixture';
import { ContentStore, LIVE_URL, SNAPSHOT_URL } from './content.store';
import { provideI18n } from './i18n';
import { LocaleService } from './locale.service';
import { markdownToText, renderMarkdown, useServerPurifier } from './markdown';
import { SeoService, absoluteUrl, localizedPath, safeJson } from './seo.service';
import { HttpTestingController } from '@angular/common/http/testing';

describe('SeoService helpers', () => {
  it('builds absolute URLs from the configured site address', () => {
    expect(absoluteUrl('/en/blog')).toBe('http://localhost:4200/en/blog');
    expect(absoluteUrl('media/a.webp')).toBe('http://localhost:4200/media/a.webp');
    expect(absoluteUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(localizedPath('ar', '/cv')).toBe('/ar/cv');
    expect(localizedPath('fr', '')).toBe('/fr');
  });

  it('escapes anything that could close a script block', () => {
    const json = safeJson({ headline: '</script><script>alert(1)</script>', line: 'a\u2028b' });
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script>');
    expect(JSON.parse(json).headline).toBe('</script><script>alert(1)</script>');
  });
});

describe('SeoService', () => {
  async function seo(locale: 'en' | 'fr' | 'ar' = 'en') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    await TestBed.inject(LocaleService).activate(locale);
    return TestBed.inject(SeoService);
  }

  it('writes a complete, localized set of tags for a page', async () => {
    (await seo('fr')).update({
      title: 'Titre',
      description: 'Description',
      path: '/cv',
      image: '/media/a.webp',
    });
    const content = (selector: string) =>
      document.head.querySelector(selector)?.getAttribute('content');
    expect(content('meta[name="description"]')).toBe('Description');
    expect(content('meta[property="og:locale"]')).toBe('fr_FR');
    expect(
      [...document.head.querySelectorAll('meta[property="og:locale:alternate"]')].map((m) =>
        m.getAttribute('content'),
      ),
    ).toEqual(['en_GB', 'ar_AR']);
    expect(content('meta[property="og:url"]')).toBe('http://localhost:4200/fr/cv');
    expect(content('meta[name="twitter:image"]')).toBe('http://localhost:4200/media/a.webp');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'http://localhost:4200/fr/cv',
    );
  });

  it('truncates long descriptions and can mark a page as not indexable', async () => {
    (await seo()).update({ title: 'T', description: 'x'.repeat(500), path: '', noindex: true });
    expect(
      document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toHaveLength(300);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('never lets structured data break out of its script tag', async () => {
    (await seo()).update({
      title: 'T',
      description: 'D',
      path: '',
      jsonLd: { '@type': 'Person', name: '</script><img src=x onerror=alert(1)>' },
    });
    const script = document.head.querySelector('script[type="application/ld+json"]')!;
    expect(script.textContent).not.toContain('</script>');
    expect(JSON.parse(script.textContent!).name).toContain('onerror');
    expect(document.head.querySelector('img')).toBeNull();
  });
});

describe('Markdown', () => {
  it('makes plain text for descriptions', () => {
    expect(
      markdownToText(
        '# Title\n\nSome **bold** [link](https://x.y) and `code`.\n\n```js\nignored()\n```\n![img](/a.png)',
      ),
    ).toBe('Title Some bold link and code .');
  });

  it('sanitizes on the server too, with a jsdom-backed DOMPurify', () => {
    const dom = new JSDOM('');
    const purifier = createDOMPurify(dom.window as never);
    // A browser DOMPurify exists in tests; the server one must produce equally safe output.
    useServerPurifier(purifier);
    const html = renderMarkdown(
      '**ok** <script>alert(1)</script><img src=x onerror=alert(2)>[a](https://example.com)',
    );
    expect(html).toContain('<strong>ok</strong>');
    expect(html).not.toMatch(/<script|onerror/);
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('ContentStore snapshot loading', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return { store: TestBed.inject(ContentStore), http: TestBed.inject(HttpTestingController) };
  }

  it('serves pages from the snapshot without ever touching the API', async () => {
    const { store, http } = setup();
    const ready = store.ensureSnapshot();
    expect(store.ensureSnapshot()).toBe(ready); // one request, however many pages ask
    http.expectOne(SNAPSHOT_URL).flush(CONTENT_FIXTURE);
    await ready;
    expect(store.posts().map((p) => p.slug)).toEqual(['hello-world', 'english-only']);
    expect(store.profile()?.fullName).toBe('Alex Placeholder');
    http.expectNone(LIVE_URL);
  });

  it('copes with a missing snapshot', async () => {
    const { store, http } = setup();
    const ready = store.ensureSnapshot();
    http.expectOne(SNAPSHOT_URL).error(new ProgressEvent('error'));
    await ready;
    expect(store.content()).toBeNull();
    expect(store.posts()).toEqual([]);
    expect(store.profile()).toBeNull();
  });

  it('does not refetch a snapshot that is already installed', async () => {
    const { store, http } = setup();
    store.seed(CONTENT_FIXTURE);
    await store.ensureSnapshot();
    http.expectNone(SNAPSHOT_URL);
    expect(store.source()).toBe('snapshot');
  });
});
