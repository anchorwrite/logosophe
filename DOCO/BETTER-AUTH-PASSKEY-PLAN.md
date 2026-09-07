# Better Auth Passkey Implementation Plan (Logosophe)

Add **WebAuthn / passkey** support on top of the existing **Better Auth v1** stack, without replacing OAuth, magic link, or admin email/password.

**Created:** 2026-09-04  
**Status:** Planning (docs only; implementation not started)  
**Tracking issue:** [anchorwrite/logosophe#11](https://github.com/anchorwrite/logosophe/issues/11)  
**PR:** [anchorwrite/logosophe#12](https://github.com/anchorwrite/logosophe/pull/12)  
**Approver:** baudouinalbert  
**Reference:** [Better Auth Passkey plugin](https://www.better-auth.com/docs/plugins/passkey) (SimpleWebAuthn under the hood)

---

## Progress Tracker

| Stage | Status | PR | Notes |
|---|---|---|---|
| 0 — Planning doc | In review | [#12](https://github.com/anchorwrite/logosophe/pull/12) | This file; closes [#11](https://github.com/anchorwrite/logosophe/issues/11) |
| 1 — D1 `passkey` table migration | Pending | — | Local + remote D1 |
| 2 — Install plugin + server/client wiring | Pending | — | `@better-auth/passkey` |
| 3 — Manage passkeys (signed-in users) | Pending | — | Add / list / rename / delete UI |
| 4 — Sign in with passkey | Pending | — | Sign-in page client ceremony |
| 5 — Provider logging + Preferences | Pending | — | Avoid mislabeling as magic-link |
| 6 — Optional Conditional UI | Pending | — | Autofill / discoverable credentials |
| 7 — Hardening & docs | Pending | — | rpID matrix, i18n, test plan |

**Recommended MVP:** Stages 1–5. Defer passkey-first registration (no prior session) and Conditional UI unless product requires them.

---

## 1. Current Auth Snapshot

### Stack

| Piece | Location / version |
|---|---|
| Library | `better-auth` `^1.6.2` (resolved `1.6.2`) |
| Server config | `apps/worker/app/auth.ts` → `createAuth()` |
| Client | `apps/worker/app/lib/auth-client.ts` |
| Handler | `apps/worker/app/api/auth/[...all]/route.ts` (GET/POST → `auth.handler`) |
| Plugins today | `magicLink`, `admin` |
| DB | Cloudflare D1 via Better Auth native dialect (`database: env.DB`) |

### Sign-in methods today

| Method | Audience | UI |
|---|---|---|
| Google / Apple / LinkedIn / Microsoft OAuth | Users / subscribers | GET links via `/api/auth-social-init` on `[lang]/signin` |
| Magic link (Resend) | Users / subscribers | Server action → `auth.api.signInMagicLink` |
| Email + password | Admin / tenant (`Credentials`) | POST `/api/auth-credentials` |
| Test users | Dev / admin tooling | Separate test sign-in path |

### Post-sign-in behavior (`session.create.after` in `auth.ts`)

On session create the hook:

1. Computes and persists `user.role` (`admin` \| `tenant` \| `subscriber` \| `user`)
2. Skips Preferences / TenantUsers for Credentials (admin/tenant) users
3. Infers **provider** from a **recently updated `account` row** (within 15s); otherwise defaults to `"magic-link"`
4. Upserts `Preferences.CurrentProvider`
5. Auto-provisions `TenantUsers` / `UserRoles` for tenant `default`
6. Logs via `NormalizedLogging.logAuthentication`

**Implication for passkeys:** Passkey sign-in generally does **not** update an OAuth/`credential` `account` row the same way. Without a hook update, passkey logins may be mislabeled as `magic-link`.

### Hosts / trusted origins (relevant to WebAuthn)

Configured in `createAuth()`:

- `https://www.logosophe.com`
- `https://local-dev.logosophe.com`
- `http://localhost:3001`
- `http://localhost:3000`

Passkeys are **origin- and rpID-bound**. Multi-host support is the main configuration risk.

---

## 2. What Better Auth Provides

Passkeys are a **plugin**, not built into core. In current Better Auth versions the package is separate:

```bash
yarn workspace worker add @better-auth/passkey
```

### Server

```ts
import { passkey } from '@better-auth/passkey'

plugins: [
  // existing magicLink, admin …
  passkey({
    rpID: 'logosophe.com',      // or host-derived; see §4
    rpName: 'Logosophe',
    origin: 'https://www.logosophe.com',
  }),
]
```

### Client

```ts
import { passkeyClient } from '@better-auth/passkey/client'

plugins: [
  adminClient(),
  magicLinkClient(),
  passkeyClient(),
]
```

### Default UX model

| Action | API (client) | Session required? |
|---|---|---|
| Register / add | `authClient.passkey.addPasskey({ name? })` | **Yes** (default) |
| Sign in | `authClient.signIn.passkey({ autoFill? })` | No |
| List | `authClient.passkey.listUserPasskeys()` | Yes |
| Rename | `authClient.passkey.updatePasskey({ id, name })` | Yes |
| Delete | `authClient.passkey.deletePasskey({ id })` | Yes |

Endpoints mount under the existing Better Auth base path (via `/api/auth/[...all]`). **No new catch-all route file is required.**

### Optional: passkey-first registration

`registration.requireSession: false` + `resolveUser` allows registering a passkey before a normal session exists. **Out of scope for MVP** unless product explicitly wants signup without email/OAuth first.

### Optional: Conditional UI

Browser autofill of passkeys via `autocomplete="… webauthn"` and `signIn.passkey({ autoFill: true })` when Conditional Mediation is available. Nice-to-have after a working button-based flow.

---

## 3. Database Schema

Plugin table name: **`passkey`**.

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | Passkey row id |
| `name` | string (optional) | User label |
| `publicKey` | string | Stored public key |
| `userId` | string (FK → `user.id`) | Owner |
| `credentialID` | string | WebAuthn credential id |
| `counter` | number | Clone / replay detection |
| `deviceType` | string | Platform vs etc. |
| `backedUp` | boolean | Synced / backed up flag |
| `transports` | string (optional) | e.g. `internal,hybrid` |
| `createdAt` | datetime (optional) | |
| `aaguid` | string (optional) | Authenticator model GUID |

### Repo convention

Logosophe uses **hand-written SQL** under `packages/database/migrations/` (see Better Auth migration `014-…`). Prefer a new numbered migration (e.g. `016-better-auth-passkey.sql`) applied to **local and remote** D1 rather than relying solely on `npx auth migrate` / `auth generate`, unless the team adopts the CLI as the source of truth.

Suggested shape (confirm column types against the installed `@better-auth/passkey` version before applying):

```sql
CREATE TABLE IF NOT EXISTS "passkey" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT,
    "createdAt" TEXT,
    "aaguid" TEXT,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ba_passkey_userId ON "passkey"("userId");
CREATE INDEX IF NOT EXISTS idx_ba_passkey_credentialID ON "passkey"("credentialID");
```

---

## 4. Relying Party Configuration (Critical)

WebAuthn credentials are scoped to an **rpID** and verified against **origin**.

| Environment | Example origin | Suggested `rpID` |
|---|---|---|
| Production | `https://www.logosophe.com` | `logosophe.com` **or** `www.logosophe.com` (pick one and stick to it) |
| Tunnel / local-dev | `https://local-dev.logosophe.com` | `local-dev.logosophe.com` (or parent if DNS allows) |
| Localhost | `http://localhost:3001` | `localhost` |

### Rules of thumb

- Do **not** include scheme or path in `rpID`.
- Do **not** include a trailing slash on `origin`.
- Credentials created under `localhost` **do not** work on `www.logosophe.com`, and vice versa.
- Prefer deriving `rpID` / `origin` from the request host or `AUTH_URL` inside `createAuth()` so the same build works across hosts.
- If production uses `rpID: "logosophe.com"`, users signing in on `www.logosophe.com` can still use those credentials (parent domain rpID). Confirm browser behavior and Apple/Google passkey sync expectations during Stage 2 smoke tests.

---

## 5. Application Integration Points

### 5.1 Server (`apps/worker/app/auth.ts`)

- Add `passkey(…)` to `plugins`.
- Keep `emailAndPassword`, social providers, `magicLink`, and `admin` unchanged for MVP.
- Update `session.create.after` provider detection so passkey sign-ins set `provider` to something like `passkey` (do not fall through to `"magic-link"`). Options:
  - Inspect BA APIs / request path if available in hook context, or
  - Check for a recently used passkey / dedicated signal, or
  - Prefer explicit provider tagging if Better Auth exposes it in session metadata for this plugin version.

### 5.2 Client (`apps/worker/app/lib/auth-client.ts`)

- Add `passkeyClient()`.

### 5.3 Sign-in UI (`apps/worker/app/[lang]/signin/page.tsx`)

Today the page is largely **server-rendered** (OAuth `<a href>`, magic-link server action, credentials form). Passkeys require a **client component** for the WebAuthn ceremony:

- “Sign in with passkey” button → `authClient.signIn.passkey` → redirect to `/dashboard` or `/{lang}/harbor` based on role (mirror existing post-auth redirects).
- Optional later: Conditional UI on email fields.

### 5.4 Manage passkeys UI

Natural homes:

| Audience | Suggested surface |
|---|---|
| Admin / tenant | Near password change in `ProfileForm` / dashboard profile |
| Harbor users | Account / security section in harbor settings (may need a small new section if none exists) |

Features for MVP:

- Add passkey (prompt for optional name)
- List passkeys (use `name` or `getAuthenticatorName(aaguid)` fallback from `@better-auth/passkey`)
- Rename / delete
- Policy: do not allow deleting the **last** authentication method if that would lock the user out (product decision; at minimum warn)

### 5.5 Provider display / Preferences

Update friendly maps in:

- `apps/worker/app/api/user/provider-by-email/route.ts`
- Any parallel provider route (`api/user/provider`, Preferences consumers)

Add e.g. `'passkey': 'Passkey'`.

### 5.6 i18n

Add dictionary keys for sign-in and management copy under existing locale files used by `getDictionary`.

### 5.7 Logging / analytics

Ensure `NormalizedLogging.logAuthentication` receives `provider: 'passkey'` so dashboards and user-management “current provider” stay accurate.

---

## 6. Product Decisions (Resolve Before Coding)

1. **Who can register passkeys?** All authenticated users, only subscribers, only admins/tenants, or everyone after first non-passkey login?
2. **Is passkey additive only?** (Recommended: yes — keep OAuth / magic link / password as recovery.)
3. **Production `rpID`:** `logosophe.com` vs `www.logosophe.com`?
4. **Admin path:** Allow passkey for Credentials users as alternative to password?
5. **Passkey-first signup:** Explicitly out of MVP unless required.
6. **Lockout policy:** Minimum number of remaining methods before delete is allowed.

---

## 7. Implementation Plan (Staged)

### Stage 0 — Planning (this PR)

- Land this document under `DOCO/`.
- No runtime behavior change.

### Stage 1 — Schema

- Add D1 migration for `passkey` (+ indexes).
- Apply to local D1; document remote apply command for production.
- Acceptance: table exists; app still boots; existing auth unchanged.

### Stage 2 — Plugin wiring

- `yarn workspace worker add @better-auth/passkey`
- Wire server + client plugins with host-aware `rpID` / `origin` / `rpName: 'Logosophe'`
- Smoke-test challenge cookie on Worker / OpenNext (`local-dev` + production host)
- Acceptance: BA passkey endpoints respond; registration fails gracefully with clear error if table/rpID wrong

### Stage 3 — Manage UI

- Signed-in add / list / rename / delete
- i18n strings
- Acceptance: user can register a platform passkey and see it listed after refresh

### Stage 4 — Sign-in UI

- Client “Sign in with passkey” on `[lang]/signin`
- Correct post-login redirect (admin → `/dashboard`, others → harbor)
- Acceptance: full loop works on Chrome and Safari for a registered passkey

### Stage 5 — Provider correctness

- Fix `session.create.after` provider inference
- Update provider-by-email / Preferences display maps
- Acceptance: Preferences and auth logs show `passkey` after passkey sign-in

### Stage 6 — Optional Conditional UI

- `autocomplete` attributes + `autoFill: true` preload where supported
- Acceptance: supported browsers offer passkey autofill without regressing magic-link / password fields

### Stage 7 — Hardening

- Document rpID matrix in `DOCO/LOCAL_DEVELOPMENT.md` or this file
- Emulated authenticators via Chrome DevTools WebAuthn
- Security review: delete last method, cross-device sync expectations, phishing resistance messaging

---

## 8. Test Plan

| Case | Hosts | Notes |
|---|---|---|
| Register platform passkey | `www` + `local-dev` | Face ID / Touch ID / Windows Hello |
| Register cross-platform (security key) | at least one host | Optional but valuable |
| Sign in with passkey | same host as registration | |
| Sign in after password / OAuth / magic link then add passkey | | Default BA flow |
| Provider logged as `passkey` | | Preferences + NormalizedLogging |
| Role still correct | admin vs subscriber | `computeUserRole` unchanged |
| Cookie / Worker | Cloudflare preview or prod | Challenge cookie round-trip |
| Negative: wrong origin | e.g. localhost key on www | Must fail closed |

Chrome DevTools → Sensors / WebAuthn virtual authenticators can cover CI-less local testing without a physical key.

---

## 9. Out of Scope (Unless Explicitly Requested)

- Replacing OAuth or magic link with passkeys-only
- Passkey-first account creation without email/OAuth
- Mobile native (Expo) passkey cookie prefix work — not applicable to current Next/Workers web app
- Removing Next Auth remnants (separate cleanup if any remain)
- Changing RBAC tables (`Credentials`, `Subscribers`, `TenantUsers`, …)

---

## 10. Effort Estimate

| Scope | Relative effort |
|---|---|
| Stages 1–2 (schema + wiring) | Small |
| Stages 3–4 (UI) | Medium — most of the product work |
| Stage 5 (provider hook) | Small but easy to miss |
| Stage 6–7 | Small–medium |

Overall: **moderate**. Library support is first-class; Logosophe-specific cost is **multi-host rpID**, **client sign-in UI**, **management UI**, and **provider logging**.

---

## 11. PR / Review Workflow

Follow `DOCO/PR_WORKFLOW_CHEATSHEET.md`:

1. Create GitHub issue describing the stage.
2. Branch from `main` (`feat/passkey-…` or `docs/passkey-plan` for Stage 0).
3. Open PR with `Closes #<issue>` so merge auto-closes the issue.
4. Request review from **baudouinalbert**.
5. After approval and merge, delete the head branch (repo auto-delete if enabled, otherwise `gh pr merge --delete-branch` / delete on GitHub).

Do **not** implement runtime stages in the same PR as this planning doc unless the issue scope explicitly includes them.
