# 11. Design system and RTL rules

Status: accepted

## Decision

- **Tailwind CSS 4 with custom components only** (no UI kit, no Angular CDK). Semantic tokens (`--bg`, `--fg`, `--accent`, ...) are CSS variables mapped through `@theme inline`; light and dark differ only by a `data-theme` attribute. `index.html` applies the saved or system theme before first paint. Accent colors were chosen for WCAG 2.2 AA contrast in both themes.
- **Logical properties only.** Layout uses `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, `text-start`, `rounded-s/e`, `border-s/e` and `rtl:` variants. `scripts/logical-props.mjs` fails `pnpm lint` on `ml-`, `mr-`, `left-`, `text-left`, `margin-left` and similar (with a documented `rtl-ok` escape hatch). Directional icons carry `[mirror]="true"`, which flips them in RTL.
- **Direction-aware motion.** `--dir-sign` is `1` or `-1` per `dir`, and animations such as `reveal` read it. All animation is disabled under `prefers-reduced-motion`.
- **Self-hosted fonts** from npm (`@fontsource/ibm-plex-sans` and `-arabic`), only the Latin and Arabic subsets and weights 400/500/600. The families share a design, and the font stack falls through per glyph. Arabic gets taller line-height and a slightly larger size.
- **Intl.** `ar` formats with Latin digits (`ar-u-nu-latn`), so numbers, dates and Latin product names mix cleanly with Arabic text; `fr-FR` and `en-GB` for the others. Sorting uses `Intl.Collator`. Code and Latin snippets are isolated with `unicode-bidi: isolate`.
- **Accessibility baseline.** Skip link, landmarks, 44px touch targets, visible focus ring, native `<dialog>` for the command palette (focus trap and Esc from the browser), and `angular-eslint` template accessibility rules in lint.

## Consequences

Arabic numerals are an editorial choice; switching to Arabic-Indic digits is a one-line change in `INTL_TAGS`. Hardcoded left/right needs an explicit, reviewed exception.
