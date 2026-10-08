import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { LocaleService } from './locale.service';
import { RouteFocusService } from './route-focus.service';
import { provideI18n } from './i18n';

@Component({ selector: 'app-page-a', template: '<h1>Page A</h1>' })
class PageA {}

@Component({ selector: 'app-page-b', template: '<h1>Page B</h1>' })
class PageB {}

@Component({ selector: 'app-bare', template: '<p>No heading here</p>' })
class Bare {}

describe('RouteFocusService', () => {
  let router: Router;
  let service: RouteFocusService;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="main" role="main"><div id="outlet"></div></div>';
    TestBed.configureTestingModule({
      providers: [
        provideI18n(),
        provideRouter([
          { path: 'en', component: PageA },
          { path: 'en/other', component: PageB },
          { path: 'fr', component: PageA },
          { path: 'bare', component: Bare },
        ]),
      ],
    });
    await TestBed.inject(LocaleService).activate('en');
    // The route guard loads a language before navigating to it; do the same for French.
    await firstValueFrom(TestBed.inject(TranslocoService).load('fr'));
    router = TestBed.inject(Router);
    service = TestBed.inject(RouteFocusService);
    service.start();
  });

  /** Renders the routed component into the document, as the real outlet would. */
  async function renderAt(url: string): Promise<void> {
    await router.navigateByUrl(url);
    const outlet = document.getElementById('outlet')!;
    const heading =
      router.routerState.snapshot.root.firstChild?.component === PageB ? 'Page B' : 'Page A';
    outlet.innerHTML = url === '/bare' ? '<p>No heading here</p>' : `<h1>${heading}</h1>`;
    TestBed.tick();
  }

  it('leaves focus alone on the first page load', async () => {
    await renderAt('/en');
    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus to the new heading after a real navigation, without making it a tab stop', async () => {
    await renderAt('/en');
    await renderAt('/en/other');
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Page B'));
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the main region when the page has no heading', async () => {
    await renderAt('/en');
    await renderAt('/bare');
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('main'));
  });

  it('keeps focus and the place when only the language changes, and announces it', async () => {
    await renderAt('/en');
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    await renderAt('/fr');
    expect(document.activeElement).toBe(button);
    expect(service.announcement()).toBe('Langue changée : Français');
  });

  it('clears the language announcement on the next real navigation', async () => {
    await renderAt('/en');
    await renderAt('/fr');
    expect(service.announcement()).not.toBe('');
    await renderAt('/bare');
    expect(service.announcement()).toBe('');
  });
});
