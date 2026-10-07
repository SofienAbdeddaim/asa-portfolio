# 8. Authentication design (password + mandatory TOTP)

Status: accepted

## Flow

1. `POST /api/auth/login` verifies email and password (argon2id) and returns a 5-minute **challenge** token (audience `mfa`) plus `mfaEnrolled`. Unknown emails still spend an argon2 verification, and errors are identical, so users cannot be enumerated.
2. First login: `POST /auth/2fa/setup` returns the `otpauth://` URL and a QR code; `POST /auth/2fa/enable` confirms a code, stores the secret, returns 10 one-time **recovery codes**, and starts the session.
3. Later logins: `POST /auth/2fa/verify` with a TOTP code or a recovery code starts the session. A session is never issued on a password alone.

## Sessions

- Access token: JWT (HS256, 15 min, audience `access`) in an httpOnly cookie scoped to `/api`.
- Refresh token: opaque `<sessionId>.<secret>`, 7 days, httpOnly cookie scoped to `/api/auth`. Only a SHA-256 of the secret is stored. It is **rotated on every refresh**; presenting an already-rotated token revokes every session of that user (reuse detection).
- Cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in production. Nothing is stored in `localStorage`.

## Hardening

- TOTP secrets are encrypted at rest with AES-256-GCM (`TOTP_ENCRYPTION_KEY`). Recovery codes are stored as SHA-256 hashes and consumed atomically.
- A TOTP time step can only be used once (atomic conditional update), which blocks code replay.
- 5 failed passwords lock the account for 15 minutes. Credential routes are limited to 5 requests per minute per IP; the rest of the API to 100.
- CSRF: `SameSite=Strict` plus a global guard that rejects unsafe-method requests whose `Origin` is not `CORS_ORIGIN`.
- Audiences keep a challenge token from being used as an access token and the reverse.

## Consequences

The front end and API must be same-site, which is why production proxies `/api/*` through the front host (ADR 4). A cross-site deployment would need `SameSite=None` plus a CSRF token and a new ADR. Account recovery without any factor is deliberately unsupported: the seed CLI is the break-glass path.
