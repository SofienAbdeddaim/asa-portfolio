import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Locale } from '@asa/shared';
import { LocaleService } from '../core/locale.service';

/** Each language name in its own language, so it is recognizable whatever the page language. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

/**
 * Real links (not buttons): they work without JavaScript, can be opened in a new tab and are
 * crawlable. Navigating reuses the same route, so the page and its scroll position stay put.
 */
@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <nav [attr.aria-label]="'language.label' | transloco">
      <ul class="flex items-center gap-1 rounded-full border-[3px] border-ink bg-surface p-1">
        @for (code of locales; track code) {
          <li>
            <a
              [routerLink]="localeService.urlFor(code)"
              [attr.hreflang]="code"
              [attr.lang]="code"
              [attr.aria-label]="'language.switchTo' | transloco: { language: names[code] }"
              [attr.aria-current]="code === localeService.locale() ? 'true' : null"
              class="inline-flex min-h-9 min-w-10 items-center justify-center rounded-full px-2 text-sm font-bold uppercase transition-colors hover:bg-surface-2 aria-[current=true]:bg-coral aria-[current=true]:text-on-color"
              >{{ code }}</a
            >
          </li>
        }
      </ul>
    </nav>
  `,
})
export class LanguageSwitcher {
  protected readonly localeService = inject(LocaleService);
  protected readonly locales = this.localeService.locales;
  protected readonly names = LANGUAGE_NAMES;
}
