#!/bin/bash

# Deploy with skew protection enabled
# This script sets up the required environment variables for skew protection

# Set required environment variables for skew protection
export CF_WORKER_NAME="logosophe"
export CF_PREVIEW_DOMAIN="anchorwrite.workers.dev"
export CF_ACCOUNT_ID="911edf2379732c1038a6a894cae9bee5"

# Set production environment variables
export NEXTAUTH_URL="https://www.logosophe.com"
export AUTH_URL="https://www.logosophe.com"
export AUTH_REDIRECT_PROXY_URL="https://www.logosophe.com"

# Check if API token is provided
if [ -z "$CF_WORKERS_SCRIPTS_API_TOKEN" ]; then
    echo "Error: CF_WORKERS_SCRIPTS_API_TOKEN environment variable is required"
    echo "Please set it with: export CF_WORKERS_SCRIPTS_API_TOKEN=your_api_token"
    echo "You can get this token from Cloudflare dashboard with 'Workers Scripts:Read' permission"
    exit 1
fi

echo "Deploying with skew protection enabled..."
echo "Worker name: $CF_WORKER_NAME"
echo "Preview domain: $CF_PREVIEW_DOMAIN"
echo "Account ID: $CF_ACCOUNT_ID"
echo "Production URL: $NEXTAUTH_URL"

# Build and deploy
yarn build
yarn deploy

echo "Deployment complete with skew protection enabled!" 