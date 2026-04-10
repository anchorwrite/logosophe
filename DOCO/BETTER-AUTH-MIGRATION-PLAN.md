# Better Auth Migration Plan (Logosophe)

Migration of `logosophe` from **Auth.js v5 beta** (`next-auth@5.0.0-beta.29` + `@auth/core@0.40.0` + `@auth/d1-adapter@1.10.0`) to **Better Auth v1.x**, preserving all authentication functionality and continuing to persist sessions in Cloudflare D1.

**Created:** 2026-04-10  
**Branch:** `feat/better-auth`  
**Tracking issue:** anchorwrite/logosophe#8  
**Approver:** baudouinalbert  
**Reference:** This plan is adapted from the completed anchorwrite migration. See `/Users/plowden/Developer/BETTER-AUTH-MIGRATION-PLAN-anchorwrite.md` (canonical) and `/Users/plowden/Developer/RBAC-REFERENCE-anchorwrite.md`.

---

## Progress Tracker

| Stage | Status | PR | Notes |
|---|---|---|---|
| Pre-Stage — Branch & Issue Setup | **Done** | — | Issue #8 created; branch `feat/better-auth` to be created |
| 1 — Verify CI/Safety | **Done (verify)** | — | `ci.yaml` already runs `yarn build` on PRs; `worker-deployment.yaml` gated on `main` push |
| 2 — D1 Schema Additions + Backfill | Pending | — | |
| 3 — Install Better Auth (inactive) | Pending | — | |
| 4 — Cutover | Pending | — | Closes #8 |
| 5 — Cleanup | Pending | — | Drop Auth.js tables and deps |

---

## 1. Summary of Current Auth Setup

### Providers (`apps/worker/app/auth.ts`)

| Provider | Purpose |
|---|---|
| `Credentials` | Admin / tenant sign-in via email + bcrypt password from `Credentials` D1 table |
| `Resend` (built-in next-auth provider) | Magic-link sign-in for users; sends via Resend HTTP API from `info@logosophe.com` |
| `Google` | OAuth; `prompt: "select_account"` |
| `Apple` | OAuth; `scope: 'name email'`, `response_mode: 'form_post'` |
| `LinkedIn` | OAuth; `scope: 'openid profile email'` |
| `MicrosoftEntraID` | OAuth; `scope: 'openid profile email'`, `issuer: https://login.microsoftonline.com/common/v2.0` |
| `TestProvider` | Admin-driven test sign-in for `test-user-NNN@logosophe.test` emails |

### D1 Adapter & Session Strategy

- `@auth/d1-adapter` against tables `users`, `accounts`, `sessions`, `verificationToken`
- `session.strategy: 'database'`, 30-day expiry
- Custom `jwt.encode` override (lines 401–444) manually creates D1 session rows for the Credentials provider (the standard Auth.js workaround for database sessions + credentials)
- `createCustomAdapter()` wraps standard adapter methods to inject a `role` property

### Session Role Assignment (`session` callback)

On every request, re-queries `Credentials` and `Subscribers` to compute `session.user.role`. Test users get role from email number range. Role values: `'admin' | 'tenant' | 'subscriber' | 'user'`.

### Sign-In Event (`events.signIn`)

On every sign-in:
1. Logs to `NormalizedLogging.logAuthentication()`
2. UPSERTs `Preferences(Email, CurrentProvider)` for non-Credentials users
3. Auto-provisions `TenantUsers` + `UserRoles` rows (`tenantId='default'`, `roleId='user'`) if none exist

### Sign-Out (`app/[lang]/signout/`)

- `actions.ts`: server action that logs sign-out, then calls `signOut()` from `@/auth`
- `sign-out-buttons.tsx`: client component that calls `handleSignOut()` server action, then `signOut({ redirect: false })` from `next-auth/react`

### Custom Auth Pages

- `app/[lang]/signin/page.tsx` — dual-card layout (User card: 4 OAuth + email magic link; Admin card: credentials form). Uses server actions calling `signIn(...)` from `@/auth`.
- `app/[lang]/signout/page.tsx` — confirmation screen

### Auth Surface in App

- ~188 server-side files call `auth()` from `@/auth`
- ~31 client-side files use `useSession()` / `signOut()` / `signIn()` from `next-auth/react`
- `app/providers.tsx` and `app/providers-no-i18n.tsx` wrap children in `<SessionProvider>`

---

## 2. What Changes vs. What Stays the Same

### Unchanged (do not touch)

- All RBAC tables and logic (`Credentials`, `Subscribers`, `TenantUsers`, `UserRoles`, `Roles`, `Permissions`, `RolePermissions`, `app/lib/access*.ts`, `isSystemAdmin`, `hasPermission`)
- Normalized logging code itself (`app/lib/normalized-logging.ts`) — only call sites move
- i18n / locale routing in `middleware.ts`
- All non-auth business logic, workflows, messaging, media, etc.
- GitHub Actions CI/CD workflows (already correct)
- Cloudflare secrets (reuse `AUTH_SECRET` as BA's `secret`)

### What changes

| Area | Auth.js v5 (current) | Better Auth (target) |
|---|---|---|
| Top-level config | `app/auth.ts` exports `{handlers, auth, signIn, signOut}` from `NextAuth(...)` | `app/auth.ts` exports `createAuth()` + thin `auth()` wrapper |
| Catch-all route | `app/api/auth/[...nextauth]/route.ts` | `app/api/auth/[...all]/route.ts` |
| Server session read | `await auth()` | Same call; thin wrapper hides `auth.api.getSession()` |
| Client provider | `<SessionProvider>` from `next-auth/react` | Removed; no provider needed |
| Client session hook | `useSession()` from `next-auth/react` | `authClient.useSession()` from `@/lib/auth-client` |
| Client sign-out | `signOut()` from `next-auth/react` | `authClient.signOut()` from `@/lib/auth-client` |
| OAuth initiation | Server action calling `signIn('google', ...)` | GET redirect to `/api/auth-social-init?provider=google&callbackUrl=...` (server actions cannot set BA's state cookies) |
| Magic-link initiation | Server action calling `signIn('resend', { email })` | Server action or route calling `auth.api.signInMagicLink({ email })` |
| Admin credentials sign-in | Server action calling `signIn('credentials', ...)` | Server action calling `auth.api.signInEmailPassword({ email, password })` via a POST to BA endpoint; requires adjusting the form action |
| Magic-link send | Built-in `Resend` provider | `magicLink` BA plugin + custom `sendMagicLink()` calling Resend HTTP API directly |
| Credentials provider | Auth.js `Credentials` + JWT-encode hack | BA `emailAndPassword` plugin (eliminates the 45-line encode override) |
| Session role storage | Recomputed on every request in `session` callback | Written at sign-in in `session.create.after` hook; `auth()` wrapper re-runs `computeUserRole()` for freshness |
| Account linking | `allowDangerousEmailAccountLinking: true` per provider | `account.accountLinking.enabled: true`, `trustedProviders: ['google','apple','linkedin','microsoft']` |
| Microsoft provider ID | `microsoft-entra-id` | `microsoft` → callback URL changes (see Risks §4) |
| D1 adapter | `@auth/d1-adapter` against `users/accounts/sessions/verificationToken` | Native D1 dialect (pass `env.DB` directly; no Kysely needed) |
| Test provider | `TestProvider` credentials provider + `signIn('test-credentials')` | Removed; rebuilt as `/api/test-sessions/sign-in-as` endpoint writing directly to BA `session` table |
| Cookie name | `authjs.session-token` | `better-auth.session_token` (all current cookies invalidated at cutover) |
| `export const runtime = "edge"` | Present in `app/auth.ts` | Remove (breaks OpenNext bundler when present in route-adjacent files) |

---

## 3. Key Gotchas (From Anchorwrite Migration)

These were real bugs hit during the anchorwrite cutover. Anticipate them here.

1. **`Response.redirect()` is immutable in Workers** — use `new Response(null, { status: 302, headers: { Location: url } })` instead.
2. **Relative `Location` headers** to avoid localhost port mismatch behind `cloudflared` proxy.
3. **`MAX(TEXT_col) GROUP BY` crashes workerd with SQLITE_CORRUPT** — replace with correlated subqueries using `ORDER BY col DESC LIMIT 1`.
4. **Server actions cannot set BA's OAuth state cookies** — OAuth buttons must redirect to a GET route handler (`/api/auth-social-init`), not call `auth.api.signInSocial()` inside a server action.
5. **`databaseHooks.account.create.before` throws are caught internally by BA** — if you need to block account creation and redirect, set a module-level flag and inspect it after `authInstance.handler()` returns in the route handler.
6. **Test users have no `TenantUsers` row** — add a `@logosophe.test` short-circuit to `checkAccess()` so test user sessions don't fail the tenant membership check.
7. **New admin users need BA `user` + `account` rows** — when creating a `Credentials` row in the dashboard, also insert a `user` row and a `credential` `account` row into the BA tables.
8. **Block/unblock must set `user.banned` column** — BA enforces this column; set it alongside any `Credentials` status change.
9. **No `export const runtime = "edge"` in new route files** — OpenNext bundler breaks if present.
10. **D1 binding is request-scoped** — `createAuth()` must be called inside each request handler (or lazily cached per-request), not at module level.

---

## 4. Risks & Tradeoffs

### Sessions invalidated at cutover (unavoidable)

All signed-in users are signed out the moment Stage 4 deploys. BA cookie format differs from Auth.js. **Users must sign back in.** The test matrix (§6) must be fully verified before committing.

### Microsoft OAuth callback URL changes

Auth.js: `/api/auth/callback/microsoft-entra-id`  
Better Auth: `/api/auth/callback/microsoft`

**Action required before Stage 4 deploys:** Add the new callback URL to the Microsoft Entra app registration in Azure (keep the old URL registered during transition; remove post-Stage 5).

Apple, Google, LinkedIn callback URLs **do not change**.

### Role-demotion latency

With Auth.js, `session.user.role` was recomputed on every request from `Credentials`/`Subscribers`. With BA, the role is written at sign-in and read from `user.role`. The `auth()` wrapper re-calls `computeUserRole()` to keep server-side role fresh, but `authClient.useSession()` on the client reads the stored `user.role` (only updated at next sign-in). Deactivating a subscriber demotes them only after their next sign-in.

Accepted tradeoff per anchorwrite precedent.

### `allowDangerousEmailAccountLinking` semantics differ

BA's `trustedProviders` list replicates the current per-provider behavior. Logosophe has no verified-subscriber account-linking gate (unlike anchorwrite), so no custom `before` hook is needed.

### Stage 5 is destructive

Dropping `users`/`accounts`/`sessions`/`verificationToken` is irreversible. Take a D1 backup immediately before applying Stage 5 SQL. Only run Stage 5 after Stage 4 has been live for several days.

---

## 5. Staged Deployment Plan

### Conventions

- All work on `feat/better-auth` branch
- Each stage = its own PR from `feat/better-auth` → `main`
- `yarn build` must succeed AND manual tests must pass before every commit
- D1 migrations applied with `wrangler d1 execute logosophe`
- Baudouin (baudouinalbert) approves all PRs before squash-merge

---

### Pre-Stage: Branch & Issue Setup

```bash
cd /Users/plowden/Developer/logosophe
git checkout -b feat/better-auth
git push -u origin feat/better-auth
# Issue #8 already created
```

---

### Stage 1 — Verify CI/Safety (no PR required)

**Confirm all of the following are already in place:**

- [ ] `ci.yaml` runs `yarn build` on every PR targeting `main` ✅ (job name: "yarn build")
- [ ] `worker-deployment.yaml` deploys only on push to `main` ✅
- [ ] Branch protection on `main`: 1 required PR approval + `yarn build` status check ← **verify in GitHub branch settings**
- [ ] Confirm `production` GitHub environment policy is `main` branch only ✅ (referenced in `worker-deployment.yaml`)

**If branch protection is not set**, configure it now at:  
`https://github.com/anchorwrite/logosophe/settings/branches`

No code changes; no PR needed for Stage 1.

---

### Stage 2 — D1 Schema Additions + Backfill

**Goal:** Better Auth tables exist alongside Auth.js tables, populated from existing user data. Old auth still in use; nothing breaks.

**File to create:** `packages/database/migrations/014-better-auth-tables.sql`

```sql
-- Migration: 014-better-auth-tables.sql
-- Description: Create Better Auth schema alongside existing Auth.js tables, backfill data
-- Created: 2026-04-10

-- =============================================================================
-- BETTER AUTH TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "role" TEXT,
    "banned" INTEGER DEFAULT 0,
    "banReason" TEXT,
    "banExpires" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TEXT,
    "refreshTokenExpiresAt" TEXT,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    UNIQUE ("providerId", "accountId")
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ba_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_ba_session_userId ON "session"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_ba_session_expiresAt ON "session"(expiresAt);
CREATE INDEX IF NOT EXISTS idx_ba_account_userId ON "account"(userId);
CREATE INDEX IF NOT EXISTS idx_ba_account_provider ON "account"(providerId, accountId);
CREATE INDEX IF NOT EXISTS idx_ba_verification_identifier ON "verification"(identifier);
CREATE INDEX IF NOT EXISTS idx_ba_verification_expiresAt ON "verification"(expiresAt);

-- =============================================================================
-- BACKFILL FROM AUTH.JS TABLES
-- Only runs if the Auth.js `users` table exists (it may be empty in local dev).
-- =============================================================================

-- user: copy from Auth.js users table, computing role from Credentials/Subscribers.
-- microsoft-entra-id provider will be remapped to 'microsoft' in the account backfill.
INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, image, role, createdAt, updatedAt)
SELECT
    u.id,
    u.name,
    u.email,
    CASE WHEN u.emailVerified IS NOT NULL THEN 1 ELSE 0 END,
    u.image,
    CASE
        WHEN c.Role IN ('admin', 'tenant') THEN c.Role
        WHEN s.Email IS NOT NULL THEN 'subscriber'
        ELSE 'user'
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users u
LEFT JOIN Credentials c ON c.Email = u.email
LEFT JOIN Subscribers s ON s.Email = u.email AND s.Active = TRUE AND s.EmailVerified IS NOT NULL
WHERE u.email IS NOT NULL;

-- account: copy OAuth accounts, remapping microsoft-entra-id → microsoft
INSERT OR IGNORE INTO "account" (id, userId, providerId, accountId, accessToken, refreshToken, idToken, accessTokenExpiresAt, scope, createdAt, updatedAt)
SELECT
    a.id,
    a.userId,
    CASE WHEN a.provider = 'microsoft-entra-id' THEN 'microsoft' ELSE a.provider END,
    a.providerAccountId,
    a.access_token,
    a.refresh_token,
    a.id_token,
    CASE WHEN a.expires_at IS NOT NULL THEN datetime(a.expires_at, 'unixepoch') ELSE NULL END,
    a.scope,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM accounts a
WHERE a.userId IN (SELECT id FROM "user");

-- account: backfill Credentials passwords (bcrypt hashes) as providerId='credential'
INSERT OR IGNORE INTO "account" (id, userId, providerId, accountId, password, createdAt, updatedAt)
SELECT
    lower(hex(randomblob(16))),
    u.id,
    'credential',
    c.Email,
    c.Password,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM Credentials c
JOIN "user" u ON u.email = c.Email
WHERE NOT EXISTS (
    SELECT 1 FROM "account" a WHERE a.userId = u.id AND a.providerId = 'credential'
);
```

> **Note:** The backfill SQL references `users` and `accounts` (Auth.js tables). If the local D1 is empty (fresh dev environment), the backfill inserts will silently produce 0 rows — that is fine. The table creation always succeeds.

**Back up both databases BEFORE applying the migration:**
```bash
cd apps/worker

# Local backup
yarn wrangler d1 export logosophe --local --output=../../database-backup-pre-better-auth-local.sql

# Remote backup
yarn wrangler d1 export logosophe --remote --output=../../database-backup-pre-better-auth-remote.sql
```

**Apply locally and verify:**
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --local --file=../../packages/database/migrations/014-better-auth-tables.sql

# Confirm tables exist (counts may be 0 in fresh local dev)
yarn wrangler d1 execute logosophe --local --command 'SELECT COUNT(*) FROM "user"'
yarn wrangler d1 execute logosophe --local --command 'SELECT COUNT(*) FROM "account"'
yarn wrangler d1 execute logosophe --local --command 'SELECT role, COUNT(*) FROM "user" GROUP BY role'

# App must still behave identically (Auth.js still in use)
yarn build
yarn dev
# Sign in / sign out — confirm normal flow unchanged
```

**Commit + PR:**
```bash
git add packages/database/migrations/014-better-auth-tables.sql
git commit -m "feat(d1): create Better Auth tables and backfill from Auth.js schema"
git push
gh pr create --repo anchorwrite/logosophe --base main --head feat/better-auth \
  --title "Stage 2: create Better Auth D1 tables and backfill" \
  --body "Adds migration 014. Creates user/session/account/verification tables alongside existing Auth.js tables and backfills user data with role computed from Credentials/Subscribers. No app code changes; old auth still in use. Closes #8." 
```

> Remove `Closes #8` from Stage 2 PR body — only the Stage 4 cutover PR should close it.

**Apply to production D1 after merge:**
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --remote --file=../../packages/database/migrations/014-better-auth-tables.sql
yarn wrangler d1 execute logosophe --remote --command 'SELECT COUNT(*) FROM "user"'
yarn wrangler d1 execute logosophe --remote --command 'SELECT role, COUNT(*) FROM "user" GROUP BY role'
```

---

### Stage 3 — Install Better Auth (Code-Inactive)

**Goal:** BA installed and configured but not wired to any route. Build passes; old auth unchanged.

**Install:**
```bash
cd apps/worker
yarn add better-auth
```

> **No Kysely packages.** Better Auth v1.5+ has native Cloudflare D1 support — pass `env.DB` directly. `kysely` and `kysely-d1` must NOT be installed (known bug with BA's session queries).

**Create `apps/worker/app/lib/auth-client.ts`:**
```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
});
```

**Create `apps/worker/app/auth-better.ts`** (skeleton — not yet imported by routes):
```typescript
import { betterAuth } from 'better-auth';
import { magicLink, admin } from 'better-auth/plugins';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Placeholder — will be completed in Stage 4
export async function createAuth() {
  const { env } = await getCloudflareContext({ async: true });
  return betterAuth({
    database: env.DB,
    secret: process.env.AUTH_SECRET,
  });
}
```

**Verify:**
```bash
yarn build   # Must succeed. Old auth still wired.
yarn dev
# Sign in / sign out — confirm no behavior change
```

**Commit + PR:**
```bash
git add apps/worker/package.json apps/worker/yarn.lock \
        apps/worker/app/lib/auth-client.ts \
        apps/worker/app/auth-better.ts
git commit -m "feat(auth): scaffold Better Auth server config and client (inactive)"
git push
gh pr create --repo anchorwrite/logosophe --base main --head feat/better-auth \
  --title "Stage 3: scaffold Better Auth (not wired)" \
  --body "Installs better-auth and adds inactive scaffolding files. No behavior change. No Kysely packages."
```

---

### Stage 4 — Cutover (The Big One)

**Goal:** Replace Auth.js v5 with Better Auth across the codebase. All 6 providers working (Google, Apple, LinkedIn, Microsoft, Email magic-link, Credentials admin). Custom sign-in/sign-out pages preserved.

**Pre-flight checklist (BEFORE pushing this stage):**
- [ ] Add `https://www.logosophe.com/api/auth/callback/microsoft` to the Microsoft Entra app registration in Azure (keep old `microsoft-entra-id` URL during transition)
- [ ] Confirm Apple, Google, LinkedIn callback URLs are unchanged: `/api/auth/callback/{apple|google|linkedin}`
- [ ] Confirm Cloudflare environment secrets are set: `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_APPLE_ID/SECRET`, `AUTH_LINKEDIN_ID/SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER`, `AUTH_RESEND_KEY`
- [ ] Back up local D1: `cd apps/worker && yarn wrangler d1 export logosophe --local --output=../../database-backup-pre-stage4-local.sql`
- [ ] Back up remote D1: `cd apps/worker && yarn wrangler d1 export logosophe --remote --output=../../database-backup-pre-stage4-remote.sql`

---

#### Files Deleted

- `apps/worker/app/api/auth/[...nextauth]/route.ts`
- `apps/worker/app/lib/test-provider.ts`
- `apps/worker/app/auth-better.ts` (merged into `app/auth.ts`)

#### Files Created

- `apps/worker/app/api/auth/[...all]/route.ts` — BA catch-all handler
- `apps/worker/app/api/auth-social-init/route.ts` — GET route for OAuth initiation (server actions cannot set BA state cookies)
- `apps/worker/app/api/test-sessions/sign-in-as/route.ts` — admin-only back-door: writes directly to BA `session` table
- `apps/worker/app/[lang]/signin/account-linking-error/page.tsx` — account linking error page (does not exist yet in logosophe)

#### Files Rewritten

- `apps/worker/app/auth.ts` — full replacement (see sketch below)
- `apps/worker/app/providers.tsx` — remove `<SessionProvider>`
- `apps/worker/app/providers-no-i18n.tsx` — remove `<SessionProvider>`
- `apps/worker/app/[lang]/signin/page.tsx` — OAuth buttons become links to `/api/auth-social-init`; email magic-link and credentials forms updated
- `apps/worker/app/[lang]/signout/sign-out-buttons.tsx` — replace `signOut` from `next-auth/react` with `authClient.signOut()`
- `apps/worker/app/[lang]/signout/actions.ts` — replace `signOut` from `@/auth` with `auth.api.signOut({ headers })`; query `user`/`account` tables (not `users`/`accounts`)
- `apps/worker/app/test-signin/page.tsx` — replace `signIn('test-credentials', ...)` + `useSession` from next-auth with BA session token consumption + `authClient.useSession()`
- `apps/worker/app/components/TestUserSignIn.tsx` — single-user-mode calls new `/api/test-sessions/sign-in-as`; replace `useSession`/`signOut` from next-auth
- `apps/worker/app/api/test-sessions/create/route.ts` — also upsert BA `user` row and INSERT BA `session` row
- `apps/worker/app/api/test-sessions/list/route.ts` — JOIN TestSessions with BA `session` for live status
- `apps/worker/app/api/test-sessions/[id]/route.ts` — delete from BA `session` table too
- `apps/worker/app/api/test-sessions/clear-all/route.ts` — bulk delete from BA `session` table
- `apps/worker/app/api/test-sessions/validate/route.ts` — validate token against BA `session` table
- **All 31 client files using `useSession`/`signOut`/`signIn` from `next-auth/react`** → import from `@/lib/auth-client` and use `authClient.useSession()` / `authClient.signOut()`:

  ```
  apps/worker/app/api/admin/users/route.ts
  apps/worker/app/api/admin/users/[email]/route.ts
  apps/worker/app/dashboard/profile/ProfilePageClient.tsx
  apps/worker/app/dashboard/customers/page.tsx
  apps/worker/app/dashboard/avatars/PresetAvatarsManager.tsx
  apps/worker/app/components/harbor/subscriber-pages/BlogRatings.tsx
  apps/worker/app/components/harbor/subscriber-pages/BlogComments.tsx
  apps/worker/app/components/harbor/subscriber-pages/AnnouncementManager.tsx
  apps/worker/app/components/content/ContentViewer.tsx
  apps/worker/app/components/Header/index.tsx
  apps/worker/app/api/admin/users/[email]/tenants/route.ts
  apps/worker/app/[lang]/pages/[handle]/page.tsx
  apps/worker/app/[lang]/pages/[handle]/blog/[postId]/page.tsx
  apps/worker/app/[lang]/harbor/subscriber-pages/page.tsx
  apps/worker/app/[lang]/harbor/preview/[handle]/page.tsx
  apps/worker/app/[lang]/harbor/page.tsx
  apps/worker/app/[lang]/harbor/appbar.tsx
  apps/worker/app/lib/theme-context.tsx
  apps/worker/app/components/SubscriberPagesAppBar.tsx
  apps/worker/app/components/ProfileForm.tsx
  apps/worker/app/components/ProfileFormClient.tsx
  apps/worker/app/components/WorkflowInterface.tsx
  apps/worker/app/contexts/MessagingContext.tsx
  apps/worker/app/contexts/WorkflowMessagingContext.tsx
  apps/worker/app/hooks/useUnreadMessageCount.ts
  ```

> The ~188 server-side files that call `auth()` from `@/auth` do **not** need changes — the `auth()` wrapper signature is preserved.

---

#### New `apps/worker/app/auth.ts` (full sketch)

```typescript
import { betterAuth } from 'better-auth';
import { magicLink, admin } from 'better-auth/plugins';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers as nextHeaders } from 'next/headers';
import { NormalizedLogging, createNormalizedMetadata } from '@/lib/normalized-logging';

// ─── Resend magic-link sender ────────────────────────────────────────────────

async function sendMagicLink({
  email,
  url,
}: {
  email: string;
  url: string;
  token: string;
}) {
  const verificationUrl = new URL(url);
  // Keep the same callbackUrl convention as the current Resend provider
  verificationUrl.searchParams.set('callbackUrl', '/harbor');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'info@logosophe.com',
      to: email,
      subject: `Sign in to ${verificationUrl.host}`,
      html: `
        <body style="background: #f9f9f9;">
          <table width="100%" border="0" cellspacing="20" cellpadding="0"
            style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;">
            <tr>
              <td align="center"
                style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
                Sign in to <strong>${verificationUrl.host}</strong>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="border-radius: 5px;" bgcolor="#346df1">
                      <a href="${verificationUrl.toString()}"
                        target="_blank"
                        style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #fff; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid #346df1; display: inline-block; font-weight: bold;">
                        Sign in
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center"
                style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
                If you did not request this email you can safely ignore it.
              </td>
            </tr>
          </table>
        </body>
      `,
      text: `Sign in to ${verificationUrl.host}\n${verificationUrl.toString()}\n\n`,
    }),
  });
}

// ─── Role computation (same logic as current session callback) ───────────────

export async function computeUserRole(
  email: string,
  db: D1Database
): Promise<'admin' | 'tenant' | 'subscriber' | 'user'> {
  const credResult = await db
    .prepare('SELECT Role FROM Credentials WHERE Email = ?')
    .bind(email)
    .first<{ Role: string }>();
  if (credResult?.Role === 'admin' || credResult?.Role === 'tenant') {
    return credResult.Role as 'admin' | 'tenant';
  }

  const subscriberResult = await db
    .prepare(
      'SELECT 1 FROM Subscribers WHERE Email = ? AND Active = TRUE AND EmailVerified IS NOT NULL'
    )
    .bind(email)
    .first();
  if (subscriberResult) return 'subscriber';

  return 'user';
}

// ─── Better Auth instance (request-scoped — D1 not available at module level) ─

export async function createAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  return betterAuth({
    database: db,
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.AUTH_URL || 'https://www.logosophe.com',
    trustedOrigins: [
      'https://www.logosophe.com',
      'https://local-dev.logosophe.com',
      'http://localhost:3001',
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,  // 30 days
      updateAge: 60 * 60 * 24,        // refresh if older than 1 day
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      },
      apple: {
        clientId: process.env.AUTH_APPLE_ID!,
        clientSecret: process.env.AUTH_APPLE_SECRET!,
      },
      linkedin: {
        clientId: process.env.AUTH_LINKEDIN_ID!,
        clientSecret: process.env.AUTH_LINKEDIN_SECRET!,
      },
      microsoft: {
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
        tenantId: 'common',
      },
    },
    emailAndPassword: {
      enabled: true,  // powers Credentials admin sign-in
    },
    plugins: [
      magicLink({
        sendMagicLink,
        expiresIn: 60 * 60 * 24,  // 24 hours
      }),
      admin({
        adminRoles: ['admin'],
        // Disable BA's built-in admin HTTP endpoints — we have our own dashboard
        disableRoutes: true,
      }),
    ],
    account: {
      accountLinking: {
        enabled: true,
        // Preserves current allowDangerousEmailAccountLinking: true behaviour
        trustedProviders: ['google', 'apple', 'linkedin', 'microsoft'],
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async ({ session }) => {
            // Runs after every new session (sign-in from any provider)
            try {
              const { env: hookEnv } = await getCloudflareContext({ async: true });
              const hookDb = hookEnv.DB;

              // 1. Look up the user email from BA's user table
              const baUser = await hookDb
                .prepare('SELECT email FROM "user" WHERE id = ?')
                .bind(session.userId)
                .first<{ email: string }>();
              if (!baUser?.email) return;

              const email = baUser.email;

              // 2. Compute role and write back to user.role
              const role = await computeUserRole(email, hookDb);
              await hookDb
                .prepare('UPDATE "user" SET role = ?, updatedAt = ? WHERE id = ?')
                .bind(role, new Date().toISOString(), session.userId)
                .run();

              // 3. Skip Preferences + TenantUsers provisioning for admin/tenant users
              const isCredentialsUser = await hookDb
                .prepare('SELECT 1 FROM Credentials WHERE Email = ?')
                .bind(email)
                .first();
              if (isCredentialsUser) return;

              // 4. Upsert Preferences (CurrentProvider)
              //    Determine provider from BA account table
              const accountRow = await hookDb
                .prepare(
                  'SELECT providerId FROM "account" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
                )
                .bind(session.userId)
                .first<{ providerId: string }>();
              const provider = accountRow?.providerId || 'credential';

              const existingPrefs = await hookDb
                .prepare('SELECT 1 FROM Preferences WHERE Email = ?')
                .bind(email)
                .first();
              if (existingPrefs) {
                await hookDb
                  .prepare(
                    'UPDATE Preferences SET CurrentProvider = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?'
                  )
                  .bind(provider, email)
                  .run();
              } else {
                await hookDb
                  .prepare(
                    "INSERT INTO Preferences (Email, Theme, Language, CurrentProvider, CreatedAt, UpdatedAt) VALUES (?, 'light', 'en', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                  )
                  .bind(email, provider)
                  .run();
              }

              // 5. Auto-provision TenantUsers + UserRoles for 'default' tenant
              const hasTenantRow = await hookDb
                .prepare('SELECT 1 FROM TenantUsers WHERE Email = ?')
                .bind(email)
                .first();
              if (!hasTenantRow) {
                await hookDb
                  .prepare(
                    "INSERT INTO TenantUsers (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
                  )
                  .bind(email)
                  .run();
                const hasUserRole = await hookDb
                  .prepare(
                    "SELECT 1 FROM UserRoles WHERE TenantId = 'default' AND Email = ? AND RoleId = 'user'"
                  )
                  .bind(email)
                  .first();
                if (!hasUserRole) {
                  try {
                    await hookDb
                      .prepare(
                        "INSERT INTO UserRoles (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
                      )
                      .bind(email)
                      .run();
                  } catch {
                    // Ignore FK constraint errors silently
                  }
                }
              }

              // 6. Log authentication event
              //    (IP/UA not available in hook; log what we can)
              const normalizedLogging = new NormalizedLogging(hookDb);
              const authMetadata = createNormalizedMetadata({
                sessionStartTime: new Date().toISOString(),
                provider,
                operationType: 'user_signin',
              });
              await normalizedLogging.logAuthentication({
                userEmail: email,
                userId: session.userId,
                provider,
                activityType: 'signin',
                accessType: 'auth',
                targetId: email,
                targetName: `${email} (${provider})`,
                ipAddress: session.ipAddress || 'unknown',
                userAgent: session.userAgent || 'unknown',
                metadata: authMetadata,
              });
            } catch (err) {
              console.error('session.create.after hook error:', err);
            }
          },
        },
      },
    },
  });
}

// ─── Thin auth() helper — same signature as Auth.js's auth() ─────────────────
// Preserves the ~188 import sites that call auth() from '@/auth'

export async function auth() {
  const instance = await createAuth();
  const hdrs = await nextHeaders();
  const session = await instance.api.getSession({ headers: hdrs });
  if (!session) return null;

  // Re-run computeUserRole for freshness (mirrors the Auth.js session callback)
  const { env } = await getCloudflareContext({ async: true });
  const role = await computeUserRole(session.user.email, env.DB);

  return {
    ...session,
    user: {
      ...session.user,
      role,
    },
    expires: new Date(session.session.expiresAt).toISOString(),
  };
}
```

---

#### New `apps/worker/app/api/auth/[...all]/route.ts`

```typescript
import { createAuth } from '@/auth';

export async function GET(request: Request) {
  const auth = await createAuth();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const auth = await createAuth();
  return auth.handler(request);
}
```

#### New `apps/worker/app/api/auth-social-init/route.ts`

```typescript
// GET /api/auth-social-init?provider=google&callbackUrl=/en/harbor
// Initiates OAuth via a proper GET handler so BA can set state cookies.
// Server actions cannot set these cookies — this route solves that.

import { createAuth } from '@/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const callbackUrl = searchParams.get('callbackUrl') || '/harbor';

  if (!provider) {
    return new Response('Missing provider', { status: 400 });
  }

  const auth = await createAuth();
  const response = await auth.api.signInSocial({
    body: { provider, callbackURL: callbackUrl },
    headers: request.headers,
  });

  return response;
}
```

---

#### Updated `apps/worker/app/[lang]/signin/page.tsx` — OAuth buttons

Replace each server-action `<form>` for OAuth with a plain redirect link:

```tsx
// Before (server action):
<form action={async () => { 'use server'; await signIn('google', { callbackUrl: `/${lang}/harbor` }) }}>
  <Button type="submit">Continue with Google</Button>
</form>

// After (plain link → GET route):
<a href={`/api/auth-social-init?provider=google&callbackUrl=/${lang}/harbor`}>
  <Button>Continue with Google</Button>
</a>
```

For the **email magic-link form**, call the BA endpoint directly via a server action:
```tsx
action={async (formData) => {
  'use server'
  const email = formData.get('email') as string
  const auth = await createAuth()
  await auth.api.signInMagicLink({
    body: { email, callbackURL: `/${lang}/harbor` },
    headers: await headers(),
  })
  redirect(`/${lang}/signin?magicLinkSent=true`)
}}
```

For the **admin credentials form**, call BA's email-and-password endpoint:
```tsx
action={async (formData) => {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Check if admin first (to determine redirect target)
  const context = await getCloudflareContext({ async: true })
  const isAdmin = await context.env.DB.prepare(
    'SELECT 1 FROM Credentials WHERE Email = ?'
  ).bind(email).first()
  
  const auth = await createAuth()
  const response = await auth.api.signInEmailPassword({
    body: { email, password },
    headers: await headers(),
  })
  
  if (!response.ok) {
    redirect(`/${lang}/signin?error=CredentialsSignin`)
  }
  
  redirect(isAdmin ? '/dashboard' : `/${lang}/harbor`)
}}
```

---

#### Updated `apps/worker/app/[lang]/signout/actions.ts`

```typescript
'use server'

import { createAuth, auth } from '@/auth'
import { NormalizedLogging } from '@/lib/normalized-logging'
import { headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function handleSignOut() {
  try {
    const context = await getCloudflareContext({ async: true })
    const db = context.env.DB
    const headersList = await headers()
    const session = await auth()

    if (session?.user?.email) {
      try {
        const email = session.user.email

        // Determine provider from BA account table (not Auth.js accounts table)
        const accountRow = await db
          .prepare('SELECT providerId FROM "account" WHERE userId = ? LIMIT 1')
          .bind(session.user.id)
          .first<{ providerId: string }>()
        const provider = accountRow?.providerId || 'credential'

        const sessionStartTime = new Date(session.expires)
        sessionStartTime.setDate(sessionStartTime.getDate() - 30)
        const endTime = new Date()
        const sessionDuration = Math.round(
          (endTime.getTime() - sessionStartTime.getTime()) / 1000
        )

        const normalizedLogging = new NormalizedLogging(db)
        await normalizedLogging.logAuthentication({
          userEmail: email,
          userId: session.user.id,
          provider,
          activityType: 'signout',
          accessType: 'auth',
          targetId: email,
          targetName: `${email} (${provider})`,
          ipAddress: headersList.get('x-forwarded-for') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          metadata: {
            sessionDuration,
            sessionStartTime: sessionStartTime.toISOString(),
            sessionEndTime: endTime.toISOString(),
          },
        })
      } catch (err) {
        console.error('Error during sign-out logging:', err)
      }
    }

    const authInstance = await createAuth()
    await authInstance.api.signOut({ headers: await headers() })
  } catch (error) {
    if (!(error instanceof Error && error.message === 'NEXT_REDIRECT')) {
      console.error('Signout error:', error)
      throw error
    }
  }
}
```

---

#### Updated `apps/worker/app/[lang]/signout/sign-out-buttons.tsx`

```typescript
'use client'

import { Flex, Button } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { handleSignOut } from './actions'

export function SignOutButtons({ lang, translations }) {
  const router = useRouter()

  const handleNo = (e: React.MouseEvent) => {
    e.preventDefault()
    router.back()
  }

  const handleYes = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await handleSignOut()
      await authClient.signOut()
      window.location.href = `/${lang}`
    } catch (error) {
      console.error('Error during signout:', error)
    }
  }

  return (
    <Flex gap="3" mt="4">
      <Button onClick={handleNo} variant="soft" color="gray">{translations.staySignedIn}</Button>
      <Button onClick={handleYes} variant="solid" color="red">{translations.yesSignOut}</Button>
    </Flex>
  )
}
```

---

#### Updated `apps/worker/app/api/test-sessions/create/route.ts` additions

In addition to inserting into `TestSessions`, also:
1. Upsert a row in BA's `user` table for the test user email
2. Insert a row in BA's `session` table — the `token` field becomes the session URL token

```typescript
// After inserting into TestSessions, also create BA session:
const testUserId = `test-user-${userNumber}`;
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

await db.prepare(`
  INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, createdAt, updatedAt)
  VALUES (?, ?, ?, 1, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).bind(testUserId, `Test User ${userNumber}`, testUserEmail).run();

await db.prepare(`
  INSERT OR REPLACE INTO "session" (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
  VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).bind(testUserId, sessionToken, expiresAt, ipAddress, userAgent).run();
```

The `sessionUrl` now points to `/test-signin?token=${sessionToken}` where the token is both in `TestSessions` and BA's `session` table.

---

#### `apps/worker/app/api/test-sessions/sign-in-as/route.ts` (new)

Admin-only back-door for single-user-mode (instant sign-in as a test user from the dashboard):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth, createAuth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isSystemAdmin } from '@/lib/access';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  if (!(await isSystemAdmin(session.user.email, db))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { testUserEmail } = await request.json() as { testUserEmail: string };
  if (!testUserEmail?.endsWith('@logosophe.test')) {
    return NextResponse.json({ error: 'Invalid test user email' }, { status: 400 });
  }

  const match = testUserEmail.match(/test-user-(\d+)@logosophe\.test/);
  if (!match) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  const userNumber = parseInt(match[1], 10);

  const testUserId = `test-user-${userNumber}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

  await db.prepare(`
    INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, createdAt, updatedAt)
    VALUES (?, ?, ?, 1, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(testUserId, `Test User ${userNumber}`, testUserEmail).run();

  await db.prepare(`
    INSERT INTO "session" (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, '', 'test-admin-signin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(testUserId, token, expiresAt).run();

  // Return the session token as a cookie-set response
  // The client will set document.cookie or redirect to /test-signin?token=...
  return NextResponse.json({ success: true, token, testUserEmail });
}
```

---

**Local verification (BEFORE committing — every test must pass):**

```bash
yarn build   # Must succeed
yarn dev     # In one terminal
cloudflared tunnel run local-dev   # In another terminal
```

---

### Stage 5 — Cleanup (Drop Auth.js Tables & Dependencies)

**Goal:** Remove the legacy Auth.js v5 code and tables. Only after Stage 4 has been live and verified for several days.

**Pre-flight:**
- [ ] Back up local D1: `cd apps/worker && yarn wrangler d1 export logosophe --local --output=../../database-backup-pre-stage5-local.sql`
- [ ] Back up remote D1: `cd apps/worker && yarn wrangler d1 export logosophe --remote --output=../../database-backup-pre-stage5-remote.sql`

**Create `packages/database/migrations/015-drop-authjs-tables.sql`:**

```sql
-- Migration: 015-drop-authjs-tables.sql
-- Description: Drop legacy Auth.js v5 tables after Better Auth migration is verified
-- Created: TBD (run only after Stage 4 has been live and verified)

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_emailVerified;
DROP INDEX IF EXISTS idx_accounts_userId;
DROP INDEX IF EXISTS idx_accounts_provider;
DROP INDEX IF EXISTS idx_accounts_providerAccountId;
DROP INDEX IF EXISTS idx_sessions_userId;
DROP INDEX IF EXISTS idx_sessions_sessionToken;
DROP INDEX IF EXISTS idx_sessions_expires;
DROP INDEX IF EXISTS idx_verificationToken_token;
DROP INDEX IF EXISTS idx_verificationToken_expires;

DROP TABLE IF EXISTS verificationToken;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;
```

**Remove dependencies:**
```bash
cd apps/worker
yarn remove next-auth @auth/core @auth/d1-adapter
yarn cf-typegen   # Regenerate Cloudflare types
```

**Also remove from `worker-deployment.yaml`:**
- Remove `AUTH_REDIRECT_PROXY_URL` env var (Auth.js-specific)

**Apply locally and build:**
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --local --file=../../packages/database/migrations/015-drop-authjs-tables.sql
yarn build   # Must succeed
yarn dev
# Re-run a subset of the test matrix: tests 1, 4, 5, 14
```

**Commit + PR:**
```bash
git add -A
git commit -m "chore(auth): drop Auth.js tables and dependencies"
git push
gh pr create --repo anchorwrite/logosophe --base main --head feat/better-auth \
  --title "Stage 5: drop Auth.js tables and dependencies" \
  --body "Final cleanup. Drops users/accounts/sessions/verificationToken and removes next-auth + @auth/* dependencies."
```

**Apply to production D1 after merge:**
```bash
cd apps/worker
yarn wrangler d1 execute logosophe --remote --file=../../packages/database/migrations/015-drop-authjs-tables.sql
```

**Post-Stage-5:** Remove the old `microsoft-entra-id` callback URL from the Azure app registration.

---

## 6. Test Matrix (Stage 4 — Every Test Must Pass Before Committing)

Test against `https://local-dev.logosophe.com` in a fresh browser profile (clear all cookies first).

| # | Flow | Expected |
|---|---|---|
| 1 | Visit `/en/signin`, click "Continue with Google" | OAuth flow → redirected to `/en/harbor` signed in |
| 2 | Sign out via `/en/signout` | Cookies cleared, redirected to `/en` |
| 3 | Repeat #1–#2 for Apple, LinkedIn, Microsoft | All four OAuth providers work |
| 4 | Visit `/en/signin`, enter email, click "Continue with Email" | Resend email sent; click magic link → `/en/harbor` signed in |
| 5 | Visit `/en/signin`, enter admin email + password in Admin card | Redirected to `/dashboard` |
| 6 | Sign out from dashboard via `/en/signout` | Cookies cleared, redirected to `/en` |
| 7 | Sign in via Google with email that has a verified Subscriber row | Links successfully; single user record |
| 8 | Sign in via Google with email that is NOT a verified subscriber but already exists | Account linking proceeds (logosophe has no gating on this unlike anchorwrite) |
| 9 | As admin, visit `/dashboard/test-users`, use single-user mode | Admin signed out, signed in as test user, redirected to `/en/harbor` |
| 10 | As admin, use multi-user mode, click a test user | Session URL copied to clipboard; row appears in active sessions list |
| 11 | Open session URL in a different browser | Signed in as that test user |
| 12 | As admin, click test user button again to terminate | Test user instantly signed out (next request) |
| 13 | As admin, hit "Clear all" | All test sessions removed |
| 14 | Navigate dashboard / harbor pages as each role | All `auth()` server reads return expected session; all `authClient.useSession()` client reads return correct data |
| 15 | `session.user.role` for admin user | `'admin'` |
| 16 | `session.user.role` for tenant user | `'tenant'` |
| 17 | `session.user.role` for verified subscriber | `'subscriber'` |
| 18 | `session.user.role` for OAuth user (not in Credentials or Subscribers) | `'user'` |
| 19 | Verify `Preferences.CurrentProvider` is updated after each sign-in | DB row reflects correct provider |
| 20 | Verify `NormalizedLogging` rows written for sign-in and sign-out | DB rows present with correct provider, IP, UA |
| 21 | New email signing in via Google → auto-creates `TenantUsers`/`UserRoles` rows | Rows present in D1 |
| 22 | Tenant admin sign-in via credentials | Redirected to `/dashboard`; `checkAccess()` returns `role: 'tenant'` |

If **ANY** test fails, do not commit. Fix and re-test.

---

## 7. Rollback Strategy

| Stage | Rollback |
|---|---|
| 2 | Tables are additive. Drop them with `wrangler d1 execute logosophe --remote --command "DROP TABLE 'user'; DROP TABLE 'account'; DROP TABLE 'session'; DROP TABLE 'verification'"` if needed. |
| 3 | `gh pr revert` → re-merge. Removes `better-auth` dep. |
| 4 | `gh pr revert` → re-merge. All BA-issued sessions become invalid; users must sign back in via Auth.js. BA tables remain in D1. |
| 5 | `gh pr revert` does NOT recover dropped tables. Restore from pre-Stage 5 D1 backup. **Take backup immediately before applying Stage 5 SQL.** |

---

## 8. Open Items

- [ ] Verify branch protection on `main` requires PR approval + `yarn build` status check (Stage 1)
- [ ] Back up local + remote D1 before Stage 2 SQL (commands in Stage 2 section)
- [ ] Back up local + remote D1 before Stage 5 SQL (commands in Stage 5 section)
- [ ] Add `https://www.logosophe.com/api/auth/callback/microsoft` to Azure app registration before Stage 4
- [ ] Take D1 backup before Stage 5 SQL
- [ ] After Stage 5: Remove old `microsoft-entra-id` callback URL from Azure app registration
- [ ] After Stage 5: Remove `AUTH_REDIRECT_PROXY_URL` from deployment workflow (Auth.js-specific)
- [ ] Confirm `UserAvatars` table FK (`REFERENCES users(id)`) can be left as-is after Stage 5 drops `users` — SQLite does not enforce FKs by default (PRAGMA foreign_keys = OFF), so the orphaned FK declaration will not cause errors
