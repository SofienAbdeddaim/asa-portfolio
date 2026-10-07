# 1. Monorepo with pnpm workspaces

Status: accepted

## Context

The web app, API and shared types evolve together. Shared types (`{ fr, en, ar }` fields, locale constants) must not drift.

## Decision

One repository, pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`. No extra orchestrator (Nx/Turborepo): `pnpm -r` is enough at this size.

## Consequences

Single lockfile, one CI pipeline, atomic cross-package changes. If build times grow, revisit with a task runner via a new ADR.
