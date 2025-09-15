# Build and Deployment Troubleshooting Guide - As Of Jan 2025

## Overview

This document covers common build and deployment issues for the logosophe project, particularly when deploying to Cloudflare Workers using OpenNext. The project features comprehensive RBAC, real-time messaging, enterprise-grade analytics, and multi-tenant architecture.

## Email Worker Deployment and Configuration

### Email Worker Architecture

The project includes a separate email worker (`apps/email-worker`) that handles email processing:

- **Email Worker**: `logosophe-email` - Handles email processing and sending
- **Main Worker**: `logosophe` - Serves the Next.js application with 214 API endpoints
- **Deployment**: Email worker is deployed via GitHub Actions [[memory:7636784]]

### Email Worker Environment Setup

**Production Configuration:**
```bash
# Set production email worker URL as secret
cd apps/worker
echo "https://logosophe-email.logosophe.com" | yarn wrangler secret put EMAIL_WORKER_URL
```

**Development Configuration:**
```bash
# Add to apps/worker/.dev.vars for local development
EMAIL_WORKER_URL=https://logosophe-email.logosophe.com
```

**Email Worker Deployment:**
The email worker is deployed automatically via GitHub Actions when changes are pushed to the repository. The deployment workflow is in `.github/workflows/email-worker-deployment.yaml`.

### Email Worker Database

The email worker uses the main D1 database (`logosophe`) for storing email-related data:

- **Database Name**: `logosophe`
- **Database ID**: `fd7b2b89-eedd-4111-ba68-fdb05cdf2995`
- **Tables**: Uses existing database tables for email processing
- **Local Development**: Database commands must be run from `apps/worker/` directory

### Email Worker Testing

**Local Testing:**
```bash
# Start email worker locally
cd apps/email-worker
yarn dev

# Test email worker directly
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test message"}'
```

**Production Testing:**
```bash
# Test production email worker
curl -X POST https://logosophe-email.logosophe.com \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test message"}'
```

### Contact Form Integration

The contact form (`apps/worker/app/components/ContactForm/index.tsx`) submits to `/api/contact`, which then calls the email worker:

1. **Contact Form** → `/api/contact` (main worker)
2. **Contact API** → `EMAIL_WORKER_URL` (email worker)
3. **Email Worker** → Database storage + Email sending
4. **Response** → Success/error back to contact form

### Email Worker Configuration Files

**wrangler.jsonc (Email Worker):**
```jsonc
{
  "name": "logosophe-email",
  "main": "app/index.ts",
  "compatibility_date": "2024-01-01"
}
```

**Environment Variables:**
- `EMAIL_WORKER_URL`: Set as Cloudflare secret for production, `.dev.vars` for development
- Email configuration handled through the main worker's email system

### Troubleshooting Email Worker Issues

**Common Issues:**

1. **Email Worker Not Responding:**
   - Check if email worker is deployed: `wrangler tail logosophe-email`
   - Verify environment variables are set correctly
   - Check email worker logs for errors

2. **Contact Form Not Working:**
   - Verify `EMAIL_WORKER_URL` is set correctly in main worker
   - Check that main worker can reach email worker URL
   - Test email worker directly to isolate issues

3. **Database Connection Issues:**
   - Verify D1 database is accessible: `yarn wrangler d1 execute logosophe --command "SELECT 1"`
   - Check database binding in email worker configuration
   - Ensure local database is created for development
   - **Note**: All wrangler commands must be run from `apps/worker/` directory

4. **Email Not Sending:**
   - Check Cloudflare Email configuration in dashboard
   - Verify email binding is configured correctly
   - Check email worker logs for send_email binding errors

**Debugging Commands:**
```bash
# Check email worker status
wrangler tail logosophe-email

# Test database connection
yarn wrangler d1 execute logosophe --command "SELECT COUNT(*) FROM SystemLogs"

# Test email worker directly
curl -X POST https://logosophe-email.logosophe.com \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test"}'
```

## Common Issues

### 1. OAuth Authentication Issues

**Symptoms:**
- Google/Apple sign-in fails with "Authorization Error"
- OAuth client not found error (401: invalid_client)
- Request URL shows `client_id=undefined`
- Apple sign-in fails with "invalid_client" error
- Works in development but fails in production
- Cloudflare deployment fails with "Authentication error [code: 10000]"
- R2 operations fail with "401: Unauthorized"
- Missing OAuth scopes warning: `secrets_store:write`, `containers:write`, `cloudchamber:write`

**Root Cause:**
Environment variables for OAuth providers (Google, Apple, Resend) are not properly configured in Cloudflare Workers. The variables need to be set as secrets via `wrangler secret put` rather than as regular environment variables.

For Apple specifically, the JWT client secret must be generated with the correct client ID to avoid `invalid_client` errors.

For deployment authentication errors, the OAuth token is missing required scopes or GitHub Actions is using an outdated API token instead of the OAuth token.

**Solution:**

**Step 1: Remove placeholder values from wrangler.jsonc**
```json
// Before
"vars": {
  "NEXTJS_ENV": "production",
  "AUTH_GOOGLE_ID": "placeholder",
  "AUTH_GOOGLE_SECRET": "placeholder",
  "AUTH_RESEND_KEY": "placeholder",
  "AUTH_APPLE_ID": "placeholder",
  "AUTH_APPLE_SECRET": "placeholder"
}

// After
"vars": {
  "NEXTJS_ENV": "production"
}
```

**Step 2: Set OAuth secrets via wrangler**
```bash
cd apps/worker

# Set Google OAuth credentials
echo "YOUR_GOOGLE_CLIENT_ID" | yarn wrangler secret put AUTH_GOOGLE_ID
echo "YOUR_GOOGLE_CLIENT_SECRET" | yarn wrangler secret put AUTH_GOOGLE_SECRET

# Set other OAuth secrets
echo "YOUR_RESEND_API_KEY" | yarn wrangler secret put AUTH_RESEND_KEY
echo "YOUR_APPLE_CLIENT_ID" | yarn wrangler secret put AUTH_APPLE_ID

# Generate and set Apple JWT secret (see Apple JWT Generation section below)
echo "YOUR_APPLE_JWT_SECRET" | yarn wrangler secret put AUTH_APPLE_SECRET

# Set worker URL secrets
echo "https://logosophe-email.logosophe.com" | yarn wrangler secret put EMAIL_WORKER_URL

# Verify secrets are set
yarn wrangler secret list
```

**Step 3: Update GitHub Secrets (Required for CI/CD)**
After setting secrets locally with `wrangler secret put`, you must also update GitHub Actions secrets:

1. **Get your OAuth token:**
   ```bash
   # Find your OAuth token from wrangler config
   cat ~/.wrangler/config/default.toml
   # Look for the 'api_token' field
   ```

2. **Update GitHub repository secrets:**
   - Go to your repository → **Settings** → **Secrets and variables** → **Actions**
   - Update **`CLOUDFLARE_API_TOKEN`** with your new OAuth token
   - Update **`ckea`** with the same token (if you have this secret)

3. **Why this is needed:**
   - `wrangler login` creates an OAuth token with all required permissions
   - GitHub Actions uses this token for deployment
   - OAuth tokens have different permissions than API tokens
   - Local deployment works with OAuth, but CI/CD needs the token in GitHub secrets

**Step 4: Update auth.ts to handle secrets**
```typescript
// In apps/worker/app/auth.ts, update getEnvVar function:
const getEnvVar = (key: string): string | undefined => {
  if (process.env.NODE_ENV === 'development') {
    return process.env[key];
  }
  // In production, secrets are accessible via env but not typed in the interface
  const value = (env as any)[key];
  return typeof value === 'string' ? value : undefined;
};
```

**Step 5: Update worker configuration types**
```bash
# Regenerate TypeScript interface for environment variables
yarn wrangler types --env-interface CloudflareEnv
```



**Verification:**
- Check that secrets are set: `yarn wrangler secret list`
- Deploy changes: `yarn build && git push origin main`
- Test Google/Apple sign-in in production

**Why This Happened:**
When migrating to OpenNext for Cloudflare Workers, the environment variable handling changed. OAuth credentials need to be set as secrets rather than regular environment variables for security reasons. The TypeScript interface generated by `wrangler types` doesn't include secrets in the type definition, so they need to be accessed using type assertion.

### OAuth Token Refresh Issues

**Symptoms:**
- `wrangler whoami` shows missing scopes warning
- Deployment fails with authentication errors
- R2 operations return 401 Unauthorized
- GitHub Actions deployment fails

**Quick Fix:**
```bash
# Refresh OAuth token with updated permissions
yarn wrangler login

# Verify new permissions
yarn wrangler whoami

# Update GitHub secrets with new token
# 1. Get token from ~/.wrangler/config/default.toml
# 2. Update CLOUDFLARE_API_TOKEN in GitHub repository secrets
```

**Why This Happens:**
Cloudflare periodically updates OAuth scope requirements. When new scopes are required (like `secrets_store:write` for R2 operations), existing tokens become insufficient and need to be refreshed via `wrangler login`.

### Apple JWT Secret Generation

Apple requires a JWT (JSON Web Token) as the client secret instead of a simple string. This JWT must be generated with the correct client ID that matches your Apple Developer configuration.

**Generate Apple JWT Secret:**
```bash
cd apps/worker

# Run the JWT generation script
node scripts/generate-apple-secret.js /path/to/your/AuthKey_MVVB892PSQ.p8
```

**Script Configuration:**
The script `apps/worker/scripts/generate-apple-secret.js` contains:
- Team ID: `42R9DPNTYR`
- Client ID: `com.logosophe.www.authjs` (must match Apple Developer config)
- Key ID: `MVVB892PSQ`
- Private key path: Your `.p8` file from Apple Developer

**Important:** Ensure the client ID in the script matches your Apple Developer App ID configuration. The JWT subject (`sub`) must exactly match the client ID used in your OAuth configuration.

**Update Environment:**
```bash
# Update local development
sed -i '' 's|AUTH_APPLE_SECRET=".*"|AUTH_APPLE_SECRET="NEW_JWT_SECRET"|' .env.local

# Set production secret
echo "NEW_JWT_SECRET" | yarn wrangler secret put AUTH_APPLE_SECRET
```

**Verify JWT Content:**
```bash
# Decode and verify the JWT payload
node -e "const jwt = 'YOUR_JWT_SECRET'; const parts = jwt.split('.'); console.log('Payload:', JSON.parse(Buffer.from(parts[1], 'base64').toString()));"
```

The payload should show:
- `sub`: `com.logosophe.www.authjs` (must match your client ID)
- `iss`: `42R9DPNTYR` (your team ID)
- `aud`: `https://appleid.apple.com`

### OAuth Account Linking Error Handling

When users try to sign in with a different OAuth provider using an email that's already associated with another provider, AuthJS throws an `OAuthAccountNotLinked` error.

**Error Handling Implementation:**
The signin page (`apps/worker/app/signin/page.tsx`) includes specific error handling for this case:

```typescript
case 'OAuthAccountNotLinked':
  return 'This email is already associated with a different sign-in method. Please use the same provider you used when you first created your account.';
```

**Error Display Logic:**
OAuth-related errors are only displayed in the subscriber login section where they're relevant:
```typescript
{error && (error === 'OAuthAccountNotLinked' || error === 'Configuration') && (
  // Error message display
)}
```

This ensures users see helpful error messages in the correct context without cluttering the administrator login section.

### 2. Static Asset 404 Errors (Most Common)

**Symptoms:**
- Browser shows 404 errors for JavaScript chunks like:
  ```
  GET https://logosophe.com/_next/static/chunks/main-app-88f0b36266861039.js net::ERR_ABORTED 404 (Not Found)
  ```
- **Production worker logs show "Ok" for the same requests** (indicating files are being served correctly)
- Page loads but JavaScript functionality is broken

**Root Cause:**
Browser cache mismatch - the browser has cached references to old JavaScript files with specific hash names, but the deployed files have different hash names. The worker is serving the correct files, but the browser is requesting old cached file references.

**Solution:**

**Server-side (if needed):**
```bash
# 1. Clear all build caches
cd apps/worker
rm -rf .next .open-next

# 2. Rebuild the project
yarn build

# 3. Deploy via GitHub Actions
git push origin main
```

**Browser-side (most common fix):**
Since production worker logs show "Ok" for all requests, this is typically a browser cache issue:

1. **Hard Refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Clear Browser Cache**: 
   - Open Developer Tools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"
3. **Incognito Mode**: Test in private/incognito browser window
4. **Clear All Browser Data**: Settings → Clear browsing data → Cached images and files

**If browser cache clearing doesn't work:**
The HTML page itself may be cached with old file references. Check if the HTML contains old file hashes:
```bash
curl -s "https://logosophe.com/" | grep -o 'main-app-[^"]*\.js'
```
If the HTML references old hashes, this indicates a **build manifest cache issue** that requires a fresh deployment.

**For OpenNext deployments:**
If the issue persists after multiple deployments, the OpenNext build cache may be corrupted:
```bash
# In GitHub Actions workflow, add cache clearing before build:
- name: Clear OpenNext cache
  run: |
    cd apps/worker
    rm -rf .open-next
    rm -rf .next
    
- name: Build Application
  run: |
    cd apps/worker
    yarn build
```

**OpenNext Cache Interception Issue:**
If HTML references old file hashes but worker logs show "Ok", this is often caused by cache interception. Add to `open-next.config.ts`:
```typescript
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  enableCacheInterception: false, // Disable to fix static asset issues
});
```

**Static Asset Cache TTL:**
Update `public/_headers` to use shorter cache times:
```
/_next/static/*
  Cache-Control: public,max-age=3600,s-maxage=86400
```

### 2. Build Cache Issues

**Symptoms:**
- Inconsistent behavior between local and production
- Old code appearing in production despite new deployments
- Random 404 errors for static assets

**Prevention:**
Always clear build cache before deploying:
```bash
# Clear Next.js build cache
rm -rf apps/worker/.next

# Clear OpenNext build cache  
rm -rf apps/worker/.open-next

# Clear node_modules (if dependency issues)
rm -rf node_modules
yarn install

# Rebuild and deploy
yarn workspace worker build
git push origin main
```

### 3. Cloudflare Workers Deployment Issues

**Symptoms:**
- Worker fails to start
- Environment variables not available
- Database connections failing

**Troubleshooting:**
```bash
# Check worker configuration
cat apps/worker/wrangler.jsonc

# Test locally with preview
yarn workspace worker preview

# Check worker logs
wrangler tail logosophe
```

### 4. Database Migration Issues

**Symptoms:**
- Database schema errors
- Missing tables or columns
- Migration conflicts

**Solution:**
```bash
# Apply database migrations
cd packages/database
./migrations/apply-migration.sh

# Check migration status
cd apps/worker
yarn wrangler d1 execute logosophe --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check specific table structure
yarn wrangler d1 execute logosophe --command "PRAGMA table_info(SystemLogs);"
```

**Database Configuration:**
- **Database Name**: `logosophe`
- **Database ID**: `fd7b2b89-eedd-4111-ba68-fdb05cdf2995`
- **All wrangler commands must be run from `apps/worker/` directory**

## Deployment Process

### GitHub Actions Deployment (Recommended)

The project uses GitHub Actions for automated deployment [[memory:6435589]]. The build cache clearing happens automatically in the CI/CD pipeline.

**Standard Deployment:**
- Push to main branch triggers automatic deployment
- Build cache is cleared automatically in the GitHub Actions workflow
- No manual intervention required
- Email worker is deployed via GitHub Actions [[memory:7636784]]

**Emergency Deployment (When site is broken):**
1. Clear GitHub Actions cache:
   - Go to your repository on GitHub
   - Navigate to Actions → [Your workflow name]
   - Click "Clear cache" or "Re-run jobs"
   - Or force a new deployment by making a small commit

2. Alternative: Manual cache clearing in workflow:
   ```yaml
   # Add this step before build in your GitHub Actions workflow
   - name: Clear build cache
     run: |
       rm -rf apps/worker/.next
       rm -rf apps/worker/.open-next
   ```

### Local Development Deployment (For testing)
```bash
# 1. Clear build caches
rm -rf apps/worker/.next apps/worker/.open-next

# 2. Build the project
yarn workspace worker build

# 3. Deploy to Cloudflare
git push origin main

# 4. Verify deployment
curl -I https://logosophe.com
```

## Environment-Specific Issues

### Development Environment
- Use `yarn dev` to start the worker and force a build
- Check `.dev.vars` for local environment variables
- Use `yarn workspace worker preview` to test OpenNext build locally

### Production Environment
- Always clear build cache before deployment
- Verify environment variables in Cloudflare dashboard
- Check worker logs for errors: `yarn wrangler tail logosophe`
- **Note**: All wrangler commands must be run from `apps/worker/` directory

## Debugging Tools

### Browser Developer Tools
1. Open Network tab
2. Look for 404 errors on `_next/static/chunks/*.js` files
3. **Compare with worker logs**: If worker logs show "Ok" but browser shows 404, it's a browser cache issue
4. Check if file hashes match between browser requests and actual files

### Worker Logs
```bash
# Real-time worker logs
yarn wrangler tail logosophe

# Check specific requests
yarn wrangler tail logosophe --format pretty
```

### Build Verification
```bash
# Check what files were built
ls -la apps/worker/.open-next/assets/_next/static/chunks/

# Verify build manifest
cat apps/worker/.open-next/assets/_next/static/*/_buildManifest.js
```

## Prevention Best Practices

1. **GitHub Actions handles cache clearing** - The CI/CD pipeline automatically clears build cache
2. **Test locally first** - Use `yarn workspace worker preview` to test the OpenNext build before pushing
3. **Monitor worker logs** - Check for errors immediately after deployment: `wrangler tail logosophe`
4. **Use consistent build environment** - GitHub Actions provides a clean, consistent build environment
5. **Keep dependencies updated** - Regular `yarn upgrade` to prevent version conflicts
6. **Clear GitHub Actions cache if needed** - If you encounter persistent build issues, clear the GitHub Actions cache

## Quick Reference Commands

### GitHub Actions (Production)
```bash
# Trigger deployment
git push origin main

# Check deployment status
curl -I https://logosophe.com

# View worker logs
yarn wrangler tail logosophe
```

### Local Development
```bash
# Full deployment cycle (for testing)
rm -rf apps/worker/.next apps/worker/.open-next
yarn workspace worker build
git push origin main

# Test locally
yarn workspace worker preview
```

## When to Contact Support

Contact the development team if:
- Cache clearing doesn't resolve 404 errors
- Worker fails to start after deployment
- Database connection issues persist
- Environment variables are not loading correctly
- Build process fails consistently

## Notes

- The project uses OpenNext 1.6.2 for Cloudflare Workers deployment
- Build artifacts are in `.open-next/` directory
- Static assets are served from Cloudflare's edge network
- Database uses D1 with migrations in `packages/database/migrations/`
- Uses React 18.3.1 for compatibility with Radix UI/Themes 2.0.3
- Uses AuthJS v5 (NextAuth 5.0.0-beta.29) for authentication
- Uses Yarn 4.5.3 with workspaces for package management
- Features comprehensive RBAC, real-time messaging, and enterprise-grade analytics
- Multi-tenant architecture with 40+ database tables
- Internationalization support for 5 languages (EN, DE, ES, FR, NL) 