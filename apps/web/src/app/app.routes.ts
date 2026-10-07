import type { Routes } from '@angular/router';
import { DEFAULT_LOCALE } from '@asa/shared';
import { localeGuard } from './core/locale.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: DEFAULT_LOCALE },
  // Private back-office: outside the locale-prefixed public site, lazy-loaded.
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  {
    path: ':lang',
    canActivate: [localeGuard],
    children: [
      {
        path: '',
        data: { titleKey: 'home.title' },
        loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: '**',
        data: { titleKey: 'notFound.title' },
        loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
