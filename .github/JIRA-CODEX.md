# Manual Jira to Codex workflow

The **Jira story to draft PR** workflow (`jira-codex.yml`) runs only through
`workflow_dispatch` on the repository's default branch. Its issue input defaults
to `FD-1`. It does not run on pushes, PRs, schedules, or Jira events, and never
merges, deploys, or updates Jira.

## Repository setup

After committing these files to the default branch, configure **Settings →
Secrets and variables → Actions**:

- Variable `JIRA_BASE_URL`: your Jira Cloud origin, e.g. `https://your-team.atlassian.net`.
- Secrets `JIRA_EMAIL` and `JIRA_API_TOKEN`: a Jira account email and API token
  with permission to read the requested issues. Use an unscoped token for the
  site-origin Basic authentication endpoint used here.
- Secret `OPENAI_API_KEY`: an OpenAI API key with available API billing.
- Existing secrets `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, and
  `E2E_CLERK_FRONTEND_API`: the dedicated Clerk development test application's
  values described in [the E2E guide](../e2e/README.md).
- Optional variable `JIRA_ACCEPTANCE_CRITERIA_FIELD`: a field ID such as
  `customfield_10042` if acceptance criteria live outside the description.

Under **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. This workflow only
creates draft PRs; it does not approve them. Organization policy must also allow
the actions and requested token permissions. No personal GitHub token is needed.

## Run FD-1

Open **Actions → Jira story to draft PR → Run workflow**, select the default
branch, leave `issue_key` as `FD-1`, and run. Alternatively:

```sh
gh workflow run jira-codex.yml --ref main -f issue_key=FD-1
```

Replace `main` if your default branch has a different name. A non-default branch
dispatch is skipped deliberately.

Each run creates a unique `codex/fd-1-<run>-<attempt>` branch from the dispatched
commit. Jira summary, description (including ADF content), and optional custom
acceptance criteria become Codex's task. Codex receives no Jira credentials,
Clerk secrets, or GitHub write token. Dependencies are installed before Codex
runs with the official action's workspace-write sandbox and drop-sudo strategy.

The proposed patch is tested in a fresh job using the existing full Playwright
Chromium suite, production build, Java 21 Firestore emulator, and dedicated Clerk
test application. A separate publication job applies that same patch without
executing it, pushes the feature branch, and creates a **draft** PR. Generated
changes to `.github/`, `AGENTS.md`, `.env*`, or `.gitmodules` are refused.

The PR body and Actions summary include the Codex outcome, Playwright status and
counts (passed, failed, flaky, skipped), plus a run link. HTML/JSON reports and
the proposal are private repository artifacts retained for three days; reports
may contain screenshots or authentication details. Missing reports are called
out explicitly. Failed tests or a failed Codex step leave a failed run and a draft
PR for inspection when a patch exists. Setup failures appear in the workflow
logs; a Jira read failure or empty patch creates no PR. Cancelling the run stops
publication. Reruns create a fresh branch and draft PR rather than overwriting work.

GitHub's built-in token does not trigger the separate PR/push workflows; the
Playwright job in this workflow is the validation for the generated patch. Review
the diff and results, make any corrections, and decide when to mark the PR ready
and merge it yourself.

Local helper checks: `node --test .github/scripts/jira-codex.test.mjs`.

References: [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action),
[Jira issue REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get).
