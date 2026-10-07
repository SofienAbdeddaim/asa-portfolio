import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Light/dark theme. The preference (a per-viewer convenience, never a credential) is remembered
 * in localStorage when available. `index.html` applies it before first paint to avoid a flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _preference = signal<ThemePreference>(this.read());
  private readonly systemDark = signal(this.browser && this.media()?.matches === true);

  readonly preference = this._preference.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this._preference();
    if (preference === 'system') return this.systemDark() ? 'dark' : 'light';
    return preference;
  });

  constructor() {
    this.media()?.addEventListener('change', (event) => this.systemDark.set(event.matches));
    this.apply();
  }

  set(preference: ThemePreference): void {
    this._preference.set(preference);
    this.write(preference);
    this.apply();
  }

  /** Cycles light -> dark -> system. */
  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    this.set(order[(order.indexOf(this._preference()) + 1) % order.length] ?? 'system');
  }

  private apply(): void {
    this.document.documentElement.setAttribute('data-theme', this.resolved());
  }

  private media(): MediaQueryList | null {
    return this.browser && typeof matchMedia === 'function'
      ? matchMedia('(prefers-color-scheme: dark)')
      : null;
  }

  private read(): ThemePreference {
    if (!this.browser) return 'system';
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  private write(preference: ThemePreference): void {
    if (!this.browser) return;
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage can be blocked (private mode); the preference then lasts for the session only.
    }
  }
}
