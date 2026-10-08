# 17. CI/CD, deployment and quality gates

Status: accepted

## Context

The repository is public and the project must run on free services without a card (ADR 4). Deployment has an unusual dependency: the static site is built from the API's published content (ADR 16), so a release is "deploy the API, then build the site from it", not two independent deployments.

## Decisions

### Deploy from GitHub Actions, not from the hosts' Git integrations

- A host that builds on every push would ship commits that fail CI, would build the site before the API has its new version, and would spend its free build allowance. A workflow can wait for the checks, wait for the API, and run the snapshot in between.
- `deploy` runs after `ci` succeeds on `main` (`workflow_run`), only for pushes to this repository, and one at a time. It triggers Render's deploy hook, polls `/api/health` until the API reports this commit or a later one (the endpoint returns the deployed commit), pulls the content, builds, publishes with the Netlify CLI (pinned version, `npx`), and smoke-tests the live site and the `/api` proxy through it.
- When secrets or variables are missing, deployment workflows skip with a notice instead of failing, so the repository is usable before any hosting exists.
- A failed API build stops the release before the site is touched. An empty profile stops it too, so placeholder content is never published by accident.

### Pull request previews

Same-repository, non-draft pull requests that touch the web app get a Netlify alias deploy (`pr-<number>--<site>`) and a comment with the link. Fork pull requests never run with secrets. Previews carry `X-Robots-Tag: noindex` and cannot sign in to the back-office (the API only accepts the production origin). They depend on Netlify not metering non-production deploys, which its pricing page states; if that proves wrong, the workflow gets an opt-in label.

### Supply chain

- Third-party actions are pinned to a full commit SHA with the version in a comment, and Dependabot updates them. First-party setup is one local composite action (`.github/actions/setup`) so every workflow installs the same Node and pnpm.
- Every workflow declares least-privilege `permissions`; checkout does not persist credentials; untrusted values (pull request titles) reach shell steps through `env`, never through `${{ }}` interpolation into the script.
- Secret scanning runs the open-source `gitleaks` binary, pinned and checksum-verified, rather than the gitleaks GitHub Action, which is distributed under a separate commercial licence for organisations.
- CodeQL (`security-extended`), dependency review on pull requests, and `pnpm audit` for production dependencies (a high advisory fails the build; development-only advisories are reported, not blocking) run on push, on pull requests and weekly.

### Releases

`release-please` opens a release pull request from the Conventional Commits and, when merged, tags and publishes a GitHub release with the changelog. Squash merges with a linted pull request title make the title the single source of truth. The default token cannot start workflows on the pull request it opens; an optional fine-grained token fixes that.

### End-to-end tests

Playwright runs against the production build, served with the generated `_redirects` and `_headers`, the compiled API and a real MongoDB, with the admin created through the real sign-in and two-factor flow. No mocks of our own code. One worker and no retries, because sign-in is rate limited and a retry would hide flakiness. The reset script refuses any database not named `*_e2e`.

### Lighthouse

- Runs through the `lighthouse` Node API from a small script, not `@lhci/cli`: the CLI has not been released since June 2025 and bundles an older Lighthouse, which conflicts with the "no abandoned dependencies" rule. The script does what is needed: several runs, medians, budgets, a retry for Chrome's occasional trace failure, reports as artifacts.
- The test server compresses with Brotli and applies the production headers; without that the numbers would not describe production.

#### Where the budgets stand

Median of three runs, mobile emulation, on the development machine. Two idle runs bracket the noise:

| Page                               | Performance | LCP       | TBT        |
| ---------------------------------- | ----------- | --------- | ---------- |
| `/en`                              | 86–88       | 2.9 s     | 216–265 ms |
| `/fr`                              | 83–87       | 2.8–2.9 s | 208–266 ms |
| `/ar`                              | 72–84       | 3.2–3.9 s | 220–284 ms |
| `/en/blog`, `/en/blog/hello-world` | 88–90       | 2.7–3.0 s | 135–190 ms |
| `/en/cv`                           | 90–94       | 2.5–2.8 s | 102–181 ms |

Accessibility, best practices and SEO are 100 everywhere. Performance is just under the 90 target on the home page and further under on `/ar`, so the budgets in `e2e/lighthouse-budgets.json` are regression guards set below the worst of these runs, not the target (performance 0.8, and 0.6 for `/ar`). What was measured, for Phase 7:

- The observed (unthrottled) first paint is about 0.4 s and the largest paint about 1 s; the scores come from Lighthouse's simulation of a slow phone, where the Angular runtime's hydration alone costs 200 to 300 ms of blocking time.
- Moving the Arabic font faces out of the global stylesheet (a component declares them, so English and French pages no longer download or preload about 190 KB of Arabic fonts) took `/en` from 68 to about 87. The cost is that Arabic pages no longer preload their fonts.
- Candidates: incremental hydration of the lower sections, preloading the Arabic faces on Arabic pages only, and trimming the work done after first paint (about 140 ms of layout).

Lighthouse also fails to record a trace now and then (`NO_NAVSTART`, about one run in seven here). The runner repeats such a run and leaves it out of the median.

## Consequences

- One deployment path, auditable in the Actions log, with no credentials on a developer machine except for the one-off admin seed.
- The pipeline needs two secrets and three variables (docs/DEPLOYMENT.md). The Netlify CLI version is pinned in the workflows and is not updated by Dependabot.
- Free-tier limits are real: about 20 production deploys a month on Netlify, and a roughly one-minute cold start of the API.
- Lighthouse numbers vary by several points with machine load. The budgets leave room for that; CI results are the reference.
