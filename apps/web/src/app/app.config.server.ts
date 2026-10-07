import {
  mergeApplicationConfig,
  provideAppInitializer,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import type { ContentSnapshot } from '@asa/shared';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { ContentStore } from './core/content.store';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Prerendering reads the build-time snapshot straight from disk (never from the API).
    provideAppInitializer(async () => {
      const store = inject(ContentStore);
      try {
        const { readFile } = await import('node:fs/promises');
        const { resolve } = await import('node:path');
        const raw = await readFile(resolve(process.cwd(), 'public/content-snapshot.json'), 'utf8');
        store.seed(JSON.parse(raw) as ContentSnapshot);
      } catch {
        // Without a snapshot the page prerenders its loading state.
      }
    }),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
