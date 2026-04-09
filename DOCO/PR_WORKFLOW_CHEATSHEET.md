# PR Workflow Cheatsheet (Protected Main)

Use this flow to practice safe changes with the current repository restrictions.

## 1) Start from a clean local repo

```bash
git fetch origin
git switch main
git reset --hard origin/main
git pull --ff-only
git status
```

## 2) Create an issue (CLI)

```bash
gh issue create \
  --title "Short clear title" \
  --body "Problem, scope, acceptance criteria"
```

Optional labels/assignee:

```bash
gh issue create \
  --title "..." \
  --body "..." \
  --label "enhancement" \
  --assignee "@me"
```

## 3) Create a feature branch

```bash
git switch main
git pull --ff-only
git switch -c feat/<short-name>
```

## 4) Make changes and validate locally

```bash
# edit files
yarn install --immutable
yarn build
git status
```

## 5) Commit and push branch

```bash
git add -A
git commit -m "Clear commit message"
git push -u origin feat/<short-name>
```

## 6) Create PR (CLI)

```bash
gh pr create \
  --base main \
  --head feat/<short-name> \
  --title "Meaningful PR title" \
  --reviewer baudouinalbert \
  --body $'Closes #<issue-number>\n\n## Summary\n- ...\n\n## Test plan\n- [x] yarn build locally\n- [ ] yarn build workflow passes'
```

## 7) Monitor CI

```bash
gh run list --branch feat/<short-name>
gh run watch
```

Rerun a failed run:

```bash
gh run rerun <run-id>
```

Force a new run (no code change):

```bash
git commit --allow-empty -m "chore: retrigger CI"
git push
```

## 8) Handle approval/check gates

Check current PR gate state:

```bash
gh pr view <pr-number> --json reviewDecision,mergeStateStatus,statusCheckRollup
```

- `REVIEW_REQUIRED`: ask reviewer for fresh approval.
- `APPROVED` + checks green: ready to merge.

## 9) Merge without bypass

```bash
gh pr merge <pr-number> --squash --delete-branch
```

If GitHub says requirements are still processing:

```bash
gh pr merge <pr-number> --squash --delete-branch --auto
```

Do not use admin bypass for normal practice.

## 10) Approve deployment environment gates (CLI)

List main-branch runs:

```bash
gh run list --branch main
```

Get pending deployment details:

```bash
gh api repos/anchorwrite/logosophe/actions/runs/<RUN_ID>/pending_deployments
```

Approve pending deployment:

```bash
gh api \
  --method POST \
  repos/anchorwrite/logosophe/actions/runs/<RUN_ID>/pending_deployments \
  --input - <<'JSON'
{
  "environment_ids": [<ENV_ID>],
  "state": "approved",
  "comment": "Approved production deployment"
}
JSON
```

## 11) Post-merge local cleanup

```bash
git fetch origin
git switch main
git reset --hard origin/main
git pull --ff-only
```

## Quick fixes

- Push to `main` rejected: expected; open/merge via PR.
- PR blocked with green checks: inspect required check context/ruleset names.
- Local `main` diverged: reset to `origin/main` (see Steps 1 or 11).
