# Plan

Status legend: [x] done, [~] in progress, [ ] todo.

- [x] **Phase 0** – repo foundations, tooling, conventions, ADRs, CI skeleton, concepts
- [x] **Phase 1** – API core: NestJS modules, Mongoose schemas, auth + TOTP 2FA, CRUD, OpenAPI, tests, fake seed, Docker Compose
- [x] **Phase 2** – Angular foundations: routing, Transloco, RTL, tokens, layout, theme, shared components
- [x] **Phase 3** – public pages: hero, about, experience timeline, skills, projects, testimonials, contact; redesigned as the "sticker book" identity (ADR 12), plus an interactive playground (ADR 13)
- [x] **Phase 4** – back-office: sign-in with 2FA enrollment and recovery codes, generic CRUD for all content, drag/keyboard ordering, drafts, translation completeness, image upload (WebP, GridFS), Markdown editor with sanitized preview (ADR 14, docs/BACKOFFICE.md)
- [ ] **Phase 5** – CV route/PDF, blog, content snapshot, prerendering, SEO
- [ ] **Phase 6** – full CI/CD (e2e, security, lighthouse, release, deploy), previews, docs
- [ ] **Phase 7** – hardening: accessibility audit, Lighthouse budgets, security review, README polish

## Decisions pending

- ~~Creative concept~~ chosen: B, Living Timeline (ADR 6).
- CV PDF: print-CSS baseline; server-side PDF only if Arabic shaping and memory are verified (ADR in Phase 5).
