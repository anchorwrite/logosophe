#!/bin/bash

echo "Setting up Logosophe local development environment..."

# Install dependencies
echo "Installing dependencies..."
yarn install

# Create tunnel if it doesn't exist
echo "Setting up Cloudflare tunnel..."
if ! cloudflared tunnel list | grep -q "logosophe-local-dev"; then
    echo "Creating tunnel..."
    cloudflared tunnel create logosophe-local-dev
    cloudflared tunnel route dns logosophe-local-dev local-dev.logosophe.com
else
    echo "Tunnel already exists"
fi

# Create .env.local if it doesn't exist
if [ ! -f "apps/worker/.env.local" ]; then
    echo "Creating .env.local file..."
    cat > apps/worker/.env.local << EOF
NEXTAUTH_URL=https://local-dev.logosophe.com
AUTH_URL=https://local-dev.logosophe.com
AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
EOF
    echo "Please update apps/worker/.env.local with your actual Cloudflare credentials"
fi

echo "Setup complete! Run 'yarn dev' to start development." 