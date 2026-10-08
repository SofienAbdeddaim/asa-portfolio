# 19. Running the pipeline on a private repository

Status: accepted. The repository was made public on 2026-10-08, after this was written, which switches CodeQL, dependency review, rulesets and unlimited minutes on; the decisions below keep the pipeline working either way, for a fork or a private copy.

## Context

ADR 4 and ADR 17 assumed a public repository, where GitHub's features are free. The project was pushed as a private repository on a personal free plan. Checked against GitHub's documentation in October 2026, that plan gives a private repository 2,000 Actions minutes a month (jobs are blocked, not charged, when they run out with no payment method on file), no protected branches or rulesets (GitHub Pro), and no code scanning or dependency review action (GitHub Code Security). Dependabot alerts and updates are included. Two things were already visible on the remote when this was written: Dependabot had proposed `node:25-slim`, an odd-numbered release that is not a long-term-support line, and release-please had opened its first release pull request.

## Decisions

- **The workflows work in both modes.** CodeQL and the dependency-review action run only when the repository is public (`github.event.repository.private != true`), instead of failing on a private one. Everything else runs in both.
- **Semgrep replaces CodeQL where CodeQL is unavailable, and stays when it is.** The open-source engine, pinned by image digest, with the security-audit, TypeScript, Node.js and OWASP rule packs, fails the job on any finding. Its first run found a real weakness that nothing else had: AES-GCM decryption without a fixed authentication-tag length, which accepts truncated, forgeable tags. Fixed in the same change and covered by a test.
- **The browser tests are part of `ci`**, not a separate workflow, so that the deploy workflow, which follows `ci`, also waits for them. Without branch protection this is what stops a broken push from shipping.
- **Minutes are spent where they matter.** Changes that only touch documentation, Markdown, or the `.claude` folder run neither `ci` nor `security` (the local pre-commit hooks already format them); Lighthouse runs only for web changes; a newer push cancels the run in progress; Dependabot proposes monthly. The `keepwarm` workflow refuses to run on a private repository (4,320 runs a month, each billed as a minute).
- **Dependabot does not propose a Node.js major** (the Node.js line moves by decision, with the engines range, `.nvmrc` and CI changing together) **or an `@types/node` major** (the types follow the Node.js the code runs on, 22 and 24).
- **No GitHub environment is used by `deploy`.** Nothing relies on environment secrets or protection rules, and environments are not guaranteed on a private free repository.
- **Runners are pinned to `ubuntu-24.04`.** GitHub announced (in the annotations of the first runs) that `ubuntu-latest` moves to Ubuntu 26 on 19 October 2026; Playwright's browser dependencies and Chrome for Lighthouse have to be checked on the new image before following it.
- **The branch ruleset stays in the repository** for when it can be applied (public, or Pro), and the discipline until then is documented: branches and pull requests, with CI on every push and deployment only after a green run.

## Consequences

- On a private free repository the budget is roughly a few dozen minutes per code change; the first weeks of real usage will show whether 2,000 is enough, and the repository can be made public at any time to remove the limit and gain CodeQL, dependency review and the ruleset.
- Semgrep rule packs are fetched at run time from the public registry, so a rule added upstream can start failing a build; a false positive is silenced in the code with `nosemgrep` and a reason.
- Failures are made readable without the logs (which GitHub only shows to signed-in users, even on a public repository): Playwright reports through GitHub annotations, and the Lighthouse runner annotates every budget it misses and every error it hits.
