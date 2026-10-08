# Branch protection

> **Needs a public repository or GitHub Pro.** On a private repository on the free plan, GitHub does not offer protected branches or rulesets, so this cannot be applied there (see [DEPLOYMENT.md](DEPLOYMENT.md#public-or-private-repository)). Until then the discipline is yours: work on branches and open pull requests so the checks run before the merge. The `ci` workflow runs on every push regardless, and nothing deploys unless it passes.

`main` is the branch that deploys, so nothing reaches it without passing the checks. The rules are kept in the repository as a ruleset: [.github/rulesets/main.json](../.github/rulesets/main.json).

## Apply it

1. Push the repository to GitHub and let the workflows run once (a required check has to exist before it can be required).
2. **Settings → Rules → Rulesets → New ruleset → Import a ruleset**, and choose `.github/rulesets/main.json`.
3. Review it and **Create**.

## What it enforces

| Rule                                                                  | Why                                                                                                                                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request required, squash merges only                             | One Conventional Commit per change, taken from the pull request title (the `ci` workflow lints it), which is what the release workflow reads.              |
| Conversations must be resolved; stale approvals are dismissed on push | Review remarks are not lost.                                                                                                                               |
| No approvals required                                                 | This is a one-person project; GitHub does not let you approve your own pull request. Raise `required_approving_review_count` when others join.             |
| Linear history, no force-push, no deletion                            | The history the release notes come from stays intact.                                                                                                      |
| Required checks, branch up to date                                    | `Lint, types, tests, build`, `API image builds`, `Playwright`, `CodeQL`, `Static analysis`, `Container image`, `Known vulnerabilities`, `Secret scan`.     |
| No bypass actors                                                      | Not even the owner can push straight to `main`. If you need an escape hatch, add the repository admin role under `bypass_actors` with mode `pull_request`. |

Not required on purpose: `Lighthouse` runs only when the web app changes (a required check that does not always run would block unrelated pull requests), and `Dependency review` runs on pull requests only.

## Related settings

- **Settings → General → Pull Requests:** allow squash merging only, default message "Pull request title", and delete head branches automatically.
- **Settings → Code security:** enable the dependency graph, Dependabot alerts and security updates, secret scanning with push protection, and private vulnerability reporting.
- **Settings → Actions → General:** workflow permissions "Read repository contents", and allow Actions to create pull requests (the release workflow).
