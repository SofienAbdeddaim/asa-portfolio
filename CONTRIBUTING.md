# Contributing

This is a personal portfolio, but it is built like a product and outside suggestions are welcome.

## Before you start

- Read [AGENTS.md](AGENTS.md) (the conventions in short) and the [ADRs](docs/adr) for the reasoning behind the architecture.
- For anything larger than a fix, open an issue first so we can agree on the approach.

## Set up

```bash
nvm use && pnpm install
cp .env.example .env     # fill in the secrets; see the comments in the file
docker compose up -d mongo
pnpm --filter @asa/api dev
pnpm --filter @asa/web start
```

## Rules

- English only in code, comments, commits and docs. The site's content is French, English and Arabic.
- Conventional Commits (`feat(web): …`). The pull request title follows the same format: it becomes the commit message.
- Layout uses logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `left` or `right`, so Arabic mirrors correctly. `pnpm lint` enforces it.
- TypeScript strict. No `any` without a comment saying why.
- No secrets, no real personal data in the repository.
- Add or update tests with the change. `pnpm test` enforces 70% coverage; end-to-end tests are in [docs/TESTING.md](docs/TESTING.md).
- A significant decision gets an ADR in `docs/adr`.

## Before you open a pull request

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

The same checks run in CI, together with end-to-end tests, security scans and, for web changes, Lighthouse and a preview site.
