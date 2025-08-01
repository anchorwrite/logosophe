# **Logosophe Project Proposal**

## **Project Overview**
New content publishing platform using OpenNext + Cloudflare Workers, organized by functional buckets (content, harbor, dashboard) with AuthJS v5 stable.

---

## **Complete Project Structure**

```
logosophe/
├── apps/
│   ├── worker/              # Combined worker (frontend + API)
│   │   ├── app/             # Main application
│   │   │   ├── content/     # Published content (public, i18n)
│   │   │   │   ├── [lang]/  # Internationalized routes
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── content/
│   │   │   │   │   │   └── [token]/
│   │   │   │   │   │       └── view/
│   │   │   │   │   │           └── page.tsx
│   │   │   │   │   └── interaction/  # Comments, messaging, blogging
│   │   │   │   │       ├── comments/
│   │   │   │   │       ├── messaging/
│   │   │   │   │       └── blog/
│   │   │   │   └── api/
│   │   │   │       ├── content/
│   │   │   │       └── interaction/
│   │   │   ├── harbor/      # Authenticated content creation
│   │   │   │   ├── [lang]/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── media/
│   │   │   │   │   ├── workflow/     # Uses DOs
│   │   │   │   │   ├── messaging/
│   │   │   │   │   └── content/
│   │   │   │   └── api/
│   │   │   │       ├── harbor/
│   │   │   │       └── workflow/
│   │   │   ├── dashboard/   # Admin interface (credentials auth)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── users/
│   │   │   │   ├── workflow/  # Admin-level workflow functions (uses DOs)
│   │   │   │   ├── system/
│   │   │   │   └── api/
│   │   │   │       ├── dashboard/
│   │   │   │       └── workflow/
│   │   │   ├── auth.ts      # AuthJS v5 configuration
│   │   │   └── index.ts     # Main worker entry point
│   │   ├── wrangler.toml    # Worker configuration
│   │   └── package.json
│   └── email-worker/        # Email worker (copied from anchorwrite)
│       ├── app/
│       │   └── index.ts
│       ├── wrangler.toml
│       └── package.json
├── packages/
│   ├── common/              # Shared utilities, types, constants
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
│   │   │   ├── ui/          # Basic UI components
│   │   │   ├── forms/       # Form components
│   │   │   └── index.ts
│   │   └── package.json
│   ├── database/            # Database schemas, migrations, utilities
│   │   ├── schemas/         # D1 table schemas
│   │   ├── migrations/      # Database migrations
│   │   ├── utils/           # Database utilities
│   │   └── package.json
│   └── config/              # Shared configuration
│       ├── auth.ts          # AuthJS v5 configuration
│       ├── database.ts      # Database configuration
│       ├── email.ts         # Email configuration
│       └── package.json
├── scripts/
│   ├── setup-local-dev.sh  # Setup script for local development
│   ├── tunnel.sh           # Cloudflare tunnel management
│   └── deploy.sh           # Deployment scripts
├── .github/workflows/
│   ├── worker-deployment.yaml
│   └── email-worker-deployment.yaml
├── LOCAL_DEVELOPMENT.md     # Local development setup guide
├── package.json             # Root package.json (yarn workspaces)
├── yarn.lock
└── wrangler.toml           # Root wrangler config
```

---

## **Technology Stack**

### **Core Technologies:**
- **OpenNext**: Full Cloudflare Workers support
- **AuthJS v5**: Stable version (not beta)
- **React 19.1.0**: Latest stable
- **Radix UI/Themes 2.0.3**: Compatible with React 19
- **Next.js 15.3.5**: Latest stable
- **TypeScript 5.8.3**: Latest stable

### **Cloudflare Services:**
- **Workers**: Main application runtime
- **D1**: Database (logosophe-local-dev + contact_submissions)
- **R2**: Media storage
- **Durable Objects**: Real-time features
- **Tunnels**: Local development

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
    "deploy": "yarn workspace worker deploy",
    "deploy:email": "yarn workspace email-worker deploy",
    "tunnel": "cloudflared tunnel run local-dev"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "latest",
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
    "dev": "opennext dev",
    "build": "opennext build",
    "deploy": "wrangler deploy"
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
    "next-auth": "^5.0.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-dropzone": "^14.3.8",
    "react-file-icon": "^1.6.0",
    "react-hot-toast": "^2.5.2",
    "react-i18next": "^15.6.0",
    "react-is": "^19.1.0",
    "react-toastify": "^11.0.5",
    "tailwind-merge": "^3.3.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "latest",
    "@cloudflare/workers-types": "^4.20250708.0",
    "@next/eslint-plugin-next": "^15.3.5",
    "@tailwindcss/typography": "^0.5.16",
    "@types/bcryptjs": "^3.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/negotiator": "^0.6.4",
    "@types/react": "19.1.8",
    "@types/react-dom": "^19.1.6",
    "@types/react-file-icon": "^1.0.4",
    "@types/react-is": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "autoprefixer": "^10.4.21",
    "eslint": "^8.57.1",
    "eslint-config-next": "^15.3.5",
    "eslint-config-prettier": "^9.1.0",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.1.11",
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

### **Worker wrangler.toml:**
```toml
name = "logosophe"
main = ".open-next/index.js"
compatibility_date = "2024-01-01"

[env.local-dev]
name = "logosophe-local-dev"
vars = { ENVIRONMENT = "local-dev" }

[env.local-dev.vars]
NEXTAUTH_URL = "https://local-dev.logosophe.com"
AUTH_URL = "https://local-dev.logosophe.com"
AUTH_REDIRECT_PROXY_URL = "https://local-dev.logosophe.com"

[[env.local-dev.durable_objects.bindings]]
name = "WORKFLOW_DO"
class_name = "WorkflowDurableObject"

[[env.local-dev.durable_objects.bindings]]
name = "USER_NOTIFICATIONS_DO"
class_name = "UserNotificationsDurableObject"

[[env.local-dev.durable_objects.bindings]]
name = "COMMENT_DO"
class_name = "CommentDurableObject"

[env.local-dev.d1_databases]
binding = "DB"
database_name = "logosophe-local-dev"
database_id = "local-dev-database-id"

[env.local-dev.r2_buckets]
binding = "MEDIA_BUCKET"
bucket_name = "logosophe-local-dev-media"
```

### **Email Worker wrangler.toml:**
```toml
name = "logosophe-email"
main = "app/index.ts"
compatibility_date = "2024-01-01"

[env.local-dev]
name = "logosophe-email-local-dev"

[env.local-dev.d1_databases]
binding = "DB"
database_name = "contact_submissions"
database_id = "existing-contact-submissions-id"
```

---

## **AuthJS v5 Configuration**

### **apps/worker/app/auth.ts:**
```typescript
import NextAuth from "next-auth"
import { D1Adapter } from "@auth/d1-adapter"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { getRequestContext } from '@cloudflare/next-on-pages'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: D1Adapter(getRequestContext().env.DB),
  providers: [
    // OAuth providers for Harbor
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_API_KEY!,
    }),
    // Credentials provider for Dashboard
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Custom D1 adapter for credentials
        const { env } = getRequestContext()
        const db = env.DB
        
        // Verify credentials against D1 database
        const user = await db.prepare(`
          SELECT * FROM Subscribers 
          WHERE Email = ? AND Active = TRUE AND Banned = FALSE
        `).bind(credentials?.email).first()
        
        if (user && await bcrypt.compare(credentials?.password || '', user.PasswordHash)) {
          return {
            id: user.Email,
            email: user.Email,
            name: user.Name,
            role: user.Role
          }
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/signin',
    error: '/error'
  }
})
```

---

## **Local Development Setup**

### **Tunnel Configuration:**
```yaml
# ~/.cloudflared/config.yml (add to existing)
tunnel: [logosophe-tunnel-id]
credentials-file: /Users/plowden/.cloudflared/[logosophe-tunnel-id].json

ingress:
  - hostname: local-dev.logosophe.com
    path: /worker/*
    service: https://localhost:8787
    originRequest:
      noTLSVerify: true
  - hostname: local-dev.logosophe.com
    service: https://localhost:8789
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

### **LOCAL_DEVELOPMENT.md:**
```markdown
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
       service: https://localhost:8788
       originRequest:
         noTLSVerify: true
     - hostname: local-dev.logosophe.com
       service: https://localhost:8789
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
```

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