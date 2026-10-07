# 13. Interactive playground (inspired by Bruno Simon, Neal.fun, Cassie Codes)

Status: accepted

## Context

A review of well-known developer portfolios (the WeAreDevelopers list) shows that the memorable ones make visiting an activity: driving a car, toggling a lamp, a small game. Of the ideas that fit this stack (RTL, WCAG 2.2 AA, free hosting, Lighthouse budget), the owner chose the interactive playground. Other ideas from the same review (a lamp theme toggle, switchable skins, case-study pages with filters) are not built yet and remain candidates.

## Decision

A "Play" section on the home page with two optional pieces:

- **Sticker board.** The skills become draggable stickers. Each is a real `<button>`: drag with a pointer (it keeps momentum and bounces off the walls) or focus it and use the arrow keys (Shift moves further). Momentum is skipped under `prefers-reduced-motion`. The board is an explicit `dir="ltr"` box because it works in physical coordinates, so it behaves the same in every language.
- **"Draw a perfect circle".** The stroke is resampled evenly and scored from 0 to 100 on how constant the distance to its center is, with penalties for an unclosed loop and for spiraling. Strokes that are too short or do not go around are explained, not scored. The ideal circle is drawn over the stroke for comparison, and a good score throws confetti. The scoring is a pure, tested function (`core/circle-score.ts`). The best score is a per-viewer convenience in `localStorage`, never required.
- **Cost and access.** Both pieces sit behind `@defer (on viewport; prefetch on idle)`, so they add nothing to the initial load. The game is pointer-based by nature, so the section says it is entirely optional; the canvas has a text alternative and results are announced through a live region.

## Consequences

The section adds one lazy chunk and no dependencies. A keyboard-only alternative for the game is not provided, because drawing is the point; the sticker board covers keyboard users with real controls.
