import type { Routes } from '@angular/router';
import { DEFAULT_LOCALE } from '@asa/shared';
import { adminAreaGuard } from './admin/guards';
import { localeGuard } from './core/locale.guard';
import { cvTitle, homeTitle, postTitle } from './core/page-titles';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: DEFAULT_LOCALE },
  // Private back-office: outside the locale-prefixed public site, lazy-loaded, never indexed.
  {
    path: 'admin',
    canActivate: [adminAreaGuard],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: ':lang',
    canActivate: [localeGuard],
    children: [
      {
        path: '',
        title: homeTitle,
        data: { fullTitle: true },
        loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: 'blog',
        data: { titleKey: 'blog.title' },
        loadComponent: () => import('./pages/blog-list.page').then((m) => m.BlogListPage),
      },
      {
        path: 'blog/:slug',
        title: postTitle,
        data: { fullTitle: true },
        loadComponent: () => import('./pages/blog-post.page').then((m) => m.BlogPostPage),
      },
      {
        path: 'cv',
        title: cvTitle,
        data: { fullTitle: true },
        loadComponent: () => import('./pages/cv.page').then((m) => m.CvPage),
      },
      {
        path: '**',
        data: { titleKey: 'notFound.title' },
        loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
