import { createAuthClient } from 'better-auth/react';
import { adminClient, magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [
    adminClient(),
    magicLinkClient(),
  ],
});
