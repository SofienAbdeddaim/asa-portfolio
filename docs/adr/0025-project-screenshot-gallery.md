# 25. Project screenshots play as a gallery

Status: accepted.

## Context

Each project card showed one screenshot. The owner wants several per project, shown one after the other without having to click, and per language where a product exists in Arabic and English (ADR 24).

## Decisions

- **One `app-project-gallery` per card.** The screenshots for the page's language (its own ones first, then the ones meant for every language) are stacked in the 16:9 frame and cross-fade every second (first 4.5 seconds; the owner asked for a faster pace on 2026-11-26).
- **It only moves when it should.** It plays while it is on screen (IntersectionObserver) and the tab is visible, including under the pointer. It pauses when keyboard focus enters it (`:focus-visible`), when the viewer presses pause, or when a dot is picked (it jumps to that screenshot); the play button resumes it. Under `prefers-reduced-motion` it never moves by itself and the slides switch without a fade. Without IntersectionObserver or JavaScript it stays on the first screenshot.
- **Accessible as a carousel.** The frame is a labelled group (`aria-roledescription="carousel"`), the hidden slides are `aria-hidden`, the dots say "Screenshot n of total" and mark the current one, and the position is announced only once the viewer has taken control.
- **One timer at a time**, armed only while playing, so nothing ticks off screen and tests with fake timers stay finite.
- **No new colors.** The controls sit in a small pill on the surface color; the current dot uses the accent.

## Consequences

- A project with one screenshot looks as before, with no controls.
- Code links stay optional: leaving `repoUrl` empty removes the "Code" button, which the owner chose for every project.

## Update (2026-11-26)

Every project card now spans the full width, like the featured one, so each gallery shows large screenshots. The interval dropped to 1 second and the cross-fade to 0.3 seconds. The pause button and reduced-motion rule are unchanged, so the faster pace stays controllable.

## Update (2026-11-27)

With full-width cards, the gallery takes about two thirds of the screen height, so the pointer rests on the one being looked at, and the hover pause froze exactly that gallery. A mouse click on play or on a dot also left focus on the button, so the focus pause kept it frozen and play seemed broken. The gallery no longer pauses on hover, and only keyboard focus pauses it (WAI-ARIA carousel pattern: it resumes from the play button). The Spatium3D screenshots are now close-ups (3D model, floor plan, export screen) and the portfolio alternates dark and light theme captures, because near-identical screenshots made the changes hard to notice.
