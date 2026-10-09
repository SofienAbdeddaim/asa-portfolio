# Deployment

How the portfolio gets from `main` to the internet, on free services only. The decisions behind it are in [ADR 4](adr/0004-free-tier-no-card-hosting.md) and [ADR 17](adr/0017-ci-cd-and-deployment.md).

## How it fits together

```mermaid
flowchart LR
  dev[Push to main] --> ci[ci workflow]
  ci -->|passes| deploy[deploy workflow]
  deploy -->|1. deploy hook| render[Render: API]
  render <--> atlas[(MongoDB Atlas)]
  deploy -->|2. waits for the new commit| render
  deploy -->|3. pnpm snapshot| render
  deploy -->|4. build + netlify deploy| netlify[Netlify: static site]
  visitor((Visitor)) --> netlify
  netlify -->|/api/* proxied| render
```

- **Netlify** serves the pre-rendered Angular site and forwards `/api/*` to the API, so the browser only ever talks to one origin (cookies stay first-party and `SameSite=Strict`).
- **Render** runs the API from `apps/api/Dockerfile`.
- **MongoDB Atlas** (M0) stores the content.
- **GitHub Actions** tests, scans, releases and deploys. Nothing is deployed from a laptop.

The site is built from a snapshot of the published content (`pnpm snapshot`), so it works while the free API is asleep. When the API wakes up (about a minute), the page refreshes itself with live content.

## What the free tiers give you

Checked in October 2026 against the providers' documentation. Limits change; re-check before relying on them.

| Service              | Free allowance                                                                                                                                                                                                                                                       | Worth knowing                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Netlify              | 300 credits a month, with a hard limit and no automatic recharge. A production deploy costs 15 credits, each GB of traffic 20, each 10,000 requests 2. Deploy previews and branch deploys are not metered.                                                           | About 20 production deploys a month. The workflow deploys on every push to `main`, so batch small changes into one pull request. |
| Render (web service) | 750 instance hours a month. Idle for 15 minutes means it spins down; the next request waits about a minute. Ephemeral filesystem, no shell. Bandwidth and build minutes are included up to a monthly amount; without a payment method, overages suspend the service. | One always-on service uses about 744 of the 750 hours. See "Cold starts".                                                        |
| MongoDB Atlas (M0)   | 512 MB storage, 500 connections, 100 operations a second, 10 GB transfer a week. Paused after 30 days with no connection.                                                                                                                                            | Any visit, or the keep-warm ping, prevents the pause. Export your data now and then.                                             |
| GitHub Actions       | Free and unlimited for a public repository. For a private one on the free plan: 2,000 minutes a month, 500 MB of artifacts, and jobs are blocked (not charged) when the minutes run out.                                                                             | See "Public or private repository" below. Scheduled workflows stop after 60 days without repository activity.                    |

**Credit card.** None of the providers' documentation pages I read says whether signing up needs a card, so I cannot promise it. If one asks for a card, stop there rather than adding one. The pieces are replaceable:

- _Front:_ Cloudflare Pages can serve the same build (it understands `_headers`). It cannot proxy `/api/*` to another host from `_redirects`; that needs a small Pages Function. The `API_ORIGIN` build variable and the generated `_redirects` are the only Netlify-specific parts.
- _API:_ it is a plain container (`apps/api/Dockerfile`) that needs `MONGODB_URI` and the variables in `.env.example`. Any host that runs a container works, including your own machine.
- _Database:_ any MongoDB 7+ instance, including a container (`docker-compose.yml` has one).

## Public or private repository

This repository is public, the project was designed that way, and everything also works on a private one, but GitHub's free plan gives less to a private one (checked in October 2026 against GitHub's documentation):

|                                | Public          | Private (free plan)                                                    |
| ------------------------------ | --------------- | ---------------------------------------------------------------------- |
| Actions minutes                | free, unlimited | 2,000 a month, then jobs are blocked until the month ends              |
| CodeQL and dependency review   | yes             | need the paid GitHub Code Security; those two jobs skip themselves     |
| Branch protection and rulesets | yes             | need GitHub Pro; [the ruleset](BRANCH_PROTECTION.md) cannot be applied |
| Dependabot alerts and updates  | yes             | yes                                                                    |
| `keepwarm` workflow            | possible        | do not: its 4,320 runs a month would use the whole allowance           |

What stays the same on a private repository: the full CI (checks, tests, the browser tests, the container build), the static analysis (Semgrep), the audits, the image scan, the secret scan, releases, deployment and previews.

**Spending the 2,000 minutes.** A change to code costs a few dozen minutes across the workflows (checks and tests, the browser tests, the scans, and for the web app Lighthouse and a preview); I have not measured it on GitHub's runners yet, so look at **Settings → Billing → Usage** after the first week. What keeps it down: changes that only touch documentation run nothing; a newer push cancels the run before it; Dependabot opens its pull requests monthly, not weekly; Lighthouse runs only for web changes. If the allowance is exhausted, nothing is charged (no payment method is on file); CI simply waits for the next month, or the repository can be made public.

**Making it public** (Settings → General → Danger zone) gives all of it back. The history has been scanned for secrets and has none, and nothing in the repository identifies anything private; read [docs/SECURITY.md](SECURITY.md) first, and decide about the files in `.claude/`, which are your own tooling.

## Set it up (about 30 minutes, once)

Do these in order: each step needs a value from the one before.

### 1. Netlify: an empty site

1. Create a Netlify account and a site with **Add new site → Deploy manually** (drop any folder in). Note the address, for example `https://my-portfolio.netlify.app`. This is `SITE_URL`.
2. **Site configuration → Site details → Project ID** is `NETLIFY_SITE_ID`.
3. **User settings → Applications → Personal access tokens → New access token** gives `NETLIFY_AUTH_TOKEN`. Keep it secret.

### 2. MongoDB Atlas: the database

1. Create an account and a free **M0** cluster (any region near Render's, for example Frankfurt).
2. **Database Access:** add a user with a long random password and the _Read and write to any database_ role.
3. **Network Access:** add `0.0.0.0/0`. Render's free plan has no fixed outbound address, so an allow-list is not possible; the database user's password and TLS are what protect it.
4. **Connect → Drivers:** copy the connection string and add the database name, for example `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/portfolio?retryWrites=true&w=majority`. This is `MONGODB_URI`.

### 3. Render: the API

1. Create an account and connect your GitHub account.
2. **New → Blueprint**, pick this repository. Render reads [render.yaml](../render.yaml).
3. Fill the two values it asks for: `MONGODB_URI` (step 2) and `CORS_ORIGIN` (the `SITE_URL` from step 1, with no trailing slash). `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` are generated for you; do not change `TOTP_ENCRYPTION_KEY` later, or every enrolled authenticator becomes unreadable.
4. When the first deploy is live, open `https://<service>.onrender.com/api/health`: it should answer `{"status":"ok","database":"up",...}`. The address is `API_URL`.
5. **Settings → Deploy Hook:** copy the URL. It is `RENDER_DEPLOY_HOOK_URL`, and it is a secret (anyone with it can trigger a deploy).

`TRUST_PROXY_HOPS=2` (set in the blueprint) tells the API that two proxies sit in front of it, Render's and Netlify's, so login rate limiting sees the visitor's address and not Netlify's. If you call the API directly or put a different proxy in front, change it.

### 4. Create the first admin

Render's free plan has no shell, so run the seed from your machine against Atlas:

```bash
cp .env.example .env
# In .env set MONGODB_URI (step 2), SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters),
# and a JWT_SECRET and TOTP_ENCRYPTION_KEY (any valid values: this command only stores a password hash).
pnpm install
pnpm --filter @asa/api seed:admin
```

Optional: `pnpm --filter @asa/api seed:demo` loads clearly fake content so the first deploy has something to show. You replace it in the back-office afterwards.

Delete `SEED_ADMIN_PASSWORD` from `.env` when done. Two-factor authentication is set up the first time you sign in.

### 5. GitHub: secrets and variables

In the repository, **Settings → Secrets and variables → Actions**:

| Kind                | Name                     | Value                                |
| ------------------- | ------------------------ | ------------------------------------ |
| Secret              | `NETLIFY_AUTH_TOKEN`     | step 1                               |
| Secret              | `RENDER_DEPLOY_HOOK_URL` | step 3                               |
| Variable            | `NETLIFY_SITE_ID`        | step 1                               |
| Variable            | `SITE_URL`               | step 1, no trailing slash            |
| Variable            | `API_URL`                | step 3, no trailing slash            |
| Variable (optional) | `KEEP_WARM`              | `true` to enable the keep-warm ping  |
| Secret (optional)   | `RELEASE_PLEASE_TOKEN`   | a fine-grained token, see "Releases" |

Also enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** (the release workflow needs it).

Until these exist, `deploy`, `deploy-preview` and `keepwarm` skip themselves with a notice instead of failing.

### 6. First deploy

Run **Actions → deploy → Run workflow**. It deploys the API, waits for it to serve the commit, pulls the content, builds and publishes the site, and checks the live site. Then open `SITE_URL/admin`, sign in, set up two-factor authentication, **save the recovery codes**, and replace the demo content.

From now on, every push to `main` that passes CI deploys by itself.

## Day to day

- **Edited content in the back-office.** Visitors see it within moments (the page refreshes from the API). The pre-rendered HTML that search engines read only updates on the next deploy: run **deploy** by hand when you have finished a round of edits.
- **Preview a change.** A pull request that touches the web app gets a comment with its preview address (`pr-<number>--<site>.netlify.app`). Previews show the real content, are never indexed, and cannot sign in to the back-office (the API only accepts the production origin). Add the `no-preview` label to skip one. Previews are not metered on the free plan according to Netlify's pricing page; if credits drop after opening pull requests, change the workflow to require a label.
- **Roll back.** Netlify: **Deploys →** an earlier deploy **→ Publish deploy**. Render: **Events →** an earlier deploy **→ Rollback**. Or revert the commit on `main`.

## Backups and recovery

**Atlas's free tier has no backups.** Everything you write in the back-office, drafts and unpublished entries included, lives only there. From your machine, with the production `MONGODB_URI` in `.env`:

```bash
pnpm --filter @asa/api backup export                     # to backups/<date and time>
pnpm --filter @asa/api backup import <folder>            # into an empty database only
```

An export holds the profile, every entry (drafts too) and every uploaded image, and never accounts or sessions. Do it before large edits and every few weeks, and keep the folders somewhere private (they are git-ignored for that reason). A restore is rehearsed by the end-to-end tests; to try one for real, point `MONGODB_URI` at a new empty database first.

The same machine and `.env` run the account recovery tool (lost authenticator, forgotten password, lockout): [BACKOFFICE.md](BACKOFFICE.md#if-something-goes-wrong). Both tools talk straight to the database, so treat that `.env` like the keys to the site and delete the production `MONGODB_URI` from it when you are done.

## Cold starts

After 15 idle minutes Render stops the API, and the next request waits about a minute. Visitors do not notice on the pages, which are static; the live refresh and the back-office wait for it. Two ways to deal with it:

- Accept it (default). The back-office shows its normal loading states.
- Set the `KEEP_WARM` variable to `true` (public repositories only: on a private one it would use up the free Actions minutes in two weeks, and the workflow refuses to run) and the `keepwarm` workflow pings the API every 10 minutes. An outside uptime monitor with a free plan, pointed at `API_URL/api/health`, does the same job anywhere. One always-on service uses about 744 of the 750 free hours, so this only works if it is your only free web service in that Render workspace. It also keeps Atlas awake, and it makes the API's free build and bandwidth allowances the limit to watch.

## Releases

The `release` workflow keeps a release pull request open, built from the Conventional Commits on `main`. Merging it updates the version and `CHANGELOG.md`, tags the commit and publishes a GitHub release. Pull requests opened with the default `GITHUB_TOKEN` do not start other workflows, so checks would not run on the release pull request. To fix that, create a fine-grained personal access token limited to this repository (**Contents** and **Pull requests**: read and write) and store it as the `RELEASE_PLEASE_TOKEN` secret.

## Branch protection

[docs/BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) has the ruleset to import: pull requests only, squash merges, the checks below required. It needs a public repository or GitHub Pro. Without it, `main` accepts direct pushes: CI still runs on each one, and `deploy` only follows a green run, so a broken push is caught before it ships, but it is not prevented.

## The workflows

| Workflow         | When                                                       | What it does                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci`             | every push and pull request that is not documentation only | commit and PR-title lint, format, lint, types, unit and API tests with coverage thresholds, build; builds the API image; Playwright against the built site, the built API and a real MongoDB |
| `security`       | push, pull request, weekly                                 | Semgrep static analysis, `pnpm audit`, container image scan, secret scan of the whole history; CodeQL and dependency review where the repository is public                                   |
| `lighthouse`     | web changes, push to `main`                                | performance, accessibility, best-practice and SEO budgets on mobile                                                                                                                          |
| `release`        | push to `main`                                             | release pull request, changelog, tag, GitHub release                                                                                                                                         |
| `deploy`         | after `ci` passes on `main`; manual                        | deploys the API, waits for it, snapshots the content, builds, publishes, smoke-tests                                                                                                         |
| `deploy-preview` | pull requests touching the web app                         | preview site and a comment with its address                                                                                                                                                  |
| `keepwarm`       | every 10 minutes, if enabled                               | pings the API                                                                                                                                                                                |

Third-party actions are pinned to a commit and kept current by Dependabot.

## Troubleshooting

- **`release` fails with "GitHub Actions is not permitted to create or approve pull requests".** Turn on **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**, then re-run the workflow. Until then no release pull request is opened.
- **A failed run and no way to read why.** GitHub shows job logs only to signed-in users, and the public API does not return them. The failing step is on the run page, Playwright and Lighthouse also write their failures as annotations on the run, and the Playwright report and Lighthouse reports are attached as artifacts.
- **`deploy` fails in the Netlify step with "We've detected multiple projects inside your repository".** The Netlify CLI has to be told which workspace package the site is: the command carries `--filter @asa/web`. If you run `netlify deploy` by hand from the repository root, add it too.
- **`deploy` publishes, then fails on "The live site did not answer correctly".** The smoke test fetches `/en` (Netlify redirects it to `/en/`, so `curl` follows redirects) and `/api/health` through the proxy. If the page is fine in a browser, the free Render API was probably asleep: the 504 clears once it has woken up, so re-run `deploy`.
- **`deploy` says "Not configured yet".** A secret or variable from step 5 is missing; the notice lists which.
- **"The profile is empty: fill it in the back-office first".** The API has no profile. Run `seed:demo` (step 4) or create the profile in the back-office, then run `deploy` again.
- **"The API did not serve … within 20 minutes".** The Render build failed or is queued. Open the service's **Events** and logs. The site is not touched when this happens.
- **Sign-in fails with a network or 403 error.** `CORS_ORIGIN` on Render must be exactly the address in the browser (scheme and host, no path, no trailing slash).
- **Sign-in is rate limited for everyone at once.** `TRUST_PROXY_HOPS` is too low, so every visitor looks like the same address. It should be `2` behind Netlify.
- **The back-office is slow to open the first time.** The API is waking up.
