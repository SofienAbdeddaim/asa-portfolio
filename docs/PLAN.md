# Plan

Status legend: [x] done, [~] in progress, [ ] todo.

- [~] **Phase 0** – repo foundations, tooling, conventions, ADRs, CI skeleton, concepts (awaiting concept choice and "go")
- [ ] **Phase 1** – API core: NestJS modules, Mongoose schemas, auth + TOTP 2FA, CRUD, OpenAPI, tests, fake seed, Docker Compose
- [ ] **Phase 2** – Angular foundations: routing, Transloco, RTL, tokens, layout, theme, shared components
- [ ] **Phase 3** – public pages implementing the chosen concept
- [ ] **Phase 4** – back-office: auth screens, 2FA enrollment, CRUD, ordering, uploads, Markdown editor
- [ ] **Phase 5** – CV route/PDF, blog, content snapshot, prerendering, SEO
- [ ] **Phase 6** – full CI/CD (e2e, security, lighthouse, release, deploy), previews, docs
- [ ] **Phase 7** – hardening: accessibility audit, Lighthouse budgets, security review, README polish

## Decisions pending

- Creative concept (A/B/C, see `CONCEPTS.md`) before Phase 3.
- CV PDF: print-CSS baseline; server-side PDF only if Arabic shaping and memory are verified (ADR in Phase 5).
