# Testing

Four layers, from fast to realistic. `pnpm test` runs the first two; the others have their own commands.

| Layer              | Tool                                                           | What it proves                                                                                                                           | Command             |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Scripts            | `node:test`                                                    | the build tooling: logical-property lint, snapshot, sitemaps, Netlify redirects and headers                                              | part of `pnpm test` |
| Unit and component | Vitest (API on esbuild, web on the Angular builder with jsdom) | services, guards, forms, pages, the Markdown sanitizer; the API's HTTP layer with mocked models. Coverage thresholds of 70% are enforced | `pnpm test`         |
| End to end         | Playwright                                                     | the whole stack as a visitor and as the admin                                                                                            | `pnpm e2e`          |
| Quality budgets    | Lighthouse                                                     | performance, accessibility, best practices and SEO on mobile                                                                             | `pnpm lighthouse`   |

## End to end

The suite in [e2e](../e2e) tests what users get, not an approximation of it:

- **The site** is the production build, served by `e2e/serve.mjs`, a small static server that applies the generated `_redirects` and `_headers` exactly as Netlify does (language redirect, `/api` proxy, 404 shell, CSP with script hashes, compression).
- **The API** is the compiled `apps/api/dist`, on port 3100, against a throwaway database `portfolio_e2e`. The reset script refuses any database whose name does not end in `_e2e`.
- **The browser** is the installed Google Chrome locally and the Chromium that Playwright installs in CI.

### Run it

```bash
docker compose up -d mongo          # or any MongoDB on 127.0.0.1:27017
pnpm build                          # the API and the web app (once, and after code changes)
pnpm --filter @asa/e2e exec playwright install chromium   # CI only; locally Chrome is used
pnpm e2e
```

Set `MONGODB_URI` to use another database (it must end in `_e2e`). Reports and traces of failures land in `e2e/playwright-report` and `e2e/test-results`: open one with `pnpm --filter @asa/e2e exec playwright show-report`.

### What is covered

- **Public** (`public.spec.ts`, `language.spec.ts`): each language renders with the right `lang` and `dir`; no console errors or CSP violations; language detection on `/`; localized 404s with a real 404 status; the blog and sanitized Markdown; the CV in print; sitemaps, `robots.txt`, security headers; switching language keeps the reader's place and mirrors the layout; the command palette; theme persistence; reduced motion.
- **Sign-in** (`auth.setup.ts`, `auth.spec.ts`): the first sign-in enrolls two-factor authentication with a real authenticator code and shows ten recovery codes; wrong codes are refused; cookies are `httpOnly` and `SameSite=Strict` and nothing is kept in web storage; a recovery code works exactly once; signing out ends the session.
- **Back-office** (`admin.spec.ts`): creating a post with validation, a Markdown preview that strips scripts, an image upload converted to WebP, publishing, seeing it on the public site, reordering, the unsaved-changes guard and a confirmed delete.
- **Accessibility** (`a11y.spec.ts`, `a11y-admin.spec.ts`, and the two sign-in setup pages): axe-core with WCAG 2.2 AA and best-practice rules on every public page in three languages and two themes, the open palette and mobile menu, and every back-office page, form and dialog. A test proves the audit fails on a page with known problems.
- **Keyboard and layout** (`keyboard.spec.ts`): the skip link, a Tab walk through the whole page with a visible focus indicator on every stop and no trap (English and Arabic), arrow-key movement of the stickers, the palette returning focus, focus moving to the new heading after a page change and a language switch being announced, reflow at 320 px, text spacing, forced-colours mode.
- **Security probes** (`security.spec.ts`, `security-admin.spec.ts`): from outside, through the site's `/api`: documentation not published, cross-origin writes refused, operators and extra fields and oversized bodies rejected, errors that do not leak internals, private responses uncacheable, hostile uploads refused.
- **Backup** (`backup.spec.ts`): exports a database with a draft and an image, restores it into a fresh one, and checks ids, dates, image bytes, that accounts do not travel, and that a second restore refuses to merge.

### Rules of the suite

- No retries and one worker. The API limits sign-in to five attempts a minute, and the suite is written to stay under it; a retry would hide a real flake or trip the limit.
- Tests are independent of the demo data's wording where they can be, and they clean up what they create.
- A test never signs in with a shared account: the admin is created by the run itself, with a random password, and nothing is stored in the repository.

## Lighthouse

`pnpm lighthouse` serves the built site with `e2e/serve.mjs` (the API answered from the content snapshot), measures each page in `e2e/lighthouse-budgets.json` three times as a mobile device on a throttled connection, and compares the median with the budgets. The server answers after 40 ms (`latency` in the budgets file; `--latency 0` for none), as a CDN would: on a zero-latency localhost resources finish before the first paint, which no real visitor sees, and Lighthouse's simulation counts them against it ([ADR 18](adr/0018-hardening.md)). Reports are written to `.lighthouseci/`; open one in a browser to see what to fix. Use `--pages en,ar --runs 1` for a quicker look. A run that Chrome fails to record (it happens) is repeated and does not count.

Scores move by several points between runs and with the machine's load: do not measure while something else is busy, and treat the budgets as guards against regressions, not as exact targets. Where the budgets stand today and why is in [ADR 17](adr/0017-ci-cd-and-deployment.md) and [ADR 18](adr/0018-hardening.md).
