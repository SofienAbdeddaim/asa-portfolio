import { DEFAULT_LOCALE, INTL_TAGS, isLocale, type Locale } from '@asa/shared';

/** Splits `/fr/projects?x=1#top` into its locale and the rest, if the first segment is a locale. */
export function splitLocale(url: string): { locale: Locale | null; rest: string } {
  const match = /^\/([^/?#]+)(.*)$/.exec(url);
  const candidate = match?.[1];
  if (candidate && isLocale(candidate)) return { locale: candidate, rest: match[2] ?? '' };
  return { locale: null, rest: url };
}

/** Same page in another locale: only the first path segment changes. */
export function switchLocaleUrl(url: string, target: Locale): string {
  const { locale, rest } = splitLocale(url);
  if (locale === null) return `/${target}${url === '/' ? '' : url}`;
  return `/${target}${rest}`;
}

/** True when two URLs only differ by their locale prefix (a language switch, not a navigation). */
export function isLocaleSwitch(previous: string, next: string): boolean {
  const a = splitLocale(previous);
  const b = splitLocale(next);
  return a.locale !== null && b.locale !== null && a.locale !== b.locale && a.rest === b.rest;
}

export function localeOrDefault(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export const intlTag = (locale: Locale): string => INTL_TAGS[locale];

export function formatDate(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(intlTag(locale), { timeZone: 'UTC', ...options }).format(
    typeof value === 'string' ? new Date(value) : value,
  );
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlTag(locale), options).format(value);
}

/** Locale-aware, accent-insensitive-by-default comparison for sorting labels. */
export function collator(locale: Locale): Intl.Collator {
  return new Intl.Collator(intlTag(locale), { sensitivity: 'base', numeric: true });
}

/** Lowercases and strips accents, Arabic diacritics and tatweel so search matches loosely. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[آأإ]/g, 'ا')
    .toLowerCase()
    .trim();
}
