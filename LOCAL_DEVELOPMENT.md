# Local Development Setup

## Prerequisites
- Cloudflare account with API token
- Cloudflare tunnel installed (`cloudflared`)
- Yarn installed

## Setup Steps

1. **Install dependencies:**
   ```bash
   yarn install
   ```

2. **Create tunnel (one-time setup):**
   ```bash
   cloudflared tunnel create logosophe-local-dev
   cloudflared tunnel route dns logosophe-local-dev local-dev.logosophe.com
   ```

3. **Update tunnel config:**
   Add to ~/.cloudflared/config.yml:
   ```yaml
   tunnel: [logosophe-tunnel-id]
   credentials-file: /Users/plowden/.cloudflared/[logosophe-tunnel-id].json
   
   ingress:
     - hostname: local-dev.logosophe.com
       path: /worker/*
       service: https://localhost:8787
       originRequest:
         noTLSVerify: true
     - hostname: local-dev.logosophe.com
       service: https://localhost:8788
       originRequest:
         noTLSVerify: true
     - service: http_status:404
   ```

4. **Start development:**
   ```bash
   # Terminal 1: Start tunnel
   cloudflared tunnel run local-dev
   
   # Terminal 2: Start development server
   yarn dev
   ```

## Environment Variables

Create `.env.local` in the worker directory:
```env
NEXTAUTH_URL=https://local-dev.logosophe.com
AUTH_URL=https://local-dev.logosophe.com
AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## URLs
- **Local Development**: https://local-dev.logosophe.com
- **Production**: https://logosophe.com 