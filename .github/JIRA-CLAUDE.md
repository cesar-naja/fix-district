# Manual Jira to Claude Code workflow

The **Jira story to draft PR** workflow (`jira-claude.yml`) runs only through
`workflow_dispatch` on the repository's default branch. Its issue input defaults
to `FD-1`. It does not run on pushes, PRs, schedules, or Jira events, and never
merges, deploys, or updates Jira. Claude Code implements the story through
[Anthropic's official `claude-code-action`](https://docs.claude.com/en/docs/claude-code/github-actions)
in automation mode: the workflow supplies the prompt, so no `@claude` mention is
involved.

## Claude credential and GitHub App setup

Follow Anthropic's
[manual setup](https://docs.claude.com/en/docs/claude-code/github-actions#manual-setup);
the `/install-github-app` quick setup also writes its own `claude.yml` and
`claude-code-review.yml` workflows, which Fix District does not use.

1. Install the **Claude GitHub App** on `cesar-naja/fix-district` as a
   repository admin. The action authenticates as that app through the job's
   GitHub OIDC token, which is why the `implement` job requests
   `id-token: write`. Installing grants the app's full permission set, including
   Contents, Issues, and Pull requests read/write; GitHub does not allow
   accepting a subset. If that is too broad, create a custom GitHub App with
   only Contents, Issues, and Pull requests, store its `APP_ID` and
   `APP_PRIVATE_KEY`, and pass a token from it as the action's `github_token`
   input.
2. Add secret `ANTHROPIC_API_KEY`: a Claude API key from the Claude Console with
   available API billing. To bill a Claude Pro/Max/Team subscription instead, run
   `claude setup-token` locally, store the result as `CLAUDE_CODE_OAUTH_TOKEN`,
   and change the `anthropic_api_key` line in `jira-claude.yml` to
   `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`.

Claude never receives a repository write token from this workflow and is allowed
only workspace read and edit tools (`Read`, `Glob`, `Grep`, `Edit`, `Write`,
`NotebookEdit`, `TodoWrite`) under `--permission-mode default`. It has no `Bash`
tool, so it cannot run tests, commit, push, or open a PR itself.

## Repository setup

After committing these files to the default branch, configure **Settings →
Secrets and variables → Actions**:

- Variable `JIRA_BASE_URL`: your Jira Cloud origin, e.g. `https://your-team.atlassian.net`.
- Secrets `JIRA_EMAIL` and `JIRA_API_TOKEN`: a Jira account email and API token
  with permission to read the requested issues. Use an unscoped token for the
  site-origin Basic authentication endpoint used here.
- Secret `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`), as above.
- Optional variable `JIRA_ACCEPTANCE_CRITERIA_FIELD`: a field ID such as
  `customfield_10042` if acceptance criteria live outside the description.

Under **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. This workflow only
creates draft PRs; it does not approve them. Organization policy must also allow
the actions and requested token permissions. No personal GitHub token is needed.

## Clerk test keys and the approval gate

Generated code only runs after you have seen it. The draft PR opens first, and
the Playwright job then waits on a protected environment that holds the Clerk
test credentials, so an unreviewed patch cannot reach the Clerk test application
at all. `playwright.yml` applies the same gate, so neither workflow can run
unreviewed code against the test keys.

Required reviewers apply to every run that reaches an environment, and a single
environment cannot require approval for some refs only. Both workflows therefore
choose between two environments that hold the same three Clerk values:

| Environment | Required reviewer | Used by |
| --- | --- | --- |
| `e2e-tests` | none | `playwright.yml` for the schedule, pushes, and manual runs on `main` |
| `generated-code-tests` | you | `playwright.yml` for same-repo pull requests and manual runs on a feature branch; `jira-claude.yml` always |

`playwright.yml` picks `e2e-tests` only when the event is not a pull request and
the ref is the default branch; everything else routes to `generated-code-tests`.
Those three unattended triggers always test code that is already on `main`. A
pull request or a feature-branch dispatch may carry generated code, so it waits
for you. Forked pull requests never reach either environment: the job's existing
`if` skips them, because forks do not receive the Clerk keys.

Approval is requested per run, so pushing another commit to an open pull request
asks again.

### Move the three values into environments

Under **Settings → Environments**, create `e2e-tests` and `generated-code-tests`.
In each one, add **Environment secrets** `E2E_CLERK_PUBLISHABLE_KEY`,
`E2E_CLERK_SECRET_KEY`, and `E2E_CLERK_FRONTEND_API` with the dedicated Clerk
development test application's values described in
[the E2E guide](../e2e/README.md). Environment secrets shadow repository secrets
of the same name inside the job, so no workflow line changes when you move them.

On `generated-code-tests` only, add yourself under **Required reviewers** and
leave **Prevent self-review** off, so you can approve the `FD-1` run you
dispatched yourself. Add no reviewers to `e2e-tests`; it exists to hold the keys
for unattended runs.

### Restrict `e2e-tests` to `main`

Only non-pull-request runs on the default branch use `e2e-tests`, so its keys
should be unreachable from anywhere else even if a workflow is edited later. In
**Settings → Environments → `e2e-tests` → Deployment branches and tags**, switch
the dropdown from **All branches** to **Selected branches and tags**, choose
**Add deployment branch or tag rule**, enter `main` as the name pattern, and add
the rule. Leave the rule list at that one entry. A run that reaches `e2e-tests`
from any other ref then fails instead of reading the keys.

Leave `generated-code-tests` on **All branches**. The policy is checked against
the ref the workflow runs on rather than the code under test, and all three of
its callers would fail a branch pattern: `jira-claude.yml` always runs on the
default branch even though it tests a generated patch, `pull_request` runs report
a `refs/pull/N/merge` ref that no branch pattern matches, and feature-branch
dispatches use arbitrary names. Its required reviewer is the control there, not
the ref.

### Then remove the repository-level copies

Once both workflows are on this branch's versions and you have confirmed one run
of each, delete `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, and
`E2E_CLERK_FRONTEND_API` from **Settings → Secrets and variables → Actions**.
They are the repository-level copies, and `playwright.yml` and `jira-claude.yml`
are the only workflows that read them, so nothing else breaks. Until both
workflows are updated, deleting them early leaves the un-updated workflow with
empty Clerk keys and a failing suite.

If an environment does not exist when a run reaches the job, GitHub creates it
implicitly with no protection rules and no secrets, so the job starts without
waiting and the suite fails on missing Clerk keys. Create both before the first
run.

## Run FD-1

Open **Actions → Jira story to draft PR → Run workflow**, select the default
branch, leave `issue_key` as `FD-1`, and run. Alternatively:

```sh
gh workflow run jira-claude.yml --ref main -f issue_key=FD-1
```

Replace `main` if your default branch has a different name. A non-default branch
dispatch is skipped deliberately.

Each run creates a unique `claude/fd-1-<run>-<attempt>` branch from the
dispatched commit. Jira summary, description (including ADF content), and
optional custom acceptance criteria become Claude's prompt, passed through a
multiline environment variable with a random heredoc delimiter so story text
cannot close the block or inject other variables. Claude receives no Jira
credentials, Clerk secrets, or GitHub write token. Dependencies are installed
before Claude runs so it can read the installed Next.js guides.

Claude's final message is collected by a copy of
`.github/scripts/jira-claude.mjs` taken before Claude starts, since Claude can
edit anything in the workspace and the check that refuses generated `.github/`
changes only runs afterwards.

The run then proceeds in three jobs, none of which executes generated code in
the job that publishes or reports:

1. `draft-pr` applies the patch without executing it or installing its
   dependencies, pushes the feature branch, and opens a **draft** PR. Generated
   changes to `.github/`, `AGENTS.md`, `.env*`, or `.gitmodules` are refused
   before this point.
2. `playwright` waits for your approval on `generated-code-tests`, then applies
   the same patch in a fresh job and runs the existing full Playwright Chromium
   suite, production build, the same patched Temurin 21 build as
   `playwright.yml` for the Firestore emulator, and the dedicated Clerk test
   application.
3. `test-report` posts the Playwright status and counts (passed, failed, flaky,
   skipped) as a comment on the draft PR.

The PR body therefore states that the suite has not run yet and links the run
awaiting your approval; the result arrives as a comment. HTML/JSON reports and
the proposal are private repository artifacts retained for three days; reports
may contain screenshots or authentication details. Missing reports are called
out explicitly. Failed tests or a failed Claude Code step leave a failed run and
a draft PR for inspection when a patch exists. Setup failures appear in the
workflow logs; a Jira read failure or empty patch creates no PR. Declining the
environment approval, or letting it expire, leaves the draft PR in place with no
test comment and nothing executed. Reruns create a fresh branch and draft PR
rather than overwriting work.

GitHub's built-in token does not trigger the separate PR/push workflows; the
Playwright job in this workflow is the validation for the generated patch.
`playwright.yml` takes over once you push a correction to the branch yourself,
and asks for approval again as a same-repo pull request. Review the diff and
results, make any corrections, and decide when to mark the PR ready and merge it
yourself. Jira status transitions stay manual.

The Playwright Planner and Generator agents stay a manual handoff for now: run
them yourself against the draft PR branch when the story needs new browser
coverage.

Local helper checks: `node --test .github/scripts/jira-claude.test.mjs`.

References: [Claude Code GitHub Actions](https://docs.claude.com/en/docs/claude-code/github-actions),
[claude-code-action inputs](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md),
[Jira issue REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get).
