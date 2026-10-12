# 22. Empty sections are hidden from navigation

Status: accepted.

## Context

The home page already skipped the experience, skills, projects and testimonials sections when their list was empty, but the header, the mobile menu and the Ctrl+K palette always offered every section and the blog. On the live site the Projects and Blog entries led to nothing: a fragment with no target and an empty blog page. The content is real (no invented data), so a section with no published items is normal, not a bug to fill with placeholders.

## Decisions

- **One rule for the page and the navigation.** `visibleSections()` in `core/sections.ts` says which home sections have something to show; `ContentStore.sections` exposes it. About and contact always render; experience, skills, projects and testimonials ("kind") need at least one published item. The header, the mobile menu and the palette list only those sections.
- **The blog follows the same rule.** `ContentStore.hasPosts` hides the Blog link and its palette command until a post is published.
- **It is driven by the content the page renders.** At prerender that is the build-time snapshot taken from the API, so the shipped HTML has no empty links; in the browser it follows the live refresh, so a section published since the last deploy appears without a rebuild (and one emptied since disappears).
- **The blog route stays, out of search.** `/:lang/blog` is still prerendered so an old link does not 404, but while it has no posts it carries `noindex` and is left out of the sitemaps (`pagesFromSnapshot`).

## Consequences

- Publishing the first project, testimonial or post in the back-office brings its menu entry back; no code change is needed.
- A new list-backed section must add its predicate to `SECTION_DATA` next to the `@if` that guards it on the home page.
