import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DEFAULT_LOCALE, isLocale } from '@asa/shared';
import { LocaleService } from './locale.service';

/** Guards `/:lang`: activates a valid locale, sends anything else to the default locale's 404. */
export const localeGuard: CanActivateFn = async (route) => {
  const lang = route.paramMap.get('lang');
  if (!isLocale(lang)) return inject(Router).parseUrl(`/${DEFAULT_LOCALE}/404`);
  await inject(LocaleService).activate(lang);
  return true;
};
