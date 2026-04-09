# GitHub Repository Hardening Plan (Final)

**Repo:** `anchorwrite/logosophe` (public)  
**Owners:** `plowden`, `baudouinalbert`  
**Date:** 2026-04-08  
**Purpose:** Merge the strongest parts of Plan A and Plan B into one execution-ready runbook.

---

## 1) Security and Process Goals

1. All changes flow through branches + pull requests (no direct pushes to `main`).
2. Deployments to production require a human approval gate.
3. CI `yarn build` is required before merge.
4. Code ownership requests both maintainers for every PR.
5. Exposed secrets are remediated and `.dev.vars` is removed from history.
6. Dead `CF_WORKERS_SCRIPTS_API_TOKEN` references are removed.
7. Merge strategy is squash-only with linear history.

---

## 2) Current-State Findings (Canonical)

1. `apps/worker/.dev.vars` was committed historically and is exposed in public history.
2. `CF_WORKERS_SCRIPTS_API_TOKEN` is already invalid/dead and no longer needed.
3. `AUTH_RESEND_KEY` must be treated as live until rotated.
4. Deployment workflows currently trigger too broadly (`push` on any branch).
5. Branch protection and environment gates are not yet enforcing desired policy.
6. `.gitignore` protection is inconsistent across root vs workspace scope.

---

## 3) Monorepo `.gitignore` Strategy (Root + Workspace)

This repository has multiple `.gitignore` files:

- Root `.gitignore`: global safety net for the whole repo.
- `apps/worker/.gitignore`: workspace-specific patterns.

How Git resolves them:

1. Root rules apply repo-wide.
2. Nested rules apply only in that subtree.
3. Deeper rules can override parent rules.
4. Ignore rules only affect untracked files; tracked files need `git rm --cached`.

Policy:

- Keep universal secret/env patterns in **root** `.gitignore`.
- Keep toolchain-specific noise (Next/OpenNext outputs, etc.) in workspace `.gitignore`.
- Do not rely on workspace `.gitignore` alone for secret protection.

---

## 4) Decisions

1. **Secret handling**
   - `AUTH_RESEND_KEY`: rotate immediately.
   - `CF_WORKERS_SCRIPTS_API_TOKEN`: delete everywhere; do not rotate.
2. **History rewrite**
   - Remove `apps/worker/.dev.vars` from all Git history via `git filter-repo`.
3. **Branch protection**
   - Require PR + 1 approval + code owner review.
   - Enforce for admins.
   - Require conversation resolution.
   - Require linear history.
4. **Merge policy**
   - Squash merge only.
5. **CI requirement**
   - Required status check context is `yarn build`.
6. **Deployment gate**
   - GitHub Environment `production` with required reviewers (`plowden`, `baudouinalbert`).
7. **Workflow modernization**
   - `actions/checkout@v5`, `actions/setup-node@v5`, Node `24`.

---

## 5) Execution Plan

Work top-to-bottom. Do not enable branch protection until the secret/history steps are complete.

### Phase 0 — Secret Remediation (Do First)

1. Rotate `AUTH_RESEND_KEY` in Resend.
2. Update the Worker runtime secret:

```bash
cd apps/worker
npx wrangler secret put AUTH_RESEND_KEY
```

3. Confirm `CF_WORKERS_SCRIPTS_API_TOKEN` is not needed and delete its GitHub secret:

```bash
gh secret delete CF_WORKERS_SCRIPTS_API_TOKEN --repo anchorwrite/logosophe
```

4. Update local `apps/worker/.dev.vars`:
   - remove `CF_WORKERS_SCRIPTS_API_TOKEN=...`
   - replace `AUTH_RESEND_KEY` with the new value

### Phase 1 — Untrack `.dev.vars` + Harden Root `.gitignore`

From repo root:

```bash
git rm --cached apps/worker/.dev.vars
```

Ensure root `.gitignore` contains:

```gitignore
# Environment files
.env
.env.local
.env*.local
.dev.vars
**/.dev.vars
```

Optional defensive additions:

```gitignore
*.pem
*.key
*.p12
*.pfx
id_rsa*
id_ed25519*
.ssh/
```

Commit and push this phase.

### Phase 2 — Rewrite Git History to Purge `.dev.vars`

Coordinate with collaborators first. Everyone must re-clone after force push.

```bash
brew install git-filter-repo
cd /Users/plowden/Developer/2026-04-08
cp -R logosophe logosophe.backup-pre-filter
cd logosophe
git filter-repo --path apps/worker/.dev.vars --invert-paths --force
git remote add origin git@github.com:anchorwrite/logosophe.git
git push origin main --force
```

Post-step:

- Tell `baudouinalbert` to re-clone.
- Keep in mind: rotation is the true mitigation; history scrub is cleanup.

### Phase 3 — Remove Dead Token References

Remove `CF_WORKERS_SCRIPTS_API_TOKEN` from:

1. `.github/workflows/worker-deployment.yaml`
2. `apps/worker/worker-configuration.d.ts`
3. local `apps/worker/.dev.vars`
4. `DOCO/SKEW_PROTECTION.md` (delete or replace with short OpenNext-native note)
5. `apps/worker/wrangler.jsonc` (if present)

Then regenerate types if needed:

```bash
cd apps/worker
yarn cf-typegen
```

### Phase 4 — Workflow Hardening and CI Standardization

1. Update workflows:
   - `.github/workflows/ci.yaml`
   - `.github/workflows/worker-deployment.yaml`
   - `.github/workflows/email-worker-deployment.yaml`
2. Enforce:
   - deploy triggers only on `main` (plus optional `workflow_dispatch`)
   - `environment: production` on both deploy jobs
   - Actions versions `v5`
   - Node `24`
3. CI job name should be `yarn build`.
4. Root `package.json` `build` script should represent full build gate for repo.

### Phase 5 — CODEOWNERS

Create `.github/CODEOWNERS`:

```text
* @plowden @baudouinalbert
```

### Phase 6 — GitHub Policy Controls

#### 6a) Promote collaborator role (if needed)

```bash
gh api -X PUT repos/anchorwrite/logosophe/collaborators/baudouinalbert \
  -f permission=admin
```

#### 6b) Create/update `production` environment reviewers

Get IDs:

```bash
gh api users/plowden --jq .id
gh api users/baudouinalbert --jq .id
```

Then:

```bash
gh api -X PUT repos/anchorwrite/logosophe/environments/production \
  --input - <<'EOF'
{
  "wait_timer": 0,
  "reviewers": [
    {"type": "User", "id": PLOWDEN_USER_ID},
    {"type": "User", "id": BAUDOUIN_USER_ID}
  ],
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
EOF
```

#### 6c) Branch protection for `main`

```bash
gh api -X PUT repos/anchorwrite/logosophe/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["yarn build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

#### 6d) Repo merge settings (squash-only)

```bash
gh api -X PATCH repos/anchorwrite/logosophe \
  -F allow_merge_commit=false \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true
```

---

## 6) Verification Checklist

Run:

```bash
gh api repos/anchorwrite/logosophe/branches/main/protection
gh api repos/anchorwrite/logosophe/environments/production
gh api repos/anchorwrite/logosophe/collaborators/baudouinalbert/permission
git log --all --oneline -- apps/worker/.dev.vars
```

Expected:

1. Branch protection includes:
   - required check `yarn build`
   - `enforce_admins: true`
   - code owner reviews
   - linear history
   - conversation resolution
2. `production` environment exists with required reviewers.
3. `.dev.vars` no longer appears in git history output.
4. Direct push to `main` is rejected.

---

## 7) End-to-End Test Flow (Issue -> PR -> Merge -> Deploy Approval)

1. Create issue.
2. Create branch and fix.
3. Open PR with `Closes #<issue>`.
4. Wait for required check `yarn build`.
5. Non-author approves PR.
6. Squash merge.
7. Both deployment workflows pause on environment approval.
8. Approve and verify deploy completion.
9. Confirm issue auto-closed.

---

## 8) Rollback / Escape Hatches

- Remove branch protection (temporary emergency):
  - `gh api -X DELETE repos/anchorwrite/logosophe/branches/main/protection`
- Remove or relax environment reviewer requirements in repo settings.
- Revert broken workflow changes through a PR.
- If history rewrite causes problems, use local backup created before `filter-repo`.

---

## 9) Optional Extras (High Value)

1. Enable GitHub secret scanning + push protection.
2. Enable Dependabot alerts/updates.
3. Add issue templates for structured triage.
4. Add CI status badges in README.
5. Require signed commits (if team accepts setup overhead).
