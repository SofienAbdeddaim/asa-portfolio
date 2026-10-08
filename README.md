# ASA Portfolio

Trilingual (French, English, Arabic with true RTL) personal portfolio with a private back-office, built as a showcase of architecture, security and CI/CD.

> Status: Phase 5 done (public site with blog and CV, API, back-office, SEO). See [docs/PLAN.md](docs/PLAN.md), [docs/BACKOFFICE.md](docs/BACKOFFICE.md), [apps/api](apps/api/README.md) and [apps/web](apps/web/README.md).

## Tech stack

Angular, NestJS, MongoDB Atlas, Tailwind CSS, Transloco, pnpm workspaces, GitHub Actions. Every service used is free and requires no credit card. Rationale in [docs/adr](docs/adr).

## Local setup

```bash
nvm use            # Node 24 (see .nvmrc)
npm i -g pnpm      # or: corepack enable
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Environment variables: copy `.env.example` to `.env`. The architecture diagram, deployment guide, free-tier limits and screenshots arrive in later phases.

## License

MIT
