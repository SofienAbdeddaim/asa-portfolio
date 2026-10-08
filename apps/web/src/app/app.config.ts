import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { authRefreshInterceptor } from './core/auth-refresh.interceptor';
import { provideI18n } from './core/i18n';
import { PageTitleStrategy } from './core/page-title.strategy';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Scrolling to the top is handled by ScrollService so a language switch keeps the position.
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'disabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authRefreshInterceptor])),
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    provideI18n(),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
