import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { resolveLocalized } from '@asa/shared';
import { ContentStore } from './content.store';
import { LocaleService } from './locale.service';

/**
 * Route titles that depend on content. They wait for the build-time snapshot only (never the API)
 * and are complete titles, so routes using them set `data.fullTitle`.
 */
export const homeTitle: ResolveFn<string> = async () => {
  const store = inject(ContentStore);
  const locale = inject(LocaleService);
  await store.ensureSnapshot();
  const profile = store.profile();
  if (!profile) return 'Portfolio';
  return `${profile.fullName} · ${resolveLocalized(profile.headline, locale.locale())}`;
};

export const postTitle: ResolveFn<string> = async (route) => {
  const store = inject(ContentStore);
  const locale = inject(LocaleService);
  await store.ensureSnapshot();
  const post = store.posts().find((entry) => entry.slug === route.paramMap.get('slug'));
  const brand = store.profile()?.fullName ?? '';
  const title = post ? resolveLocalized(post.title, locale.locale()) : 'Blog';
  return [title, brand].filter(Boolean).join(' · ');
};

export const cvTitle: ResolveFn<string> = async () => {
  const store = inject(ContentStore);
  await store.ensureSnapshot();
  const name = store.profile()?.fullName;
  return name ? `${name} · CV` : 'CV';
};
