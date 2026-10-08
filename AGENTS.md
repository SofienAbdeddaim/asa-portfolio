# AGENTS.md

Personal portfolio monorepo (FR/EN/AR, true RTL) with a private back-office. Owner: Sofien Abdeddaim.

## Layout

- `apps/web` Angular app (Phase 2+), `apps/api` NestJS API (Phase 1+), `packages/shared` shared TS types and constants (`@asa/shared`)
- `docs/adr/` decisions, `docs/PLAN.md` phase status, `docs/CONCEPTS.md` design concepts

## Commands

- `pnpm install`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Web: `pnpm --filter @asa/web start` (proxies /api to :3000), tests with `pnpm --filter @asa/web test`.
- API: `docker compose up -d mongo`, `pnpm --filter @asa/api dev|seed:admin|seed:demo` (see `apps/api/README.md`). Recovery and backups: `pnpm --filter @asa/api admin|backup`.
- E2E: `pnpm build` then `pnpm e2e` (needs MongoDB; Playwright, real stack, throwaway `*_e2e` DB). Quality budgets: `pnpm lighthouse`. See `docs/TESTING.md`.
- Content/deploy: `pnpm snapshot` (needs `API_URL`), `pnpm site:url <url>`; deployment is done by GitHub Actions (`docs/DEPLOYMENT.md`), never from a laptop.
- Workflows pin third-party actions by commit SHA (Dependabot updates them); keep it that way and keep `permissions` minimal.
- Requires Node `^22.22.3 || >=24.15` (see `.nvmrc`) and pnpm via `packageManager`.

## Conventions

- English only (code, comments, commits, docs). Conventional Commits (commitlint enforced).
- TypeScript strict; no `any` without a justified disable comment. No abandoned dependencies.
- Layout uses logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rtl:`), never hardcoded left/right. `pnpm lint` enforces it (`scripts/logical-props.mjs`, escape hatch: `rtl-ok`).
- Back-office: add content fields in `apps/web/src/app/admin/resources.ts` (one data entry drives list, form and payload; keep limits equal to the API DTOs). Render Markdown only through `renderMarkdown` (sanitized).
- Home page sections below the first screen go in `@defer (on immediate; hydrate on viewport)`; routes that do not render Markdown must not import `core/markdown` (use `core/markdown-text`); only regular and semibold font weights are shipped (`font-medium` is semibold); Arabic fonts load from `ArabicFonts` only.
- Accessibility is tested (axe on every page, keyboard walk, reflow): new pages or dialogs need a case in `e2e/tests/a11y*.spec.ts`; page changes move focus through `RouteFocusService`.
- Public pages set their metadata through `SeoService` and get content-dependent titles from route resolvers; new public routes need a `ServerRoute` entry (and a sitemap path in `scripts/seo-lib.mjs`) to be prerendered and listed. Server-side DOM is minimal: use `appendChild`, not `append`.
- Web visuals: reuse `.sticker`, `.btn`, `.chip` and the color tokens (ADR 12); shadows, tilts and slides read `--dir-sign`; any new motion must sit behind `prefers-reduced-motion` and keep content visible without JS.
- Web: standalone components, signals, OnPush, `app-` selectors; user-visible text goes through Transloco keys in all three `src/i18n/*.json` files.
- Translatable fields are `{ fr, en, ar }`; English is required and is the fallback.
- API: anything that guards the admin (lockouts, hashes, sessions) needs a test in `apps/api/test/auth*.spec.ts`; private routes are `Cache-Control: no-store`; secrets and recovery codes are never logged or printed.
- API: no reliance on `emitDecoratorMetadata` (explicit `@Inject`, `ValidBody(Dto)`; ADR 7).
- Tokens never in localStorage (httpOnly cookie). No secrets or default credentials committed; use `.env` (see `.env.example`).
- No invented personal data: placeholders or clearly fake seed data.
- Significant decisions get an ADR in `docs/adr/`. Deviation from the fixed stack requires one.

## Definition of done

Lint, format check, typecheck, tests (coverage >= 70%) and build all pass; docs and `PLAN.md` updated; ADR added if a decision was made; committed with a Conventional Commit.

## Workflow

Work phase by phase (see `docs/PLAN.md`). Stop at the end of each phase and wait for "go".
