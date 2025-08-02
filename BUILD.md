# Build and Deployment Troubleshooting Guide

## Overview

This document covers common build and deployment issues for the logosophe project, particularly when deploying to Cloudflare Workers using OpenNext.

## Common Issues

### 1. Static Asset 404 Errors (Most Common)

**Symptoms:**
- Browser shows 404 errors for JavaScript chunks like:
  ```
  GET https://www.logosophe.com/_next/static/chunks/main-app-88f0b36266861039.js net::ERR_ABORTED 404 (Not Found)
  ```
- Worker logs show "Ok" for the same requests
- Page loads but JavaScript functionality is broken

**Root Cause:**
Build cache mismatch between what the browser expects and what's actually deployed. The browser requests files with specific hash names, but the deployed files have different hash names.

**Solution:**
```bash
# 1. Clear all build caches
cd apps/worker
rm -rf .next .open-next

# 2. Rebuild the project
yarn build

# 3. Deploy via GitHub Actions
git push origin main
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
# (Check your database directly for migration table)
```

## Deployment Process

### GitHub Actions Deployment (Current Setup)

The project uses GitHub Actions for automated deployment. The build cache clearing happens automatically in the CI/CD pipeline.

**Standard Deployment:**
- Push to main branch triggers automatic deployment
- Build cache is cleared automatically in the GitHub Actions workflow
- No manual intervention required

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
curl -I https://www.logosophe.com
```

## Environment-Specific Issues

### Development Environment
- Use `yarn dev` to start the worker and force a build
- Check `.dev.vars` for local environment variables
- Use `yarn workspace worker preview` to test OpenNext build locally

### Production Environment
- Always clear build cache before deployment
- Verify environment variables in Cloudflare dashboard
- Check worker logs for errors: `wrangler tail logosophe`

## Debugging Tools

### Browser Developer Tools
1. Open Network tab
2. Look for 404 errors on `_next/static/chunks/*.js` files
3. Check if file hashes match between browser requests and actual files

### Worker Logs
```bash
# Real-time worker logs
wrangler tail logosophe

# Check specific requests
wrangler tail logosophe --format pretty
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
curl -I https://www.logosophe.com

# View worker logs
wrangler tail logosophe
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

- The project uses OpenNext for Cloudflare Workers deployment
- Build artifacts are in `.open-next/` directory
- Static assets are served from Cloudflare's edge network
- Database uses D1 with migrations in `packages/database/migrations/` 