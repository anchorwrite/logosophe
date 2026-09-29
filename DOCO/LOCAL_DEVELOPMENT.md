# Local Development Setup

Current guide for running Logosophe against Cloudflare Tunnel + local Next.js.

## Prerequisites

- Cloudflare account with API token
- `cloudflared` installed
- Yarn (Corepack) installed
- Node.js **24** (matches CI)

## Setup

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Tunnel (one-time):** create/route if needed, then point ingress at the Next dev port:

   ```yaml
   # ~/.cloudflared/config.yml (or config-logosophe-dev.yml)
   tunnel: [logosophe-tunnel-id]
   credentials-file: /Users/plowden/.cloudflared/[logosophe-tunnel-id].json

   ingress:
     - hostname: local-dev.logosophe.com
       service: http://localhost:3001
     - service: http_status:404
   ```

   Shared multi-project config can also include Anchorwrite (`local-dev.anchorwrite.net` → `http://localhost:3002`).

3. **Environment** — create `apps/worker/.env.local`:

   ```env
   AUTH_URL=https://local-dev.logosophe.com
   APP_BASE_URL=https://local-dev.logosophe.com
   # Optional legacy aliases still read by some scripts/CI:
   NEXTAUTH_URL=https://local-dev.logosophe.com
   AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
   AUTH_SECRET=…
   CLOUDFLARE_API_TOKEN=…
   CLOUDFLARE_ACCOUNT_ID=…
   ```

4. **Start development:**

   ```bash
   # Terminal 1: tunnel
   yarn tunnel
   # or: yarn tunnel:logosophe-dev

   # Terminal 2: Next.js on :3001
   yarn dev
   ```

## URLs

- **Local Development**: https://local-dev.logosophe.com (port 3001)
- **Production**: https://www.logosophe.com

Auth is **Better Auth**. `trustedOrigins` trusts production and tunnel hosts in **both** `http` and `https` (and expands `AUTH_URL` / `APP_BASE_URL` the same way). Local wrangler behind the tunnel can present `Origin: http://www.logosophe.com` on sign-out even when the address bar is `https://local-dev.logosophe.com`; without the http twin, Better Auth returns 403. The auth client uses same-origin `basePath: '/api/auth'` (do not pass an empty `baseURL`).

### OAuth redirect URIs

| Environment | Host |
|---|---|
| Production | `https://www.logosophe.com` |
| Local tunnel | `https://local-dev.logosophe.com` |

Register `/api/auth/callback/{google,apple,linkedin,microsoft}` on each host with the providers.
