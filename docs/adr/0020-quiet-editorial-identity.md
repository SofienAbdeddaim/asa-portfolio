# 20. Visual identity: "Quiet editorial" with one orchestrated entrance

Status: accepted (supersedes the look, fonts and motion of ADR 12, and ADR 13, whose playground is removed; the RTL, accessibility and logical-property rules of ADR 11 and 12 still apply)

## Context

The "sticker book" identity (ADR 12) was memorable, but it worked against the site's main reader: a recruiter or a client looking for a senior Tech Lead. Thick outlines, tilted stickers, a spinning ring and a playground read as playful rather than senior, the first screen said "Hi, I'm" instead of the job, and self-rated skill dots invited argument. The owner compared the live site with a mockup of a calmer direction and chose the calmer one, with tasteful animation, and asked to remove everything that only served the old look.

## Decision

- **Look.** Neutral paper (`#f6f6f3`, dark `#0f1115`), one ink, one accent blue, hairline borders instead of outlines and offset shadows. The favicon's turquoise-to-violet gradient appears only as a thin line (top of the key-figures card, the timeline rail, the scroll progress bar). Tokens live in `styles.css`; components are `.card`, `.btn` (+ `.btn-primary`, `.btn-ghost`), `.chip`, `.eyebrow`, `.section`/`.section-grid`, `.nav-link`, `.timeline`.
- **Type.** Display: Schibsted Grotesk (variable, Latin). Body: IBM Plex Sans. Labels and dates: IBM Plex Mono. Arabic uses IBM Plex Sans Arabic for everything (Lalezar is dropped), which also makes Arabic pages download less.
- **Content first.** The first screen states the headline, a one-sentence pitch (the first sentence of the bio) and key figures computed from the published experience (years since the first role, number of roles, distinct technologies) with the current role. Nothing is hard-coded, so the figures follow the back-office. Sections use a label column beside the content. Skills are plain lists: level 5 items are emphasized and listed first, no rating widget. Experience is a compact list with the role details folded in a native `<details>`.
- **Motion budget.** One orchestrated moment on load: the name rises line by line out of a mask, the rest fades up in sequence, the figures count up and the gradient line draws. After that, only quiet details: underlines that draw from the reading start, a nudging button arrow, a pointer-following halo on the figures card, and a timeline rail that fills (and dots that light) as it scrolls by, with `animation-timeline: view()` as progressive enhancement. The theme-change circle (View Transitions) stays. Everything sits behind `prefers-reduced-motion`; resting states are final states, so content is complete without JavaScript.
- **Removed.** The playground (draggable stickers, draw-a-circle game and its scorer), confetti and its palette command, the pointer tilt, the skills marquee, the spinning ring, the per-section colors and the cartoon header logo (`logo.svg`, `logo-dark.svg`). The header now shows the favicon chip with the owner's name.

## Consequences

The home page is about half as tall (about 5,700 px instead of 12,000 px at 1440 px wide with the real content). The look depends on spacing and type more than on color, so new UI should reuse the tokens and components above instead of adding colors. The figures card needs at least one published experience; without one it is not shown.
