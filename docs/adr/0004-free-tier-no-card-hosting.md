# 4. Hosting under a no-credit-card constraint

Status: accepted, with one open point the owner must settle at sign-up (verified in Phase 6, October 2026)

## Decision

- Front: Netlify. Its rewrite rules make `/api/*` same-origin, which avoids third-party cookie problems and keeps the session cookie `SameSite=Strict`. Fallback: Cloudflare Pages.
- API: Render free web service, deployed from the Dockerfile. It sleeps when idle, hence the build-time content snapshot (ADR 16).
- Data: MongoDB Atlas free (M0) cluster.
- CI/CD: GitHub Actions, free for public repositories (ADR 17).

## What was verified in Phase 6

From each provider's own documentation, October 2026:

| Service  | Free allowance                                                                                                                                                                                                      | Effect on the design                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Netlify  | 300 credits a month, a hard limit with no recharge; a production deploy costs 15, bandwidth 20 per GB, requests 2 per 10,000. Deploy previews and branch deploys are not metered.                                   | About 20 production deploys a month: the deploy workflow runs on `main` only, previews are used for pull requests.               |
| Render   | 750 instance hours a month; idle for 15 minutes spins down, about a minute to wake; ephemeral filesystem, no shell. Included bandwidth and build minutes; without a payment method an overage suspends the service. | The API holds no state, the site works from a snapshot while it sleeps, and the first admin is created from a developer machine. |
| Atlas M0 | 512 MB, 500 connections, 100 operations a second, 10 GB transfer a week; paused after 30 days without a connection.                                                                                                 | Ample for a portfolio.                                                                                                           |

## Open point: the credit card

None of the three documentation pages says whether sign-up requires a card. This cannot be settled from the documentation, so it is the owner's to check when creating the accounts. If one of them asks for a card, the rule of the project holds (no card), and the replacements are:

- Front: Cloudflare Pages (understands `_headers`; proxying `/api` needs a small Pages Function instead of `_redirects`).
- API: any host that runs a container; the image has no platform-specific part.
- Database: any MongoDB 7 or newer, including a container.

Nothing in the application depends on the providers beyond the generated `_redirects` and the `API_ORIGIN` build variable.
