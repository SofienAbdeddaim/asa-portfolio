# @asa/web

Angular 22 front end: standalone components, signals, Tailwind CSS 4, Transloco, static prerendering.

## Run

```bash
pnpm --filter @asa/web start     # http://localhost:4200, /api is proxied to http://localhost:3000
pnpm --filter @asa/web test      # Vitest via Angular, coverage threshold 70%
pnpm --filter @asa/web build     # static output in dist/web/browser (prerenders /en, /fr, /ar)
```

## Layout

| Path                           | Purpose                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `src/app/core`                 | Locale and RTL, i18n loader, theme, title strategy, content store, API interceptor |
| `src/app/layout`               | Language switcher, theme toggle, Ctrl+K command palette                            |
| `src/app/shared/ui`            | Button, icon (with RTL mirroring), skeleton                                        |
| `src/app/pages`                | Route pages (a foundations preview until the timeline lands)                       |
| `src/i18n`                     | `en.json`, `fr.json`, `ar.json`: keep the three files in sync                      |
| `public/content-snapshot.json` | Build-time content used when the API is asleep (generated later)                   |

See ADR 10 (architecture) and ADR 11 (design system and RTL rules).
