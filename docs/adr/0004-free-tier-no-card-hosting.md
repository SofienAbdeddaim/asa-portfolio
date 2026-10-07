# 4. Hosting under a no-credit-card constraint

Status: proposed (to be verified at implementation time, Phase 6)

## Decision (target)

- Front: Netlify (proxy rewrites make `/api/*` same-origin, avoiding third-party cookie issues). Fallback: Cloudflare Pages.
- API: Render free web service (sleeps after inactivity, hence the build-time content snapshot).
- Data: MongoDB Atlas free (M0) cluster.

## Open point

Free-tier signup conditions change. They are re-checked in Phase 6; if a card is required, an alternative is chosen and this ADR is superseded.
