import { Pipe, type PipeTransform } from '@angular/core';
import { resolveLocalized, type Locale, type LocalizedString } from '@asa/shared';

/** `{{ item.title | localized: locale() }}`. Falls back to English. Pure: re-runs when the locale changes. */
@Pipe({ name: 'localized' })
export class LocalizedPipe implements PipeTransform {
  transform(value: Partial<LocalizedString> | null | undefined, locale: Locale): string {
    return value ? resolveLocalized(value, locale) : '';
  }
}
