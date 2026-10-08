# 18. Phase 7 hardening: performance, accessibility and security

Status: accepted

## Context

By the end of Phase 6 the site worked and was tested, but three things had only been looked at in passing: how fast it is on a slow phone, whether people using a keyboard or a screen reader can use it, and how the API stands up to a deliberate attack. This ADR records what the review found and what was decided.

## Performance

Measured with Lighthouse on mobile (simulated slow 4G, 4x slower CPU), median of three runs.

- **Incremental hydration.** Below the first screen, each home page section is pre-rendered as before but only becomes interactive (its code loads and Angular attaches to it) when it is about to be seen (`@defer (on immediate; hydrate on viewport)`). Blocking time on the English home page fell from about 265 ms to about 85 ms, and the page starts with 13 script files, the section code arriving as it is needed. Clicks made before a section is ready are replayed.
- **The Markdown parser stays out of the home page.** `markdownToText` is a few regular expressions, but it lived in the module that imports the Markdown parser and sanitizer, so the home page and the blog list downloaded 75 KB of libraries to build a meta description. It now has its own module.
- **Arabic fonts load on Arabic pages only** (a component declares them, because the build preloads every font in the global stylesheet), and only the regular and semibold weights are shipped: `font-medium` renders as semibold. About 210 KB less font data on English and French pages.
- **Rejected: starting the app after the first paint.** The idea was that the pre-rendered page paints before the framework starts. It made no difference to the score (Lighthouse still counts what downloaded before the paint) and raised blocking time, so it was removed.
- **A measurement fix, not a trick.** The Lighthouse server answers after 40 ms. On a zero-latency localhost, fonts and scripts finish before the browser has painted, which never happens on a real network, and Lighthouse's simulation counts them against the first paint (the observed first paint was 230 to 300 ms on every page while the simulated one was 2.6 to 3.6 s). A CDN is never 0 ms away. The setting is `latency` in `e2e/lighthouse-budgets.json`, applies to Lighthouse only, and `--latency 0` shows the other numbers.

Results, mobile, median of three runs (performance score, largest contentful paint, total blocking time), on the development machine when idle:

| Page                   | Performance | LCP   | TBT    | Phase 6 |
| ---------------------- | ----------- | ----- | ------ | ------- |
| `/en`                  | 93          | 2.6 s | 118 ms | 68      |
| `/fr`                  | 94          | 2.6 s | 100 ms | 70      |
| `/ar`                  | 85          | 3.3 s | 159 ms | 74      |
| `/en/blog`             | 96          | 2.3 s | 67 ms  | 81      |
| `/en/blog/hello-world` | 97          | 2.1 s | 155 ms | 77      |
| `/en/cv`               | 96          | 2.2 s | 117 ms | 82      |

Accessibility, best practices and SEO are 100 on every page. Without the 40 ms (`--latency 0`), the same build scores 82 to 93. Five of the six pages are at 93 or more; **`/ar` is at 85**, because its typography (Lalezar and IBM Plex Sans Arabic) needs about 140 KB of font files that the simulation counts before the first paint. Dropping a typeface would change the Arabic identity of the site, so it stays.

## Accessibility

- **axe-core in the end-to-end suite** checks WCAG 2.2 AA and best-practice rules on every public page in the three languages and both themes, on the open command palette and mobile menu, on the sign-in, two-factor enrollment and recovery-code pages, and on every back-office page, the editor with validation errors showing and the delete dialog. A test checks that the audit does fail on a page with known problems.
- **Found and fixed:** the hero name used `aria-label` on a `span` (prohibited): it now has a visually hidden full name and the animated letters are hidden from assistive technology. Single-page navigations moved no focus and announced nothing: after a page change focus now moves to the new heading, and a language switch (which deliberately keeps the page and the reader's place) is announced in the new language.
- **Keyboard and layout tests:** the skip link; every control reachable by Tab with a visible focus indicator and no focus trap (English and Arabic); arrow-key movement of the stickers; the command palette returning focus; reflow at 320 px on seven pages; text spacing; forced-colours mode keeping borders and focus.

## Security

A read of the whole API against the usual list (authentication, sessions, input, uploads, headers, logging, container, pipeline) found the design sound and these gaps, all fixed:

- Wrong second-factor codes did not count towards the lockout, so someone with the password could guess codes at the rate limit forever. They now do, counted apart from passwords.
- Recovery codes (40 bits) were stored as plain SHA-256, guessable offline from a leaked database. They are now HMACs under a key kept outside the database.
- Signing out deleted a session knowing only its id. It now needs the secret.
- A session could be renewed indefinitely. It now ends 30 days after the second-factor sign-in.
- Sign-in and back-office responses are `Cache-Control: no-store`.
- Input keys like `__proto__` are stripped with the Mongo operators.
- The public content snapshot (read on every page load, a dozen queries) is held for 5 seconds and cleared by any write, so a flood cannot exhaust the free database's 100 operations a second.
- There was no way back in after losing the authenticator. The `admin` CLI (`unlock`, `reset-2fa`, `set-password`, `revoke-sessions`) is run by someone with database access, never over HTTP.
- The free database has no backups. The `backup` CLI exports and restores everything the back-office holds (drafts and images included, accounts excluded); a restore into a fresh database is tested.
- The container image carried a Debian CRITICAL fix and four HIGH findings in npm's own dependencies. The runtime image now upgrades its OS packages and drops npm, corepack and yarn; a scan runs in CI.
- The Netlify token was visible to every step of the deploy jobs, including dependency installs. It now reaches only the publish step.

Black-box probes through the site's own `/api` check the result from outside: API documentation is not published, cross-origin writes are refused, operators, extra fields and oversized bodies are rejected, errors do not leak internals, private responses are uncacheable, and hostile uploads (SVG, HTML or a script named `.png`, a PDF, a truncated image, 6 MB) are refused.

**Considered and not done:** Trusted Types (small gain, ongoing policy maintenance); self-service password change or reset (more attack surface for one user); CAPTCHA (nothing free that is also private). The accepted limits are listed in [docs/SECURITY.md](../SECURITY.md).

## Consequences

- The end-to-end suite grows from 26 to 89 tests and takes under three minutes.
- Lighthouse budgets are set below measured values with room for the noise of shared CI machines (0.85, and 0.75 for `/ar`).
- Anything new on the home page below the first screen should sit in a `@defer (hydrate on viewport)` block, and new public routes must not import the Markdown renderer unless they render Markdown.
- `font-medium` is semibold, and `/ar` stays the slowest page because its typography needs about 140 KB of Arabic fonts.
