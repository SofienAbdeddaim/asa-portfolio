# 21. Deployments run by hand only

Status: accepted. Amends ADR 17 (deployment triggers and pull request previews).

## Context

ADR 17 deployed production after every green `ci` run on `main` and published a Netlify preview for every same-repository pull request that touched the web app. Netlify's free plan has 300 credits a month with a hard limit; a production deploy costs 15 of them. With several small pull requests merged a day, the credits ran out quickly, and the site cannot be republished until the next month once they do. Previews were assumed to be unmetered (ADR 17 planned an opt-in label if that proved wrong); in practice the owner wants every Netlify publish to be a deliberate act.

## Decisions

- **`deploy` has `workflow_dispatch` as its only trigger.** It no longer follows `ci`. It ships only `main`: a run started from another branch skips its deploy job. Run it after a batch of merges, or after a round of back-office edits.
- **`deploy-preview` has `workflow_dispatch` as its only trigger.** It is started from the pull request's branch; it finds that branch's open pull request, publishes the `pr-<number>` alias and comments the link as before. Branches only exist in this repository, so a fork's code still never runs with the secrets. The `no-preview` label is gone, since nothing runs unless asked.
- **The API follows the same rule.** Render's auto-deploy was already off (`render.yaml`): the API ships only through the `deploy` workflow.

## Consequences

- Merging to `main` no longer changes the live site. Production lags `main` until someone runs `deploy`, which is the point: one deploy per batch instead of one per merge.
- The checks that guarded automatic deploys (`ci` must pass) are now on the person running the workflow: run it on a `main` whose `ci` run is green.
