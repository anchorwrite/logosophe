# **Logosophe Project Structure**

## **Project Overview**
Modern content publishing platform using OpenNext + Cloudflare Workers, featuring comprehensive RBAC, real-time messaging, enterprise-grade analytics, and multi-tenant architecture. Organized by functional areas (Content, Harbor, Dashboard) with AuthJS v5 and Durable Objects for real-time features.

---

## **Complete Project Structure**

```
logosophe/
├── apps/
│   ├── worker/              # Main Next.js application (214 API endpoints)
│   │   ├── app/             # Next.js app directory
│   │   │   ├── [lang]/      # Internationalized routes (5 languages)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── harbor/  # Authenticated content creation
│   │   │   │   ├── signin/  # Authentication pages
│   │   │   │   ├── signout/ # Sign out functionality
│   │   │   │   └── content/ # Published content
│   │   │   ├── dashboard/   # Admin interface (69 files)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── users/   # User management
│   │   │   │   ├── workflow/ # Admin workflow functions
│   │   │   │   ├── system/  # System management
│   │   │   │   └── api/     # Dashboard-specific APIs
│   │   │   ├── api/         # API routes (214 endpoints)
│   │   │   │   ├── auth/    # Authentication endpoints
│   │   │   │   ├── media/   # Media management
│   │   │   │   ├── workflow/ # Workflow APIs
│   │   │   │   ├── harbor/  # Harbor-specific APIs
│   │   │   │   └── dashboard/ # Dashboard-specific APIs
│   │   │   ├── components/  # React components (103 files)
│   │   │   ├── lib/         # Utilities and configurations (27 files)
│   │   │   ├── locales/     # Translation files (5 languages)
│   │   │   ├── contexts/    # React contexts
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── types/       # TypeScript type definitions
│   │   │   ├── auth.ts      # AuthJS v5 configuration
│   │   │   ├── layout.tsx   # Root layout
│   │   │   └── page.tsx     # Home page
│   │   ├── migrations/      # Database migrations
│   │   ├── scripts/         # Development scripts
│   │   ├── public/          # Static assets
│   │   ├── wrangler.jsonc   # Worker configuration
│   │   └── package.json
│   └── email-worker/        # Separate Cloudflare Worker for email processing
│       ├── app/
│       │   └── index.ts
│       ├── wrangler.jsonc
│       └── package.json
├── packages/
│   ├── common/              # Shared utilities, components, and types
│   │   ├── types/           # TypeScript type definitions
│   │   │   ├── auth.ts
│   │   │   ├── content.ts
│   │   │   ├── harbor.ts
│   │   │   ├── dashboard.ts
│   │   │   └── index.ts
│   │   ├── utils/           # Shared utility functions
│   │   │   ├── database.ts
│   │   │   ├── auth.ts
│   │   │   ├── validation.ts
│   │   │   └── index.ts
│   │   ├── constants/       # Shared constants
│   │   │   ├── languages.ts
│   │   │   ├── roles.ts
│   │   │   └── index.ts
│   │   ├── components/      # Shared React components
│   │   │   ├── ui/          # Radix UI components
│   │   │   └── index.ts
│   │   └── package.json
│   ├── database/            # Database schemas and migrations
│   │   ├── migrations/      # Database migrations (17 files)
│   │   └── package.json
│   └── config/              # Shared configuration
│       ├── auth.ts
│       ├── database.ts
│       ├── email.ts
│       └── package.json
├── scripts/                 # Development and deployment scripts
│   ├── setup-local-dev.sh
│   ├── tunnel.sh
│   └── deploy.sh
├── .github/workflows/       # CI/CD pipelines (GitHub Actions)
├── LOCAL_DEVELOPMENT.md     # Local development setup guide
├── Structure.md             # This file
├── README.md                # Project documentation
├── package.json             # Root package.json (yarn workspaces)
└── yarn.lock
```

---

## **Technology Stack**

### **Core Technologies:**
- **OpenNext 1.6.2**: Full Cloudflare Workers support
- **AuthJS v5**: NextAuth 5.0.0-beta.29 with D1 adapter
- **React 18.3.1**: Stable version (not 19.1.0)
- **Radix UI/Themes 2.0.3**: UI framework (no Tailwind CSS)
- **Next.js 15.3.5**: Latest stable
- **TypeScript 5.8.3**: Latest stable
- **Yarn 4.5.3**: Package manager with workspaces

### **Cloudflare Services:**
- **Workers**: Main application runtime
- **D1**: Database (logosophe - ID: fd7b2b89-eedd-4111-ba68-fdb05cdf2995)
- **R2**: Media storage with tenant-aware access control
- **Durable Objects**: Real-time features (workflows, messaging, notifications)
- **Tunnels**: Local development (local-dev.logosophe.com)

### **Additional Technologies:**
- **i18next**: Internationalization (5 languages: EN, DE, ES, FR, NL)
- **NormalizedLogging**: Enterprise-grade analytics system
- **bcryptjs**: Password hashing for credentials
- **date-fns**: Date manipulation and timezone handling
- **recharts**: Analytics dashboard charts
- **lucide-react**: Icon library

---

## **Configuration Files**

### **Root package.json:**
```json
{
  "name": "logosophe",
  "private": true,
  "packageManager": "yarn@4.5.3",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "yarn workspace worker dev",
    "build": "yarn workspace worker build",
    "preview": "yarn workspace worker preview",
    "deploy": "yarn workspace worker deploy",
    "upload": "yarn workspace worker upload",
    "deploy:email": "yarn workspace email-worker deploy",
    "tunnel": "cloudflared tunnel run local-dev",
    "tunnel:logosophe-dev": "bash -c 'cp ~/.cloudflared/config-logosophe-dev.yml ~/.cloudflared/config.yml && cloudflared tunnel run local-dev'",
    "tunnel:logosophe-preview": "bash -c 'cp ~/.cloudflared/config-logosophe-preview.yml ~/.cloudflared/config.yml && cloudflared tunnel run local-dev'"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250731.0",
    "@opennextjs/cloudflare": "^1.6.2",
    "esbuild": "^0.20.0",
    "wrangler": "^4.24.0"
  },
  "installConfig": {
    "hoistingLimits": "workspaces"
  }
}
```

### **Worker package.json:**
```json
{
  "name": "worker",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview --port 8789",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  },
  "dependencies": {
    "@auth/core": "^0.40.0",
    "@auth/d1-adapter": "^1.10.0",
    "@formatjs/intl-localematcher": "^0.6.1",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/themes": "^2.0.3",
    "bcryptjs": "^3.0.2",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "i18next": "^25.3.1",
    "i18next-browser-languagedetector": "^8.2.0",
    "i18next-http-backend": "^3.0.2",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.513.0",
    "negotiator": "^1.0.0",
    "next": "15.3.5",
    "next-auth": "^5.0.0-beta.29",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-dropzone": "^14.3.8",
    "react-file-icon": "^1.6.0",
    "react-hot-toast": "^2.5.2",
    "react-i18next": "^15.6.0",
    "react-is": "^18.3.1",
    "react-toastify": "^11.0.5",
    "recharts": "^3.1.2",
    "tailwind-merge": "^3.3.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250708.0",
    "@next/eslint-plugin-next": "^15.3.5",
    "@opennextjs/cloudflare": "^1.6.2",
    "@types/bcryptjs": "^3.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/negotiator": "^0.6.4",
    "@types/node": "24.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/react-file-icon": "^1.0.4",
    "@types/react-is": "^18.3.1",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.57.1",
    "eslint-config-next": "^15.3.5",
    "eslint-config-prettier": "^9.1.0",
    "typescript": "^5.8.3",
    "wrangler": "^4.24.0"
  },
  "browser": {
    "crypto": false
  },
  "optionalDependencies": {
    "sharp": "^0.34.2"
  }
}
```

### **Worker wrangler.jsonc:**
```jsonc
{
  "name": "logosophe",
  "main": ".open-next/index.js",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "logosophe",
      "database_id": "fd7b2b89-eedd-4111-ba68-fdb05cdf2995"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "logosophe-media"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "WORKFLOW_DO",
        "class_name": "WorkflowDurableObject"
      },
      {
        "name": "USER_NOTIFICATIONS_DO", 
        "class_name": "UserNotificationsDurableObject"
      },
      {
        "name": "COMMENT_DO",
        "class_name": "CommentDurableObject"
      }
    ]
  }
}
```

### **Email Worker wrangler.jsonc:**
```jsonc
{
  "name": "logosophe-email",
  "main": "app/index.ts",
  "compatibility_date": "2024-01-01"
}
```

---

## **AuthJS v5 Configuration**

### **Authentication System Overview:**
- **Framework**: AuthJS v5 (NextAuth 5.0.0-beta.29) with D1 adapter
- **Session Strategy**: Database-based sessions for tenant-aware RBAC
- **Providers**: Google OAuth, Apple OAuth, Credentials (admin/tenant), Resend (email)
- **Configuration**: `apps/worker/app/auth.ts`

### **User Types & Authentication:**
1. **Credentials Users**: Admin and tenant users with email/password authentication
2. **OAuth Users**: Google and Apple OAuth with subscriber opt-in
3. **Regular Users**: Default tenant users with limited access

### **Database Schema for Auth:**
- **Users Table**: Standard Auth.js users table
- **Accounts Table**: OAuth provider accounts
- **Sessions Table**: Session management with sessionToken, userId, expires
- **Verification Tokens**: Email verification flows
- **Credentials Table**: Custom table for admin/tenant users
- **Subscribers Table**: Custom table for regular users with opt-in

### **Key Features:**
- **Tenant-Aware RBAC**: Role-based access control with tenant context
- **Session Management**: Database strategy for persistent sessions
- **Event Logging**: Authentication events logged to SystemLogs
- **Role Resolution**: Dynamic role checking against Credentials and Subscribers tables
- **Error Handling**: Proper NEXT_REDIRECT error handling for Auth.js flows

---

## **Local Development Setup**

### **Prerequisites:**
- Node.js 18+
- Yarn 4.5.3+
- Cloudflare account with API token
- Cloudflare tunnel (`cloudflared`)

### **Quick Start:**
```bash
# 1. Install dependencies
yarn install

# 2. Setup local development
./scripts/setup-local-dev.sh

# 3. Start development
# Terminal 1: Start tunnel
yarn tunnel:logosophe-dev

# Terminal 2: Start development server
yarn dev
```

### **Environment Variables:**
Create `.env.local` in `apps/worker/`:
```env
NEXTAUTH_URL=https://local-dev.logosophe.com
AUTH_URL=https://local-dev.logosophe.com
AUTH_REDIRECT_PROXY_URL=https://local-dev.logosophe.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=911edf2379732c1038a6a894cae9bee5
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_APPLE_ID=your_apple_client_id
AUTH_APPLE_SECRET=your_apple_client_secret
AUTH_RESEND_API_KEY=your_resend_api_key
```

### **Database Commands:**
```bash
# All wrangler commands must be run from apps/worker/ directory
cd apps/worker

# List databases
yarn wrangler d1 list

# Execute on local database
yarn wrangler d1 execute logosophe --command "SQL"

# Execute on remote database
yarn wrangler d1 execute logosophe --remote --command "SQL"

# Check table structure
yarn wrangler d1 execute logosophe --command "PRAGMA table_info(table_name);"
```

### **URLs:**
- **Local Development**: https://local-dev.logosophe.com
- **Production**: https://logosophe.com

---

## **Database Configuration**

### **Database Details:**
- **Database Name**: `logosophe`
- **Database ID**: `fd7b2b89-eedd-4111-ba68-fdb05cdf2995`
- **Binding**: `DB` in wrangler configuration
- **Local Database**: `.wrangler/state/v3/d1`
- **Remote Database**: Cloudflare D1 instance

### **Database Schema Overview:**
- **40+ Tables** organized by system (Authentication, Media, Messaging, Workflows, etc.)
- **Foreign Key Constraints** for data integrity
- **Performance Indexes** on frequently queried columns
- **Initial Data** including roles, permissions, and access templates
- **Soft Deletes** using IsDeleted flags where appropriate
- **Audit Logging** via SystemLogs table

### **Key Database Tables:**
- **Authentication**: Credentials, Subscribers, accounts, sessions, users, verification_tokens
- **Tenant Management**: Tenants, TenantUsers, UserRoles
- **Media Management**: MediaFiles, MediaAccess, MediaAccessTemplates, MediaShareLinks
- **Messaging**: Messages, MessageRecipients, MessageAttachments, MessageThreads, MessageRateLimits, UserBlocks
- **Workflows**: Workflows, WorkflowHistory, WorkflowMessages, WorkflowParticipants
- **System**: SystemLogs, SystemSettings, UserActivity, UserAvatars, TestSessions
- **Resources**: Resources, ResourceAccess, TenantResources, PublishedContent, Preferences

### **Migration System:**
- **Migration Location**: `packages/database/migrations/`
- **Current Migration**: `001-initial-schema.sql` (applied to both local and remote)
- **Migration Script**: `packages/database/migrations/apply-migration.sh`
- **Documentation**: `packages/database/migrations/README.md`

---

## **RBAC & Authentication System**

### **User Types & Roles:**

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

### **Access Control Patterns:**
- **System Admin**: Global admin privileges across all resources
- **Tenant Admin**: Full control within assigned tenants
- **Role-Based**: Dynamic validation against Roles table
- **Permission Types**: view, download, edit, delete, upload, share, link, send

### **Key Tables:**
- **TenantUsers**: Base tenant membership and roles
- **UserRoles**: Additional role assignments for subscribers
- **Roles**: Role definitions with permissions
- **MediaAccess**: Resource-specific access control

### **Role Resolution Logic:**
1. Check for admin role first
2. Check for tenant role in Credentials
3. Check all roles in UserRoles table
4. Check Subscriber table as fallback
5. Access granted if ANY role matches allowed roles

---

## **Logging & Analytics System**

### **NormalizedLogging System:**
- **User Action Logging**: Use `NormalizedLogging` class for all user interactions
- **Database Management**: `SystemLogs` retained ONLY for essential database operations
- **Import Pattern**: `import { NormalizedLogging, extractRequestContext } from '@/lib/normalized-logging'`

### **Logging Methods:**
- `logMediaOperations()` - File upload, download, view, delete, share
- `logWorkflowOperations()` - Workflow creation, updates, collaboration
- `logMessagingOperations()` - Message sending, reading, archiving
- `logUserManagement()` - Role assignments, profile updates
- `logAuthentication()` - Sign in, sign out, password changes
- `logSystemOperations()` - Settings, configuration, errors

### **Analytics Features:**
- **Real-time Analytics**: Live dashboard with user activity
- **Trend Analysis**: Historical data and usage patterns
- **Multi-language Support**: Analytics in user's preferred language
- **Dual Dashboards**: Separate views for different user types
- **Rich Metadata**: Structured context for advanced analytics

---

## **GitHub Actions**

### **.github/workflows/worker-deployment.yaml:**
```yaml
on: [push]
jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    name: Deploy Worker to Cloudflare
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Enable Corepack
        run: corepack enable
      - name: Yarn Set Version
        run: yarn set version latest --yarn-path
      - name: Yarn Install
        run: yarn install
      - name: Deploy Worker
        run: yarn workspace worker deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### **.github/workflows/email-worker-deployment.yaml:**
```yaml
on: [push]
jobs:
  deploy-email-worker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    name: Deploy Email Worker to Cloudflare
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Enable Corepack
        run: corepack enable
      - name: Yarn Set Version
        run: yarn set version latest --yarn-path
      - name: Yarn Install
        run: yarn install
      - name: Deploy Email Worker
        run: yarn workspace email-worker deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```