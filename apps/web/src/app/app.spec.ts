import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { App } from './app';
import { routes } from './app.routes';
import { CommandService } from './core/command.service';
import { provideI18n } from './core/i18n';
import { PageTitleStrategy } from './core/page-title.strategy';
import { LocaleService } from './core/locale.service';

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

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideI18n(),
      { provide: TitleStrategy, useClass: PageTitleStrategy },
    ],
  });
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
    expect(TestBed.inject(Title).getTitle()).toBe('الأساسيات · ASA');
    expect(el.querySelector('h1')?.textContent).toContain('خط زمني');
  });

  it('renders French with ltr direction', async () => {
    await setup('/fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(TestBed.inject(Title).getTitle()).toBe('Fondations · ASA');
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
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/fr/nope', '/en/nope', '/ar/nope']);
    expect(links.map((a) => a.getAttribute('hreflang'))).toEqual(['fr', 'en', 'ar']);
    expect(links.filter((a) => a.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(links[0]?.getAttribute('aria-current')).toBe('true');
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
  it('has a skip link and a labelled main landmark', async () => {
    const { el } = await setup('/en');
    expect(el.querySelector('a[href="#main"]')?.textContent).toContain('Skip to main content');
    expect(el.querySelector('main#main')).not.toBeNull();
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

  it('registers translated commands that follow the active language', async () => {
    await setup('/en');
    const commands = TestBed.inject(CommandService);
    expect(commands.commands().map((c) => c.id)).toEqual(['home', 'lang-fr', 'lang-ar', 'theme']);
    expect(commands.commands()[1]?.label).toBe('Switch language to Français');
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
    expect(input.getAttribute('aria-activedescendant')).toBe('command-theme');
    press('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-home');
    press('End');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-theme');
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
