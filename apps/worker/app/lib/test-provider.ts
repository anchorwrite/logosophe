import type { Provider } from "next-auth/providers";

export interface TestProviderConfig {
  id: string;
  name: string;
  type: "credentials";
}

export function TestProvider(config: TestProviderConfig): Provider {
  return {
    id: config.id,
    name: config.name,
    type: "credentials",
    credentials: {
      email: {},
    },
    async authorize(credentials) {
      if (!credentials?.email || typeof credentials.email !== 'string') {
        return null;
      }

      // Only allow test users with the logosophe.test domain
      if (!credentials.email.endsWith('@logosophe.test')) {
        return null;
      }

      // Extract user number from email (e.g., test-user-101@logosophe.test -> 101)
      const match = credentials.email.match(/test-user-(\d+)@logosophe\.test/);
      if (!match) {
        return null;
      }

      const userNumber = parseInt(match[1], 10);
      
      // Determine user type based on number range
      let userType = 'unknown';
      let signedIn = false;
      let optedIn = false;
      
      if (userNumber >= 101 && userNumber <= 105) {
        userType = 'unsigned';
        signedIn = false;
        optedIn = false;
      } else if (userNumber >= 201 && userNumber <= 205) {
        userType = 'signed';
        signedIn = true;
        optedIn = false;
      } else if (userNumber >= 301 && userNumber <= 305) {
        userType = 'opted-in';
        signedIn = true;
        optedIn = true;
      } else if (userNumber >= 410 && userNumber <= 469) {
        userType = 'tenant-subscriber';
        signedIn = true;
        optedIn = true;
      }

      // Determine role based on user type
      let role: 'user' | 'subscriber' = 'user';
      if (userNumber >= 301 && userNumber <= 305) {
        role = 'subscriber'; // Opted-in users should be subscribers
      } else if (userNumber >= 410 && userNumber <= 469) {
        role = 'subscriber'; // Tenant users should be subscribers
      }

      return {
        id: `test-user-${userNumber}`, // Use consistent ID format
        email: credentials.email,
        name: `Test User ${userNumber}`,
        image: null,
        role: role,
        // Add metadata for debugging
        userType,
        signedIn,
        optedIn,
        userNumber,
      };
    },
  };
} 