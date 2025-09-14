# Logosophe

A comprehensive content publishing and collaboration platform built with OpenNext, Cloudflare Workers, and AuthJS v5, featuring advanced RBAC, real-time messaging, subscriber pages, and enterprise-grade analytics.

## 🚀 Features

- **Multi-language Content Publishing**: Full i18n support with 5 languages (EN, DE, ES, FR, NL)
- **Advanced Authentication**: OAuth providers (Google, Apple, LinkedIn, Microsoft), credentials-based auth, and comprehensive RBAC
- **Real-time Features**: Server-Sent Events (SSE) for workflows, messaging, and notifications
- **Media Management**: R2 storage with tenant-aware access control and share links
- **Content Publishing Platform**: Token-based public publishing with content protection and analytics
- **Subscriber Pages**: Public author profiles with blog posts, announcements, and content showcase
- **Admin Dashboard**: Complete admin interface for user, tenant, and system management
- **Workflow System**: Content approval and publishing workflows with real-time collaboration
- **Messaging System**: Real-time messaging with file attachments and rate limiting
- **Analytics Platform**: Enterprise-grade logging and analytics with dual dashboard system
- **Tenant Management**: Multi-tenant architecture with role-based permissions

## 🏗️ Architecture

The project is organized into four main functional areas:

- **Content**: Public-facing content with internationalization and token-based access
- **Harbor**: Authenticated content creation, management, and subscriber pages
- **Dashboard**: Admin interface for system management and analytics
- **Subscriber Pages**: Public author profiles with content showcase and engagement features

### Technology Stack

- **Frontend**: Next.js 15.3.5, React 18.3.1, Radix UI 2.0.3
- **Backend**: Cloudflare Workers, D1 Database, R2 Storage
- **Authentication**: AuthJS v5 (NextAuth 5.0.0-beta.29) with D1 adapter
- **Real-time**: Server-Sent Events (SSE) for workflows and messaging
- **Deployment**: OpenNext 1.6.2 for Cloudflare Workers
- **Package Manager**: Yarn 4.5.3 with workspaces
- **UI Framework**: Radix UI/Themes (no Tailwind CSS)
- **Internationalization**: i18next with 5 language support
- **Analytics**: Custom NormalizedLogging system with dual dashboards
- **Email**: Resend API with internationalized templates

## 📁 Project Structure

```
logosophe/
├── apps/
│   ├── worker/              # Main Next.js application
│   │   ├── app/             # Next.js app directory
│   │   │   ├── [lang]/      # Internationalized routes
│   │   │   │   ├── harbor/  # Subscriber interface and pages
│   │   │   │   └── pages/   # Public subscriber pages
│   │   │   ├── content/     # Public content discovery
│   │   │   ├── dashboard/   # Admin interface
│   │   │   ├── api/         # API routes (300+ endpoints)
│   │   │   ├── components/  # React components
│   │   │   ├── lib/         # Utilities and configurations
│   │   │   └── locales/     # Translation files (5 languages)
│   │   ├── migrations/      # Database migrations
│   │   └── scripts/         # Development scripts
│   └── email-worker/        # Cloudflare Worker for contact forms
├── packages/
│   ├── common/              # Shared utilities, components, and types
│   ├── database/            # Database schemas and migrations
│   └── config/              # Shared configuration
├── scripts/                 # Development and deployment scripts
└── .github/workflows/       # CI/CD pipelines (GitHub Actions)
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
   yarn tunnel:logosophe-dev
   
   # Terminal 2: Start development server
   yarn dev
   ```

4. **Access the application:**
   - Local Development: https://local-dev.logosophe.com
   - Production: https://logosophe.com

### Environment Variables

Create `.env.local` in `apps/worker/`:

```env
NEXTAUTH_URL=https://local-dev.logosophe.com
AUTH_URL=https://local-dev.logosophe.com
AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_APPLE_ID=your_apple_client_id
AUTH_APPLE_SECRET=your_apple_client_secret
AUTH_RESEND_API_KEY=your_resend_api_key
```

### Database Configuration

- **Database Name**: `logosophe`
- **Database ID**: `fd7b2b89-eedd-4111-ba68-fdb05cdf2995`
- **Local Database**: `.wrangler/state/v3/d1`
- **Remote Database**: Cloudflare D1 instance

#### Database Commands

```bash
# List databases
yarn wrangler d1 list

# Execute on local database
yarn wrangler d1 execute logosophe --command "SQL"

# Execute on remote database
yarn wrangler d1 execute logosophe --remote --command "SQL"

# Check table structure
yarn wrangler d1 execute logosophe --command "PRAGMA table_info(table_name);"
```

**Note**: All wrangler commands must be run from the `apps/worker/` directory.

## 🚀 Deployment

### Automated Deployment (Recommended)

The project uses GitHub Actions for automatic deployment:

- **Main Worker**: Deployed via GitHub Actions on push to main branch
- **Email Worker**: Deployed via GitHub Actions on push to main branch
- **Database Migrations**: Applied automatically during deployment

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

**Note**: The project prefers GitHub Actions for deployment. Manual deployment is available for development and testing purposes.

## 🔐 Authentication & Authorization

### Authentication System

- **Framework**: AuthJS v5 (NextAuth 5.0.0-beta.29) with D1 adapter
- **Providers**: Google OAuth, Apple OAuth, LinkedIn OAuth, Microsoft Entra ID, Credentials (admin/tenant), Resend (email)
- **Session Strategy**: Database-based sessions for tenant-aware RBAC
- **Configuration**: `apps/worker/app/auth.ts`
- **Email Verification**: Required for subscriber access with internationalized templates

### User Types & Roles

#### 1. Credentials Users (Admin/Tenant)
- **Admin Role**: Full system access across all tenants
- **Tenant Role**: Full access within assigned tenants only
- **Storage**: Credentials table with email, password, role

#### 2. OAuth Users (Subscribers)
- **Subscriber Role**: Enhanced access after opt-in
- **Storage**: Subscribers table + UserRoles table for additional roles
- **Tenant Assignment**: Can be assigned to multiple tenants with different roles

#### 3. Regular Users
- **Default Role**: Limited access in default tenant
- **Storage**: TenantUsers table with 'user' role

### Role-Based Access Control (RBAC)

#### Access Control Patterns
- **System Admin**: Global admin privileges across all resources
- **Tenant Admin**: Full control within assigned tenants
- **Role-Based**: Dynamic validation against Roles table
- **Permission Types**: view, download, edit, delete, upload, share, link, send

#### Key Tables
- **TenantUsers**: Base tenant membership and roles
- **UserRoles**: Additional role assignments for subscribers
- **Roles**: Role definitions with permissions
- **MediaAccess**: Resource-specific access control

## 📊 Logging & Analytics

### NormalizedLogging System

The project uses a comprehensive logging system for all user actions:

#### Logging Methods
- `logMediaOperations()` - File upload, download, view, delete, share
- `logWorkflowOperations()` - Workflow creation, updates, collaboration
- `logMessagingOperations()` - Message sending, reading, archiving
- `logUserManagement()` - Role assignments, profile updates
- `logAuthentication()` - Sign in, sign out, password changes
- `logSystemOperations()` - Settings, configuration, errors
- `logSubscriberPages()` - Handle creation, blog posts, comments, ratings

#### Analytics Features
- **Real-time Analytics**: Live dashboard with user activity
- **Trend Analysis**: Historical data and usage patterns
- **Multi-language Support**: Analytics in user's preferred language
- **Dual Dashboards**: Separate views for different user types
- **Rich Metadata**: Structured context for advanced analytics
- **Content Analytics**: Publishing performance and engagement metrics

#### Usage Pattern
```typescript
import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging';

const normalizedLogging = new NormalizedLogging(db);
const { ipAddress, userAgent } = extractRequestContext(request);

await normalizedLogging.logMediaOperations({
  userEmail: user.email,
  tenantId: tenantId,
  activityType: 'upload_file',
  accessType: 'write',
  targetId: mediaId.toString(),
  targetName: fileName,
  ipAddress,
  userAgent,
  metadata: { fileSize, contentType, language: 'en' }
});
```

## 🌐 Internationalization

- **Languages Supported**: English (EN), German (DE), Spanish (ES), French (FR), Dutch (NL)
- **Framework**: i18next with browser language detection
- **Translation Files**: Located in `apps/worker/app/locales/`
- **URL Structure**: `/[lang]/content` for external pages
- **Form Preference**: Uses familiar form (du/tú/tu/jij) instead of formal form

## 🔧 Key Features

### Content Publishing Platform
- **Token-based Access**: Secure public content publishing with unique access tokens
- **Content Protection**: Watermarking, copy protection, and download controls
- **Public Discovery**: Content listing and search with filtering by form, genre, and language
- **Analytics Integration**: Comprehensive tracking of views, downloads, and engagement
- **Multi-language Support**: Content metadata and interface in 5 languages

### Subscriber Pages
- **Public Author Profiles**: Customizable public pages with handles (e.g., `/pages/john-poetry`)
- **Content Showcase**: Display published works, blog posts, and announcements
- **Blog System**: Full blog management with comments, ratings, and moderation
- **Handle Management**: Multiple public pages per subscriber with configurable limits
- **Contact Integration**: Direct messaging through existing messaging system

### Real-time Messaging
- **SSE Streaming**: Real-time message delivery with Server-Sent Events
- **File Attachments**: Media file sharing with access control
- **Rate Limiting**: Configurable message limits (default: 1 per minute)
- **User Blocking**: Tenant-scoped blocking system
- **Message States**: Read, deleted, forwarded, saved, replied

### Workflow System
- **SSE Streaming**: Real-time collaboration and notifications
- **Three-tier API**: Core, Harbor-specific, and Dashboard-specific endpoints
- **Content Approval**: Multi-stage publishing workflows
- **Participant Management**: Role-based workflow participation
- **Invitation System**: Invite users to workflows with specific roles

### Media Management
- **R2 Storage**: Cloudflare R2 for media files
- **Share Links**: Temporary and permanent sharing with access controls
- **Tenant Awareness**: All media files associated with tenants
- **Access Control**: Role-based permissions for media operations
- **Content Publishing**: Direct publishing from media library to public content

## 📚 Documentation

- [Local Development Guide](LOCAL_DEVELOPMENT.md)
- [Project Structure](Structure.md)
- [Logging & Analytics](LOGGING_AND_ANALYTICS_README.md)
- [Messaging System](MESSAGING_SYSTEM.md)
- [Workflow Features](WORKFLOW_FEATURES.md)
- [Subscriber Pages Implementation](SUBSCRIBER_PAGES_IMPLEMENTATION_PLAN.md)
- [Subscriber Email System](SUBSCRIBER_EMAIL_SYSTEM_README.md)
- [Content Publishing Strategy](CONTENT_PUBLISHING_STRATEGY.md)
- [Internationalization](INTERNATIONALIZATION_README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 