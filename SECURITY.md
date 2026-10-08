# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository (private vulnerability reporting). If that
is not available, email the maintainer at the address on their GitHub profile.

Include what you found, how to reproduce it, and what you think the impact is. You will get an
acknowledgement within a few days. This is a personal project maintained by one person, so there is
no bounty, but valid reports are credited if you wish.

## Supported versions

Only the latest release on `main` is supported.

## What is already in place

The design, what is checked and the limits that are accepted are in [docs/SECURITY.md](docs/SECURITY.md),
and the reasoning in the ADRs under [docs/adr](docs/adr), mainly
[0008](docs/adr/0008-authentication-design.md) and [0018](docs/adr/0018-hardening.md): password hashing with argon2id, mandatory TOTP two-factor
authentication with encrypted secrets and single-use recovery codes, short-lived access tokens with
rotating refresh tokens in `httpOnly` cookies (never in web storage), strict CORS and origin
checks, rate limiting, input validation and sanitization, a strict Content-Security-Policy, and
automated scanning in CI (CodeQL, dependency review, `pnpm audit`, secret scanning).
