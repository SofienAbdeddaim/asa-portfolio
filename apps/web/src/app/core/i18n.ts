import { isDevMode, type EnvironmentProviders } from '@angular/core';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@asa/shared';
import { from, type Observable } from 'rxjs';

/**
 * Translations are bundled as lazy chunks (not fetched over HTTP) so they also resolve during
 * prerendering. Each language is its own chunk, loaded when first activated.
 */
const loaders: Record<Locale, () => Promise<{ default: Translation }>> = {
  en: () => import('../../i18n/en.json'),
  fr: () => import('../../i18n/fr.json'),
  ar: () => import('../../i18n/ar.json'),
};

export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const load = loaders[lang as Locale] ?? loaders[DEFAULT_LOCALE];
    return from(load().then((module) => module.default));
  }
}

export function provideI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LOCALES],
      defaultLang: DEFAULT_LOCALE,
      fallbackLang: DEFAULT_LOCALE,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
    },
    loader: BundledTranslationLoader,
  });
}
