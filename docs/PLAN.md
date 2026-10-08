# Plan

Status legend: [x] done, [~] in progress, [ ] todo.

- [x] **Phase 0** – repo foundations, tooling, conventions, ADRs, CI skeleton, concepts
- [x] **Phase 1** – API core: NestJS modules, Mongoose schemas, auth + TOTP 2FA, CRUD, OpenAPI, tests, fake seed, Docker Compose
- [x] **Phase 2** – Angular foundations: routing, Transloco, RTL, tokens, layout, theme, shared components
- [x] **Phase 3** – public pages: hero, about, experience timeline, skills, projects, testimonials, contact; redesigned as the "sticker book" identity (ADR 12), plus an interactive playground (ADR 13)
- [x] **Phase 4** – back-office: sign-in with 2FA enrollment and recovery codes, generic CRUD for all content, drag/keyboard ordering, drafts, translation completeness, image upload (WebP, GridFS), Markdown editor with sanitized preview (ADR 14, docs/BACKOFFICE.md)
- [x] **Phase 5** – blog (list and posts, sanitized Markdown, prerendered), print-ready CV per language (ADR 15), snapshot pipeline with images (`pnpm snapshot`), sitemaps/robots, per-locale SEO and JSON-LD (ADR 16)
- [x] **Phase 6** – CI/CD: pinned-action workflows (ci, e2e, security, lighthouse, release, deploy, previews, keep-warm), Playwright suite against the real stack, Lighthouse budgets, Netlify + Render + Atlas deployment, branch-protection ruleset, README with architecture diagram and screenshots (ADR 17, docs/DEPLOYMENT.md, docs/TESTING.md)
- [ ] **Phase 7** – hardening: accessibility audit, Lighthouse performance to the 90 target (mid-80s on the home pages and 72–84 on the Arabic one, see ADR 17), security review, README polish

## Decisions pending

- ~~Creative concept~~ chosen: B, Living Timeline (ADR 6).
