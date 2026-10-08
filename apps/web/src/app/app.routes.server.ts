import { RenderMode, type ServerRoute } from '@angular/ssr';
import { LOCALES } from '@asa/shared';

/**
 * Public pages are prerendered once per locale. The back-office needs a live session, so it is
 * only ever rendered in the browser. These entries must stay above `:lang`, which would
 * otherwise treat "admin" as a language.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => LOCALES.map((lang) => ({ lang })),
  },
  { path: '**', renderMode: RenderMode.Client },
];
