import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { DEFAULT_LOCALE, LOCALES, getDirection, type Locale } from '@asa/shared';
import { filter, firstValueFrom } from 'rxjs';
import { switchLocaleUrl } from './locale';

/** Source of truth for the active locale, text direction and locale-prefixed URLs. */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  private readonly _locale = signal<Locale>(DEFAULT_LOCALE);
  readonly locale = this._locale.asReadonly();
  readonly direction = computed(() => getDirection(this._locale()));
  readonly locales = LOCALES;

  /** Bumped after every activation, so consumers of translated text re-run even for the same locale. */
  private readonly _revision = signal(0);
  readonly revision = this._revision.asReadonly();

  private readonly currentUrl = signal(this.router.url);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  /** Loads the translations, then sets `lang`/`dir` on the root element. Awaited by the route guard. */
  async activate(locale: Locale): Promise<void> {
    await firstValueFrom(this.transloco.load(locale));
    this.transloco.setActiveLang(locale);
    this._locale.set(locale);
    this._revision.update((value) => value + 1);
    const root = this.document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', getDirection(locale));
  }

  /** Same page in another locale, keeping query string and fragment. Used for real `<a>` links. */
  urlFor(locale: Locale) {
    return this.router.parseUrl(switchLocaleUrl(this.currentUrl(), locale));
  }
}
