import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales.js';

/** A translatable field. Only the default locale is required; the others may be empty. */
export type LocalizedString = Record<Locale, string>;

const isFilled = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Resolves a field for a locale, falling back to the default locale (English). */
export function resolveLocalized(field: Partial<LocalizedString>, locale: Locale): string {
  const requested = field[locale];
  if (isFilled(requested)) return requested;
  return field[DEFAULT_LOCALE] ?? '';
}

/** Returns the locales for which the field has a non-empty translation. */
export function filledLocales(field: Partial<LocalizedString>): Locale[] {
  return LOCALES.filter((locale) => isFilled(field[locale]));
}

/** Completeness ratio (0..1) across a set of translatable fields, used by the back-office. */
export function completeness(fields: readonly Partial<LocalizedString>[]): number {
  if (fields.length === 0) return 1;
  const total = fields.length * LOCALES.length;
  const filled = fields.reduce((sum, field) => sum + filledLocales(field).length, 0);
  return filled / total;
}

/** The default-locale value is mandatory for a valid entry. */
export function hasDefaultLocale(field: Partial<LocalizedString>): boolean {
  return isFilled(field[DEFAULT_LOCALE]);
}
