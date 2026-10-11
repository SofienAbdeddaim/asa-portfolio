import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import type { Locale } from '@asa/shared';
import { CONTENT_FIXTURE } from '../../testing/content.fixture';
import { routes } from '../app.routes';
import { ContentStore } from '../core/content.store';
import { provideI18n } from '../core/i18n';
import { LocaleService } from '../core/locale.service';
import { LocalizedPipe } from '../core/localized.pipe';
import { SECTIONS, ScrollSpy } from '../core/sections';
import { HomePage } from '../pages/home.page';

async function render(locale: Locale) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideI18n(),
    ],
  });
  TestBed.inject(ContentStore).seed(CONTENT_FIXTURE);
  await TestBed.inject(LocaleService).activate(locale);
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('home page sections', () => {
  it('renders every section with a labelled heading', async () => {
    const { el } = await render('en');
    for (const { id } of SECTIONS) {
      const section = el.querySelector(`#${id}`);
      expect(section, id).not.toBeNull();
      const labelledBy = section!.getAttribute('aria-labelledby')!;
      expect(el.querySelector(`#${labelledBy}`)?.textContent?.trim().length).toBeGreaterThan(0);
    }
    expect(el.querySelectorAll('h1')).toHaveLength(1);
  });

  it('shows a loading skeleton, then nothing stale, until content exists', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    await TestBed.inject(LocaleService).activate('en');
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#hero-title')).toBeNull();
  });

  it('hero: availability label, name for assistive tech, and Latin names isolated as ltr', async () => {
    const { el } = await render('ar');
    expect(el.querySelector('app-hero p')?.textContent).toContain('توفّر محدود');
    // The animated lines are hidden from assistive tech; the name is read once, whole.
    expect(el.querySelector('#hero-title .sr-only')?.textContent).toBe('Alex Placeholder');
    expect(el.querySelectorAll('#hero-title [aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(el.querySelector('#hero-title [aria-label]')).toBeNull();
    const wordBoxes = el.querySelectorAll('#hero-title [dir="ltr"]');
    expect(wordBoxes).toHaveLength(2);
    expect([...wordBoxes].map((box) => box.textContent?.replace(/\s/g, ''))).toEqual([
      'Alex',
      'Placeholder',
    ]);
  });

  it('hero: key figures and the current role come from the experience', async () => {
    // With reduced motion the figures do not count up, so they show their final value at once.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { el } = await render('en');
    vi.unstubAllGlobals();
    const facts = [...el.querySelectorAll('app-hero dl > div')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(facts).toContain('roles 2');
    expect(facts).toContain('technologies 2');
    expect(el.querySelector('app-hero')?.textContent).toContain('at Example Corp');
  });

  it('falls back to English when a translation is missing', async () => {
    const { el } = await render('fr');
    // The fixture has no French summary for the first job, but does have a French bio.
    expect(el.querySelector('#about')?.textContent).toContain('Bio française.');
    expect(el.querySelector('#experience')?.textContent).toContain('Fake role.');
  });

  it('experience: period uses the locale and the present label, bullets become list items', async () => {
    const { el } = await render('en');
    const periods = [...el.querySelectorAll('#experience .timeline-item > p')].map((p) =>
      p.textContent?.trim(),
    );
    expect(periods[0]).toBe('Jan 2021 – Present');
    expect(periods[1]).toBe('Mar 2018 – Dec 2020');
    expect(el.querySelectorAll('#experience .timeline-item:first-child details li')).toHaveLength(
      3,
    );
    expect(el.querySelector('#experience')?.textContent).toContain('First bullet');
    expect(el.querySelector('#experience')?.textContent).not.toContain('* Second');

    TestBed.resetTestingModule();
    const arabic = await render('ar');
    expect(arabic.el.querySelector('#experience .timeline-item > p')?.textContent).toContain(
      'الآن',
    );
  });

  it('skills: an index row per group, strongest skills first, with no rating widget', async () => {
    const { el } = await render('en');
    const rows = el.querySelectorAll('#skills .skill-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('.skill-num')?.textContent?.trim()).toBe('01');
    expect(rows[0]?.querySelector('.skill-count')?.textContent?.trim()).toBe('2 skills');
    const items = [...el.querySelectorAll('#skills .skill-items li')];
    expect(items.map((li) => li.textContent?.trim())).toEqual(['Angular', 'CSS']);
    expect(items[0]?.classList).toContain('strong');
    expect(items[1]?.classList).not.toContain('strong');
    // Latin product names stay left-to-right inside Arabic text.
    expect(items[0]?.querySelector('.ltr-island')).not.toBeNull();
    expect(el.querySelector('.skills-lead')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '2 skills, one core craft: Frontend',
    );
    expect(el.querySelector('#skills [role="img"]')).toBeNull();

    TestBed.resetTestingModule();
    const arabic = await render('ar');
    expect(arabic.el.querySelector('#skills .skill-count')?.textContent?.trim()).toBe('مهارتان');
  });

  it('projects: external links are safe and announce the new tab', async () => {
    const { el } = await render('en');
    const links = [...el.querySelectorAll<HTMLAnchorElement>('#projects a')];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.getAttribute('aria-label')).toContain('opens in a new tab');
    }
    expect(el.querySelector('#projects img')?.getAttribute('alt')).toBe('A screenshot');
    expect(el.querySelector('#projects')?.textContent).toContain('Featured');
  });

  it('contact: mailto link, social links and copy-to-clipboard feedback', async () => {
    const { fixture, el } = await render('en');
    expect(el.querySelector<HTMLAnchorElement>('#contact a[href^="mailto:"]')?.href).toBe(
      'mailto:hello@example.com',
    );
    expect(el.querySelectorAll('#contact ul a')).toHaveLength(2);
    expect(el.querySelector('#contact ul a')?.textContent).toContain('GitHub');

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    el.querySelector<HTMLButtonElement>('#contact button')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('hello@example.com'));
    fixture.detectChanges();
    expect(el.querySelector('#contact [role="status"]')?.textContent).toContain('Email copied');
  });

  it('contact: stays quiet when the clipboard is blocked', async () => {
    const { fixture, el } = await render('en');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    el.querySelector<HTMLButtonElement>('#contact button')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    fixture.detectChanges();
    expect(el.querySelector('#contact [role="status"]')?.textContent?.trim()).toBe('');
  });

  it('keeps server-rendered content visible: nothing is hidden for reveal without IntersectionObserver', async () => {
    const { el } = await render('en');
    expect(el.querySelectorAll('[data-reveal]')).toHaveLength(0);
  });

  it('shows the cold-start notice when the API is asleep', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    TestBed.inject(ContentStore).seed(CONTENT_FIXTURE);
    (TestBed.inject(ContentStore) as unknown as { _source: { set(v: string): void } })._source.set(
      'stale',
    );
    await TestBed.inject(LocaleService).activate('en');
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Live data is waking up',
    );
  });
});

describe('LocalizedPipe', () => {
  const pipe = new LocalizedPipe();

  it('resolves the locale and falls back to English', () => {
    expect(pipe.transform({ en: 'Hi', fr: 'Salut' }, 'fr')).toBe('Salut');
    expect(pipe.transform({ en: 'Hi' }, 'ar')).toBe('Hi');
    expect(pipe.transform({ en: 'Hi', ar: '' }, 'ar')).toBe('Hi');
    expect(pipe.transform(undefined, 'en')).toBe('');
  });
});

describe('ScrollSpy', () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let callback: Callback;

  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('marks the topmost visible section as active and clears on stop', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    for (const { id } of SECTIONS) {
      const element = document.createElement('section');
      element.id = id;
      document.body.append(element);
    }
    const spy = TestBed.inject(ScrollSpy);
    spy.observe();
    callback([
      {
        isIntersecting: true,
        target: document.getElementById('skills')!,
        boundingClientRect: { top: 300 } as DOMRect,
      },
      {
        isIntersecting: true,
        target: document.getElementById('experience')!,
        boundingClientRect: { top: 100 } as DOMRect,
      },
      {
        isIntersecting: false,
        target: document.getElementById('about')!,
        boundingClientRect: { top: -50 } as DOMRect,
      },
    ]);
    expect(spy.active()).toBe('experience');
    spy.stop();
    expect(spy.active()).toBeNull();
    for (const { id } of SECTIONS) document.getElementById(id)?.remove();
  });
});

describe('translations stay in sync', () => {
  it('has the same keys in every language', async () => {
    const [en, fr, ar] = await Promise.all([
      import('../../i18n/en.json'),
      import('../../i18n/fr.json'),
      import('../../i18n/ar.json'),
    ]);
    const keys = (value: unknown, prefix = ''): string[] =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        typeof child === 'object' && child !== null
          ? keys(child, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    const reference = keys(en.default).sort();
    expect(keys(fr.default).sort()).toEqual(reference);
    expect(keys(ar.default).sort()).toEqual(reference);
    expect(reference.length).toBeGreaterThan(80);
  });

  it('activates every locale with real translations', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    const locale = TestBed.inject(LocaleService);
    for (const code of ['fr', 'en', 'ar'] as const) {
      await locale.activate(code);
      expect(transloco.translate('nav.contact')).not.toBe('nav.contact');
    }
    expect(TestBed.inject(Router)).toBeTruthy();
  });
});
