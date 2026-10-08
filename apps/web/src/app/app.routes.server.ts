import { RenderMode, type ServerRoute } from '@angular/ssr';
import { LOCALES } from '@asa/shared';

/** Slugs of the published posts in the build-time snapshot. Read at build time, in Node. */
async function postSlugs(): Promise<string[]> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const raw = await readFile(resolve(process.cwd(), 'public/content-snapshot.json'), 'utf8');
    const posts = (JSON.parse(raw) as { posts?: { slug: string }[] }).posts ?? [];
    return posts.map((post) => post.slug);
  } catch {
    return [];
  }
}

const perLocale = async () => LOCALES.map((lang) => ({ lang }));

/**
 * Public pages are prerendered once per locale: home, blog, every post and the CV. The back-office
 * needs a live session, so it is only ever rendered in the browser. The `admin` entries must stay
 * above `:lang`, which would otherwise treat "admin" as a language.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: ':lang', renderMode: RenderMode.Prerender, getPrerenderParams: perLocale },
  { path: ':lang/blog', renderMode: RenderMode.Prerender, getPrerenderParams: perLocale },
  { path: ':lang/cv', renderMode: RenderMode.Prerender, getPrerenderParams: perLocale },
  {
    path: ':lang/blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      const slugs = await postSlugs();
      return LOCALES.flatMap((lang) => slugs.map((slug) => ({ lang, slug })));
    },
  },
  { path: '**', renderMode: RenderMode.Client },
];
