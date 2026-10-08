import { inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, type CanActivateFn, type CanDeactivateFn } from '@angular/router';
import { LocaleService } from '../core/locale.service';
import { AuthStore } from './auth.store';

/** The back-office is English-only chrome and must never be indexed. */
export const adminAreaGuard: CanActivateFn = async () => {
  inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  await inject(LocaleService).activate('en');
  return true;
};

// Dependencies are injected before the first `await`: after it the injection context is gone.

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return (await auth.ensure()) ? true : router.parseUrl('/admin/login');
};

/** Someone who is already signed in has no reason to see the sign-in form. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return (await auth.ensure()) ? router.parseUrl('/admin') : true;
};

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  confirm('You have unsaved changes. Leave this page and lose them?');
