# @asa/api

NestJS 12 + Mongoose API for the portfolio: public content, private back-office, password + TOTP authentication.

## Run locally

```bash
cp .env.example .env     # from the repo root, then fill JWT_SECRET and TOTP_ENCRYPTION_KEY
docker compose up -d mongo
pnpm --filter @asa/api seed:admin      # creates the first admin from SEED_ADMIN_* (2FA is enrolled at first login)
pnpm --filter @asa/api seed:demo       # clearly fake demo content (add `-- --reset` to wipe first)
pnpm --filter @asa/api dev             # http://localhost:3000, Swagger at /api/docs
```

Everything in Docker: `docker compose up --build` (API on `127.0.0.1:3000`).

## Scripts

| Command           | What it does                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm test`       | Vitest with coverage (threshold 70%)                                                            |
| `pnpm typecheck`  | `tsc --noEmit`                                                                                  |
| `pnpm build`      | `tsc` to `dist/`                                                                                |
| `pnpm smoke`      | End-to-end check of a running API (fresh local DB only)                                         |
| `pnpm seed:admin` | Create the first admin (idempotent)                                                             |
| `pnpm seed:demo`  | Load fake demo content into empty collections                                                   |
| `pnpm admin`      | Account recovery: `unlock`, `reset-2fa`, `set-password`, `revoke-sessions` (docs/BACKOFFICE.md) |
| `pnpm backup`     | `export` / `import` the profile, all content (drafts too) and images (docs/DEPLOYMENT.md)       |

## Endpoints

- Public: `GET /api/profile`, `/api/content` (snapshot, held for 5 seconds and cleared by any change), `/api/<resource>`, `/api/<resource>/slug/:slug`, `/api/health`
- Auth: `POST /api/auth/login`, `2fa/setup`, `2fa/enable`, `2fa/verify`, `refresh`, `logout`, `GET /me`
- Media: `GET /api/media/:id` (public, immutable cache); `POST /api/admin/media` (multipart `file`, 5 MB, decoded and re-encoded as WebP) and `DELETE /api/admin/media/:id` need the cookie
- Admin (cookie required): `/api/admin/<resource>` CRUD, `PUT /api/admin/<resource>/reorder`, `PUT /api/admin/profile`

Resources: `experiences`, `skills`, `projects`, `education`, `certificates`, `testimonials`, `posts`. Sign-in and `/api/admin` responses are never cacheable. See ADR 7 to 9 and 18 for the design, and docs/SECURITY.md.
