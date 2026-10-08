# @asa/web

Angular 22 front end: standalone components, signals, Tailwind CSS 4, Transloco, static prerendering.

## Run

```bash
pnpm --filter @asa/web start     # http://localhost:4200, /api is proxied to http://localhost:3000
pnpm --filter @asa/web test      # Vitest via Angular, coverage threshold 70%
pnpm --filter @asa/web build     # static output in dist/web/browser (prerenders /en, /fr, /ar)
```

## Layout

| Path                           | Purpose                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/app/core`                 | Locale and RTL, i18n loader, theme, title strategy, content store, API interceptor                             |
| `src/app/layout`               | Language switcher, theme toggle, Ctrl+K command palette                                                        |
| `src/app/shared/ui`            | Button, icon (with RTL mirroring), skeleton                                                                    |
| `src/app/admin`                | The private back-office (lazy, client-only): sign-in, content editor, field components. See docs/BACKOFFICE.md |
| `src/app/pages`                | Route pages: home (the timeline of sections), blog list and post, CV, not found                                |
| `src/i18n`                     | `en.json`, `fr.json`, `ar.json`: keep the three files in sync                                                  |
| `public/content-snapshot.json` | Build-time content used when the API is asleep (the committed one is demo data; `pnpm snapshot` replaces it)   |

Static build and content (from the repo root):

```bash
API_URL=https://your-api.onrender.com pnpm snapshot   # pull content + images from the API
node scripts/set-site-url.mjs https://your-site.example # canonical URLs, sitemaps
pnpm --filter @asa/web build                            # prerender + sitemaps + robots.txt
```

See ADR 10 (architecture), ADR 11 (RTL rules), ADR 12 (visual identity) ADR 13 (playground) ADR 14 (back-office), ADR 15 (CV and PDF) and ADR 16 (SEO and the content pipeline).
