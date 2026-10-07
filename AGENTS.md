# AGENTS.md

Personal portfolio monorepo (FR/EN/AR, true RTL) with a private back-office. Owner: Sofien Abdeddaim.

## Layout

- `apps/web` Angular app (Phase 2+), `apps/api` NestJS API (Phase 1+), `packages/shared` shared TS types and constants (`@asa/shared`)
- `docs/adr/` decisions, `docs/PLAN.md` phase status, `docs/CONCEPTS.md` design concepts

## Commands

- `pnpm install`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Web: `pnpm --filter @asa/web start` (proxies /api to :3000), tests with `pnpm --filter @asa/web test`.
- API: `docker compose up -d mongo`, `pnpm --filter @asa/api dev|seed:admin|seed:demo` (see `apps/api/README.md`).
- Requires Node `^22.22.3 || >=24.15` (see `.nvmrc`) and pnpm via `packageManager`.

## Conventions

- English only (code, comments, commits, docs). Conventional Commits (commitlint enforced).
- TypeScript strict; no `any` without a justified disable comment. No abandoned dependencies.
- Layout uses logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rtl:`), never hardcoded left/right. `pnpm lint` enforces it (`scripts/logical-props.mjs`, escape hatch: `rtl-ok`).
- Web: standalone components, signals, OnPush, `app-` selectors; user-visible text goes through Transloco keys in all three `src/i18n/*.json` files.
- Translatable fields are `{ fr, en, ar }`; English is required and is the fallback.
- API: no reliance on `emitDecoratorMetadata` (explicit `@Inject`, `ValidBody(Dto)`; ADR 7).
- Tokens never in localStorage (httpOnly cookie). No secrets or default credentials committed; use `.env` (see `.env.example`).
- No invented personal data: placeholders or clearly fake seed data.
- Significant decisions get an ADR in `docs/adr/`. Deviation from the fixed stack requires one.

## Definition of done

Lint, format check, typecheck, tests (coverage >= 70%) and build all pass; docs and `PLAN.md` updated; ADR added if a decision was made; committed with a Conventional Commit.

## Workflow

Work phase by phase (see `docs/PLAN.md`). Stop at the end of each phase and wait for "go".
