# 3. Conventions and quality gates

Status: accepted

## Decision

- Conventional Commits enforced locally (husky `commit-msg` + commitlint) and in CI on PRs.
- `lint-staged` runs ESLint and Prettier on staged files (husky `pre-commit`).
- `any` is an ESLint error; a justified `eslint-disable-next-line` comment is the only escape.
- Unit test coverage threshold: 70% (lines, functions, branches, statements) per package.
- English only for code, comments, commits and docs.

## Consequences

CI (`ci.yml`) runs format check, lint, typecheck, tests with coverage, and build on every PR and push to `main`. Release automation (release-please) arrives in Phase 6.
