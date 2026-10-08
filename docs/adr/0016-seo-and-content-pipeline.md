# 16. SEO and the build-time content pipeline

Status: accepted

## Content pipeline

1. `pnpm snapshot` (`scripts/fetch-snapshot.mjs`) reads `GET /api/content` from the API (`API_URL`) and writes `apps/web/public/content-snapshot.json`. It retries for about a minute so a sleeping free-tier API can wake up, validates the shape, downloads every image the content uses into `public/media/<id>.webp`, rewrites `/api/media/<id>` to `/media/<id>.webp` everywhere (including images inside Markdown), removes images nothing refers to, and writes the JSON last and atomically. On any failure it exits non-zero and leaves the existing snapshot untouched.
2. `pnpm build` prerenders every public page from that snapshot (read from disk, never the API): home, blog, CV, and every published post, in all three languages. The snapshot is also handed to the browser through TransferState, so hydration needs no extra request.
3. In the browser the page then refreshes from the live API (5 second timeout) and shows a notice if the API does not answer. Images are static files, so they also survive a sleeping API.
4. The committed `content-snapshot.json` is clearly fake demo data (`pnpm snapshot:demo`, no database needed); real deployments overwrite it during the build.

## Markdown at build time

Post bodies are stored raw and sanitized on render. Prerendering has no browser DOM, so the server build runs DOMPurify on a `jsdom` window (an external build dependency), with the same rules and link hardening as the browser. A hostile `<script>` or `onerror` in a post therefore never reaches the static HTML (verified on a real post).

## SEO

- `SeoService` sets, per page and per language: description, `robots`, canonical URL, `hreflang` alternates for every language plus `x-default`, Open Graph and Twitter cards (with `og:locale` and alternates, image when there is one) and JSON-LD (`Person`, `Blog`, `BlogPosting`). It runs during prerendering, so all of it is in the static HTML. Tags the previous page added are removed on navigation.
- JSON-LD is serialized with `<` escaped, so content can never close the script block.
- Titles come from content (home: name and headline; post: title and name; CV: name) through route resolvers that wait only for the snapshot.
- `scripts/generate-seo-files.mjs` runs after `ng build` and writes `sitemap.xml` (an index), one sitemap per language with `xhtml:link` alternates, and `robots.txt` (Allow all, Disallow `/admin`). The site address comes from `apps/web/src/site.config.json`, set with `node scripts/set-site-url.mjs https://...` (https only, except localhost). Phase 6 sets it from the deployment URL.
- A post without a translation in the requested language shows the English text with a visible note, and its `lang` and `dir` attributes describe the language actually shown.
- Unknown post addresses show a "not found" view and are `noindex`.

## Consequences

Content changes go live by rerunning the snapshot and build (a deploy hook, Phase 6). The site address must be set before deploying or canonical URLs point at localhost.
