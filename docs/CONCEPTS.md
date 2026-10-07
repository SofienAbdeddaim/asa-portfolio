# Creative concepts (choose one)

All three work fully in RTL, are keyboard accessible (WCAG 2.2 AA), respect `prefers-reduced-motion`, target Lighthouse mobile performance above 90, and keep any heavy effect lazy-loaded and optional.

## A. Terminal Shell

A page-as-terminal. Sections are "commands" (`about`, `projects`, `ls skills`) typed or picked from the Ctrl+K palette. Output renders as styled, real HTML content, not a canvas, so it stays accessible and SEO-friendly. A plain scrolling layout is the no-JS and reduced-motion baseline.

- **RTL:** prompt, caret and output flow mirror. Commands and code stay LTR-isolated (`dir="ltr"` islands, `unicode-bidi: isolate`) inside RTL text, so mixed Arabic/English lines are the hard, interesting part.
- **Risk:** monospace Arabic is weak; Arabic output uses the proportional Arabic font.

## B. Living Timeline

A career timeline is the whole site: scrolling moves through experiences, projects and certificates, with skills "growing" as branches over time. Scroll-driven CSS animations, no heavy library.

- **RTL:** the time axis direction mirrors (time flows right-to-left in `ar` when horizontal), branches and connectors flip via logical properties; animations are direction-aware.
- **Risk:** long scroll narratives hurt skimmability; mitigated with a section index and Ctrl+K jump.

## C. Mission Control

A dashboard of panels (status, availability, stack "telemetry", project "missions", activity log) that reads like an operations console. Panels form a responsive grid; each opens a focused detail view. An optional lazy-loaded WebGL/canvas globe or star-field adds depth.

- **RTL:** grid, panel order, gauges and sparklines mirror; numeric readouts stay LTR-isolated with `Intl` formatting per locale.
- **Risk:** dense UI can fail on small screens; mobile collapses to a stacked list of panels.

## Recommendation

**B (Living Timeline)** gives the strongest story for recruiters, the cheapest performance profile, and the most visible RTL craftsmanship. **A** is the most memorable for engineers; **C** is the most visual but the heaviest.
