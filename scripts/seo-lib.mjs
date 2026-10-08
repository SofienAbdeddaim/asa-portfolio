// Sitemaps and robots.txt, generated after the build from the content snapshot and the site
// address. One sitemap per language plus an index; every URL lists its translations (hreflang).
export const LOCALES = ['fr', 'en', 'ar'];
export const DEFAULT_LOCALE = 'en';

const escapeXml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );

const day = (value) =>
  typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : undefined;

/** Paths below the language prefix: home, blog, CV and every published post. */
export function pagesFromSnapshot(snapshot) {
  return [
    { path: '', lastmod: day(snapshot.generatedAt) },
    { path: '/blog', lastmod: day(snapshot.posts?.[0]?.updatedAt ?? snapshot.generatedAt) },
    { path: '/cv', lastmod: day(snapshot.generatedAt) },
    ...(snapshot.posts ?? []).map((post) => ({
      path: `/blog/${post.slug}`,
      lastmod: day(post.updatedAt ?? post.publishedAt),
    })),
  ];
}

export function buildSitemaps({ siteUrl, pages, locales = LOCALES }) {
  const base = siteUrl.replace(/\/$/, '');
  const url = (locale, path) => `${base}/${locale}${path}`;
  const files = {};

  for (const locale of locales) {
    const entries = pages.map((page) => {
      const alternates = [
        ...locales.map(
          (code) =>
            `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapeXml(url(code, page.path))}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url(DEFAULT_LOCALE, page.path))}"/>`,
      ];
      return [
        '  <url>',
        `    <loc>${escapeXml(url(locale, page.path))}</loc>`,
        ...(page.lastmod ? [`    <lastmod>${page.lastmod}</lastmod>`] : []),
        ...alternates,
        '  </url>',
      ].join('\n');
    });
    files[`sitemap-${locale}.xml`] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n');
  }

  files['sitemap.xml'] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locales.map(
      (locale) => `  <sitemap><loc>${escapeXml(`${base}/sitemap-${locale}.xml`)}</loc></sitemap>`,
    ),
    '</sitemapindex>',
    '',
  ].join('\n');
  return files;
}

export function buildRobots(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    `Sitemap: ${siteUrl.replace(/\/$/, '')}/sitemap.xml`,
    '',
  ].join('\n');
}

/** Accepts https addresses, and http only for localhost. Returns the address without a trailing slash. */
export function normalizeSiteUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`"${input}" is not a valid URL`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new Error('The site URL must use https (http is only allowed for localhost)');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Give the site address only, without a path, query or fragment');
  }
  return parsed.origin;
}
