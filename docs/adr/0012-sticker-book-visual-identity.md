# 12. Visual identity: "Sticker book" with a scroll-drawn timeline

Status: accepted (supersedes the palette, fonts and component look of ADR 11; its RTL, accessibility and logical-property rules still apply)

## Context

The first foundation design (calm teal on warm paper) read as generic. The brief asks for an original, memorable portfolio, and the owner chose the "bold and playful" direction.

## Decision

- **Look.** Cream paper with a dot grid, thick ink outlines, hard offset shadows, saturated sticker colors (coral, sun, mint, sky, lilac, pink) and oversized display type. Every sticker color carries fixed dark ink text (contrast 6.9:1 or better), so text color never depends on the theme. Dark mode is a deep violet stage with the same stickers.
- **Type.** Display: Bricolage Grotesque (variable, Latin) with Lalezar for Arabic headings; body: IBM Plex Sans and Plex Sans Arabic. Lalezar has one weight, so headings in Arabic disable font synthesis and use more line-height. Latin names inside Arabic pages are isolated as `dir="ltr"` boxes so letters never reverse.
- **Direction-aware by construction.** Shadows, tilts, reveals, the marquee and the timeline read `--dir-sign`, so everything falls and travels toward the reading direction. The timeline is a CSS grid whose columns mirror on their own.
- **Motion budget.** All decorative motion is CSS (keyframes, `animation-timeline: view()/scroll()` as progressive enhancement) or tiny, lazy, optional scripts: reveal-on-scroll, pointer tilt (fine pointers only), confetti (Web Animations, loaded on demand), and a View Transition circle for theme changes. `prefers-reduced-motion` disables all of it, and the marquee becomes a static wrapped list.
- **Safe by default.** Server-rendered content is always visible; the reveal directive only hides elements that start below the fold after hydration. No effect depends on JavaScript for content or navigation.
- **Content flows from one snapshot.** Prerendering reads `public/content-snapshot.json` from disk and passes it to the browser through TransferState, so pages are fully static and hydrate without an extra request. `pnpm --filter @asa/api snapshot:demo` regenerates the fake demo snapshot offline.

## Consequences

The look is deliberately loud; it is controlled by a handful of tokens in `styles.css` and the `.sticker`, `.btn`, `.chip` classes, so a calmer variant is a token change. Per-section colors are assigned in each section component.
