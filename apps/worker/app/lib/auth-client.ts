import { createAuthClient } from 'better-auth/react';
import { adminClient, magicLinkClient } from 'better-auth/client/plugins';

// Same-origin relative base. Do not pass baseURL: '' — Better Auth treats that
// as “unset” and may fall back to a baked-in AUTH_URL from the build env
// (often production), which breaks local tunnel CSRF checks.
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [
    adminClient(),
    magicLinkClient(),
  ],
});
