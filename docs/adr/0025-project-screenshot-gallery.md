# 25. Project screenshots play as a gallery

Status: accepted.

## Context

Each project card showed one screenshot. The owner wants several per project, shown one after the other without having to click, and per language where a product exists in Arabic and English (ADR 24).

## Decisions

- **One `app-project-gallery` per card.** The screenshots for the page's language (its own ones first, then the ones meant for every language) are stacked in the 16:9 frame and cross-fade every 4.5 seconds.
- **It only moves when it should.** It plays while it is on screen (IntersectionObserver) and the tab is visible, and stops while the pointer or the keyboard focus is on it. A pause button stops it for good, as do the dots (they jump to a screenshot). Under `prefers-reduced-motion` it never moves by itself and the slides switch without a fade. Without IntersectionObserver or JavaScript it stays on the first screenshot.
- **Accessible as a carousel.** The frame is a labelled group (`aria-roledescription="carousel"`), the hidden slides are `aria-hidden`, the dots say "Screenshot n of total" and mark the current one, and the position is announced only once the viewer has taken control.
- **One timer at a time**, armed only while playing, so nothing ticks off screen and tests with fake timers stay finite.
- **No new colors.** The controls sit in a small pill on the surface color; the current dot uses the accent.

## Consequences

- A project with one screenshot looks as before, with no controls.
- Code links stay optional: leaving `repoUrl` empty removes the "Code" button, which the owner chose for every project.
