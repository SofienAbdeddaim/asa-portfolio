import {
  collator,
  formatDate,
  formatNumber,
  isLocaleSwitch,
  localeOrDefault,
  normalizeSearch,
  splitLocale,
  switchLocaleUrl,
} from './locale';

describe('locale URL helpers', () => {
  it('splits the locale from the rest of the URL', () => {
    expect(splitLocale('/fr/projects?x=1#top')).toEqual({
      locale: 'fr',
      rest: '/projects?x=1#top',
    });
    expect(splitLocale('/ar')).toEqual({ locale: 'ar', rest: '' });
    expect(splitLocale('/xx/page')).toEqual({ locale: null, rest: '/xx/page' });
    expect(splitLocale('/')).toEqual({ locale: null, rest: '/' });
  });

  it('switches only the first segment and keeps query and fragment', () => {
    expect(switchLocaleUrl('/en/blog/hello?tag=a#intro', 'ar')).toBe('/ar/blog/hello?tag=a#intro');
    expect(switchLocaleUrl('/en', 'fr')).toBe('/fr');
    expect(switchLocaleUrl('/', 'fr')).toBe('/fr');
    expect(switchLocaleUrl('/about', 'fr')).toBe('/fr/about');
  });

  it('recognizes a language switch versus a real navigation', () => {
    expect(isLocaleSwitch('/en/blog', '/fr/blog')).toBe(true);
    expect(isLocaleSwitch('/en/blog', '/en/about')).toBe(false);
    expect(isLocaleSwitch('/en/blog', '/fr/about')).toBe(false);
    expect(isLocaleSwitch('/en', '/en')).toBe(false);
    expect(isLocaleSwitch('/admin', '/en')).toBe(false);
  });

  it('falls back to the default locale', () => {
    expect(localeOrDefault('ar')).toBe('ar');
    expect(localeOrDefault('zz')).toBe('en');
    expect(localeOrDefault(null)).toBe('en');
  });
});

describe('Intl formatting', () => {
  const date = '2026-03-14T00:00:00.000Z';

  it('formats dates per locale in UTC', () => {
    expect(formatDate(date, 'en', { dateStyle: 'long' })).toBe('14 March 2026');
    expect(formatDate(date, 'fr', { dateStyle: 'long' })).toBe('14 mars 2026');
    expect(formatDate(date, 'ar', { dateStyle: 'long' })).toContain('2026');
    expect(formatDate(date, 'ar', { dateStyle: 'long' })).toMatch(/مارس/);
  });

  it('formats numbers per locale and keeps Latin digits in Arabic', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'fr').replace(/\s/g, ' ')).toBe('1 234,5');
    expect(formatNumber(1234.5, 'ar')).toMatch(/^1.234.5$/);
    expect(formatNumber(1234.5, 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('sorts accented and numbered labels naturally', () => {
    const sorted = ['école', 'Zebra', 'apple', 'item 10', 'item 2'].sort(collator('fr').compare);
    expect(sorted).toEqual(['apple', 'école', 'item 2', 'item 10', 'Zebra']);
  });
});

describe('normalizeSearch', () => {
  it('ignores case and Latin accents', () => {
    expect(normalizeSearch('  Éducation ')).toBe('education');
  });

  it('ignores Arabic diacritics, tatweel and alef variants', () => {
    expect(normalizeSearch('أَحْمَد')).toBe(normalizeSearch('احمد'));
    expect(normalizeSearch('إعدادات')).toBe(normalizeSearch('اعدادات'));
    expect(normalizeSearch('مـرحبا')).toBe('مرحبا');
  });
});
