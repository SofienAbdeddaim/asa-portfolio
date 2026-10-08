import type { Routes } from '@angular/router';
import { adminGuard, guestGuard, unsavedChangesGuard } from './guards';

/** The private back-office. Everything is lazy-loaded; only `login` is reachable when signed out. */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        title: 'Profile',
        data: { resource: 'profile' },
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./resource-edit.page').then((m) => m.ResourceEditPage),
      },
      {
        path: ':resource',
        title: 'Content',
        loadComponent: () => import('./resource-list.page').then((m) => m.ResourceListPage),
      },
      {
        path: ':resource/new',
        title: 'New entry',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./resource-edit.page').then((m) => m.ResourceEditPage),
      },
      {
        path: ':resource/:id',
        title: 'Edit entry',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./resource-edit.page').then((m) => m.ResourceEditPage),
      },
    ],
  },
];
