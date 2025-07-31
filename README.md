# Logosophe

A modern content publishing platform built with OpenNext, Cloudflare Workers, and AuthJS v5.

## 🚀 Features

- **Multi-language Content Publishing**: Support for multiple languages with i18n
- **Authentication**: OAuth providers (Google, Apple) and credentials-based auth
- **Real-time Features**: Durable Objects for workflows, notifications, and comments
- **Media Management**: R2 storage for media files
- **Admin Dashboard**: Complete admin interface for user and content management
- **Workflow System**: Content approval and publishing workflows

## 🏗️ Architecture

The project is organized into three main functional areas:

- **Content**: Public-facing content with internationalization
- **Harbor**: Authenticated content creation and management
- **Dashboard**: Admin interface for system management

### Technology Stack

- **Frontend**: Next.js 15.3.5, React 19.1.0, Radix UI 2.0.3
- **Backend**: Cloudflare Workers, D1 Database, R2 Storage
- **Authentication**: AuthJS v5 with D1 adapter
- **Real-time**: Durable Objects
- **Deployment**: OpenNext for Cloudflare Workers

## 📁 Project Structure

```
logosophe/
├── apps/
│   ├── worker/              # Main application
│   └── email-worker/        # Email processing
├── packages/
│   ├── common/              # Shared utilities and components
│   ├── database/            # Database schemas and migrations
│   └── config/              # Shared configuration
├── scripts/                 # Development and deployment scripts
└── .github/workflows/       # CI/CD pipelines
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Yarn 4.5.3+
- Cloudflare account with API token
- Cloudflare tunnel (`cloudflared`)

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd logosophe
   yarn install
   ```

2. **Setup local development:**
   ```bash
   ./scripts/setup-local-dev.sh
   ```

3. **Start development:**
   ```bash
   # Terminal 1: Start tunnel
   ./scripts/tunnel.sh start
   
   # Terminal 2: Start development server
   yarn dev
   ```

### Environment Variables

Create `.env.local` in `apps/worker/`:

```env
NEXTAUTH_URL=https://local-dev.logosophe.com
AUTH_URL=https://local-dev.logosophe.com
AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_APPLE_ID=your_apple_client_id
AUTH_APPLE_SECRET=your_apple_client_secret
AUTH_RESEND_API_KEY=your_resend_api_key
```

## 🚀 Deployment

### Manual Deployment

```bash
# Deploy main worker
yarn deploy

# Deploy email worker
yarn deploy:email

# Preview locally (Workers runtime)
yarn preview

# Upload new version
yarn upload

# Or use scripts
./scripts/deploy.sh worker
./scripts/deploy.sh email
./scripts/deploy.sh all
```

### Automated Deployment

The project includes GitHub Actions workflows for automatic deployment:

- `.github/workflows/worker-deployment.yaml` - Main worker deployment
- `.github/workflows/email-worker-deployment.yaml` - Email worker deployment

## 📚 Documentation

- [Local Development Guide](LOCAL_DEVELOPMENT.md)
- [Project Structure](Structure.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 