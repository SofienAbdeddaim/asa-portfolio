import { RenderMode, type ServerRoute } from '@angular/ssr';
import { LOCALES } from '@asa/shared';

/** Public pages are prerendered once per locale; everything else is rendered in the browser. */
export const serverRoutes: ServerRoute[] = [
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => LOCALES.map((lang) => ({ lang })),
  },
  { path: '**', renderMode: RenderMode.Client },
];
