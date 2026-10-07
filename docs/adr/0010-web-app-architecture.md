# 10. Web app architecture: static prerender, locale-prefixed routes, bundled translations

Status: accepted

## Decision

- **Static output.** Angular 22 builds with `outputMode: "static"`: public routes are prerendered per locale at build time and served as plain files (Netlify). There is no Node SSR server to host, and a sleeping free-tier API cannot break page loads. The API is only needed for the live refresh and the back-office.
- **Routes.** `/:lang/**` with a `localeGuard` that validates the locale, loads its translations and sets `lang`/`dir` on `<html>` before the page renders (so the prerendered HTML is already correct). Unknown first segments go to `/en/404`. `/admin` is outside the locale prefix and lazy-loaded. `/` redirects to the default locale (a host-level redirect with language detection is added at deploy time).
- **Translations are bundled lazy chunks** (`import('./i18n/ar.json')`), not HTTP-fetched, so they resolve during prerendering and cost one small request per language.
- **Language switcher = real links.** They are computed from the current URL (`switchLocaleUrl`), work without JavaScript, and keep query and fragment. Because the route configuration is identical, Angular reuses the page component, and `ScrollService` skips the scroll-to-top for a pure language change, so the reader keeps their place.
- **Titles** come from a `PageTitleStrategy` that translates a `titleKey` route datum in the active language.
- **Content** is `ContentStore`: it renders from the build-time `content-snapshot.json` first, then upgrades from `/api/content`, and reports `stale` (a polite notice) when the API does not answer within 5 seconds. Prerendering never calls the API.
- **Sessions** use httpOnly cookies. `authRefreshInterceptor` refreshes once on a 401 (single flight) and replays the request; there is no token handling in the browser. `ng serve` proxies `/api` to the API, so development is same-origin like production.

## Consequences

Everything public is static and cacheable. The back-office is a client-rendered island. A new public route needs a `ServerRoute` entry to be prerendered.
