import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { isLocale } from '@asa/shared';
import { filter, pairwise, startWith } from 'rxjs';
import { LANGUAGE_NAMES } from '../layout/language-switcher';
import { isLocaleSwitch, splitLocale } from './locale';

/**
 * What a sighted visitor gets for free when a page changes, for people who cannot see it: after a
 * real navigation focus moves to the new page's heading, so a screen reader announces it and the
 * next Tab starts from the top of the page; after a language switch, which keeps the page and the
 * place in it, a polite message says the language changed.
 */
@Injectable({ providedIn: 'root' })
export class RouteFocusService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);

  private readonly _announcement = signal('');
  /** Text for the page's polite live region. */
  readonly announcement = this._announcement.asReadonly();

  start(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        pairwise(),
      )
      .subscribe(([previous, current]) => {
        if (!previous || !current) return; // the first page load is announced by the browser
        if (current.urlAfterRedirects.includes('#')) return; // section jumps move focus themselves
        if (isLocaleSwitch(previous.urlAfterRedirects, current.urlAfterRedirects)) {
          this.announceLanguage(current.urlAfterRedirects);
          return;
        }
        this._announcement.set('');
        afterNextRender(() => this.focusPage(), { injector: this.injector });
      });
  }

  private announceLanguage(url: string): void {
    const locale = splitLocale(url).locale;
    if (!isLocale(locale)) return;
    this._announcement.set(
      this.transloco.translate('language.changed', { language: LANGUAGE_NAMES[locale] }, locale),
    );
  }

  /** Focus the page's own heading, or the main region when the heading is not there (yet). */
  private focusPage(): void {
    const target =
      this.document.querySelector<HTMLElement>('main h1, [role="main"] h1, h1') ??
      this.document.getElementById('main');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}
