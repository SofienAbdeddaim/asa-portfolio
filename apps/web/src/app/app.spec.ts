import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { fakeAdminApi, httpError } from '../testing/admin-helpers';
import { CONTENT_FIXTURE } from '../testing/content.fixture';
import { AdminApi } from './admin/admin-api';
import { App } from './app';
import { routes } from './app.routes';
import { CommandService } from './core/command.service';
import { ContentStore } from './core/content.store';
import { provideI18n } from './core/i18n';
import { LocaleService } from './core/locale.service';
import { PageTitleStrategy } from './core/page-title.strategy';

// jsdom lacks modal <dialog> and scrollIntoView; real browsers provide both.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => undefined;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

async function setup(url: string, extra: Provider[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideI18n(),
      { provide: TitleStrategy, useClass: PageTitleStrategy },
      ...extra,
    ],
  });
  TestBed.inject(ContentStore).seed(CONTENT_FIXTURE);
  const fixture = TestBed.createComponent(App);
  const router = TestBed.inject(Router);
  const go = async (target: string) => {
    await router.navigateByUrl(target);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await go(url);
  return { fixture, el: fixture.nativeElement as HTMLElement, go };
}

describe('locale routing', () => {
  it('redirects the root to the default locale', async () => {
    await setup('/');
    expect(TestBed.inject(Router).url).toBe('/en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets lang and dir=rtl for Arabic and translates the page and title', async () => {
    const { el } = await setup('/ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(TestBed.inject(Title).getTitle()).toBe('Alex Placeholder · مهندس برمجيات أول');
    expect(el.querySelector('#hero-title')?.textContent).toContain('مرحبًا');
    expect(el.querySelector('#about-title')?.textContent).toContain('قليل عني');
  });

  it('renders French with ltr direction', async () => {
    const { el } = await setup('/fr');
    expect(document.documentElement.dir).toBe('ltr');
    // The fixture has no French headline, so the English one is used.
    expect(TestBed.inject(Title).getTitle()).toBe('Alex Placeholder · Senior Software Engineer');
    expect(el.querySelector('#experience-title')?.textContent).toContain("D'où je viens");
  });

  it('sends unknown locales to the default locale 404', async () => {
    const { el } = await setup('/xx');
    expect(TestBed.inject(Router).url).toBe('/en/404');
    expect(el.querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('shows a localized 404 for unknown pages inside a locale', async () => {
    const { el } = await setup('/fr/nope');
    expect(el.querySelector('h1')?.textContent).toContain('Page introuvable');
  });
});

describe('language switcher', () => {
  it('renders real links to the same page in each language, marking the current one', async () => {
    const { el } = await setup('/fr/nope');
    const links = [...el.querySelectorAll<HTMLAnchorElement>('app-language-switcher a')];
    const unique = links.slice(0, 3);
    expect(unique.map((a) => a.getAttribute('href'))).toEqual(['/fr/nope', '/en/nope', '/ar/nope']);
    expect(unique.map((a) => a.getAttribute('hreflang'))).toEqual(['fr', 'en', 'ar']);
    expect(unique.filter((a) => a.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(unique[0]?.getAttribute('aria-current')).toBe('true');
  });

  it('switches language on the same page without rebuilding it', async () => {
    const { el, go } = await setup('/en');
    const before = el.querySelector('app-home-page');
    expect(before).not.toBeNull();
    await go('/ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(el.querySelector('app-home-page')).toBe(before);
    expect(TestBed.inject(LocaleService).locale()).toBe('ar');
  });
});

describe('shell', () => {
  it('has a skip link, a main landmark and a navigation to every section', async () => {
    const { el } = await setup('/en');
    expect(el.querySelector('a[href="#main"]')?.textContent).toContain('Skip to main content');
    expect(el.querySelector('[role="main"]#main')).not.toBeNull();
    // The section links appear in both the desktop bar and the mobile menu.
    expect(el.querySelectorAll('nav[aria-label="Main navigation"] a')).toHaveLength(18);
  });

  it('opens and closes the command palette with Ctrl+K', async () => {
    const { fixture, el } = await setup('/en');
    const commands = TestBed.inject(CommandService);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(commands.open()).toBe(true);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    expect(commands.open()).toBe(false);
  });

  it('registers translated commands: sections, languages, theme and fun', async () => {
    await setup('/en');
    const commands = TestBed.inject(CommandService);
    expect(commands.commands().map((c) => c.id)).toEqual([
      'home',
      'go-about',
      'go-experience',
      'go-skills',
      'go-projects',
      'go-play',
      'go-kind',
      'go-contact',
      'go-blog',
      'go-cv',
      'lang-fr',
      'lang-ar',
      'theme',
      'confetti',
    ]);
    const label = (id: string) => commands.commands().find((c) => c.id === id)?.label;
    expect(label('lang-fr')).toBe('Switch language to Français');
    expect(label('go-experience')).toBe('Go to Journey');
  });

  it('filters, navigates with the keyboard and runs the selected command', async () => {
    const { fixture, el } = await setup('/en');
    const router = TestBed.inject(Router);
    TestBed.inject(CommandService).show();
    fixture.detectChanges();
    await fixture.whenStable();

    const input = el.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    input.value = 'arab';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const options = el.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-lang-ar');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await fixture.whenStable();
    expect(router.url).toBe('/ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('jumps to a section from the palette', async () => {
    const { fixture } = await setup('/en');
    const target = document.getElementById('skills')!;
    const spy = vi.spyOn(target, 'scrollIntoView');
    TestBed.inject(CommandService)
      .commands()
      .find((c) => c.id === 'go-skills')!
      .run();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('moves the active option with arrow keys and wraps around', async () => {
    const { fixture, el } = await setup('/en');
    TestBed.inject(CommandService).show();
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    const press = (key: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
      fixture.detectChanges();
    };
    press('ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-confetti');
    press('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-home');
    press('End');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-confetti');
    press('Home');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-home');
  });

  it('closes the palette from a backdrop click and shows an empty state', async () => {
    const { fixture, el } = await setup('/en');
    const commands = TestBed.inject(CommandService);
    commands.show();
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('#palette-list')?.textContent).toContain('No matching command');

    el.querySelector('dialog')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(commands.open()).toBe(false);
  });

  it('cycles the theme from the toggle', async () => {
    const { fixture, el } = await setup('/en');
    const button = el.querySelector<HTMLButtonElement>('app-theme-toggle button')!;
    const before = button.getAttribute('aria-label');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).not.toBe(before);
  });
});

describe('back-office area', () => {
  async function admin() {
    const api = fakeAdminApi();
    api['me']!.mockRejectedValue(httpError(401));
    api['refresh']!.mockRejectedValue(httpError(401));
    return setup('/admin/login', [{ provide: AdminApi, useValue: api }]);
  }

  it('runs without the public header, footer and palette, and has a single main region', async () => {
    const { el } = await admin();
    expect(TestBed.inject(Router).url).toBe('/admin/login');
    expect(el.querySelector('app-site-header')).toBeNull();
    expect(el.querySelector('footer')).toBeNull();
    expect(el.querySelector('app-command-palette')).toBeNull();
    expect(el.querySelector('[role="main"]')).toBeNull();
    expect(el.querySelectorAll('main')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('Sign in');
    expect(TestBed.inject(Title).getTitle()).toBe('Sign in · ASA');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });

  it('does not open the public command palette with Ctrl+K', async () => {
    await admin();
    const commands = TestBed.inject(CommandService);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }),
    );
    expect(commands.open()).toBe(false);
  });

  it('sends visitors who are not signed in from /admin to the sign-in page', async () => {
    const api = fakeAdminApi();
    api['me']!.mockRejectedValue(httpError(401));
    api['refresh']!.mockRejectedValue(httpError(401));
    await setup('/admin/profile', [{ provide: AdminApi, useValue: api }]);
    expect(TestBed.inject(Router).url).toBe('/admin/login');
  });

  it('removes the noindex tag again on public pages', async () => {
    const { go } = await admin();
    await go('/en');
    // Public pages are indexable: the back-office's noindex tag is replaced.
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    expect(document.querySelector('header')).not.toBeNull();
  });
});
