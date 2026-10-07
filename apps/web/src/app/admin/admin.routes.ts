import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type Routes } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../core/locale.service';

/** Placeholder for the private back-office (built in a later phase). Lazy-loaded, never indexed. */
@Component({
  selector: 'app-admin-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <h1 class="text-3xl">{{ 'admin.title' | transloco }}</h1>
    <p class="mt-4 text-muted">{{ 'admin.body' | transloco }}</p>
  `,
})
export class AdminPlaceholder {
  constructor() {
    // The admin lives outside the locale-prefixed public site but still needs translations.
    void inject(LocaleService).activate('en');
  }
}

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminPlaceholder, data: { titleKey: 'admin.title' } },
];
