import { describe, expect, it } from 'vitest';
import {
  completeness,
  filledLocales,
  getDirection,
  hasDefaultLocale,
  isLocale,
  resolveLocalized,
} from './index.js';

describe('locales', () => {
  it('validates locale codes', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('returns rtl only for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('fr')).toBe('ltr');
    expect(getDirection('en')).toBe('ltr');
  });
});

describe('localized strings', () => {
  it('falls back to English when a translation is missing or blank', () => {
    expect(resolveLocalized({ en: 'Hello', fr: '  ' }, 'fr')).toBe('Hello');
    expect(resolveLocalized({ en: 'Hello', ar: 'مرحبا' }, 'ar')).toBe('مرحبا');
    expect(resolveLocalized({}, 'ar')).toBe('');
  });

  it('lists filled locales', () => {
    expect(filledLocales({ en: 'a', fr: '', ar: 'c' })).toEqual(['en', 'ar']);
  });

  it('computes completeness', () => {
    expect(completeness([])).toBe(1);
    expect(completeness([{ en: 'a', fr: 'b', ar: 'c' }])).toBe(1);
    expect(completeness([{ en: 'a' }, { en: 'a', fr: 'b' }])).toBeCloseTo(3 / 6);
  });

  it('requires the default locale', () => {
    expect(hasDefaultLocale({ en: 'x' })).toBe(true);
    expect(hasDefaultLocale({ fr: 'x' })).toBe(false);
  });
});
