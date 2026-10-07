# 2. Toolchain versions: Node 24 LTS, TypeScript 6.0, pnpm 12

Status: accepted

## Context

Latest stable Angular (22.x) requires Node `^22.22.3 || ^24.15.0 || >=26` and TypeScript `>=6.0 <6.1`. `typescript-eslint` supports TypeScript `<6.1`. TypeScript 7 exists on npm but is incompatible with both.

## Decision

- Node 24 LTS (`.nvmrc`, `engines`), pnpm 12 pinned through `packageManager`.
- TypeScript `~6.0.0` across the whole monorepo (single version).
- ESLint 10 flat config + typescript-eslint, Prettier, Vitest.

## Consequences

Upgrade TypeScript only when Angular and typescript-eslint both support it. Dependabot (Phase 6) groups updates to respect this.
