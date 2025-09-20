import NextAuth, { type DefaultSession } from "next-auth"
import { JWT, encode as defaultEncode, decode as defaultDecode } from "next-auth/jwt"
import { D1Adapter } from "@auth/d1-adapter";
import type { AdapterUser, Adapter, AdapterAccount } from "@auth/core/adapters"
import Credentials from "next-auth/providers/credentials";
import { validateCredentials } from '@/lib/credentials';
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import LinkedIn from "next-auth/providers/linkedin";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { TestProvider } from '@/lib/test-provider';
import { v4 as uuid } from "uuid";
import { NormalizedLogging, createNormalizedMetadata } from "@/lib/normalized-logging";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

type UserRole = 'admin' | 'tenant' | 'subscriber' | 'user';

type credUser = {
  email: string;
  password: string; 
  role: UserRole;
};
 
declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: UserRole
  }
}

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's role. */
      role?: UserRole
    } & DefaultSession["user"]
  }
  interface User {
    role: UserRole | null;
  }
}

interface CustomAdapterUser extends AdapterUser {
  role: UserRole | null;
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole | null;
  }
}

// Get database instance
async function getDatabase() {
  try {
    const context = await getCloudflareContext({async: true});
    return context.env.DB;
  } catch (error) {
    console.error('Failed to get Cloudflare context:', error);
    return undefined;
  }
}

// Create a custom adapter that includes the role property
export async function createCustomAdapter() {
  const db = await getDatabase();
  if (!db) {
    console.warn('Database not available, using fallback adapter');
    return undefined;
  }

  return {
    ...D1Adapter(db),
    createUser: async (user: CustomAdapterUser) => {
      const createdUser = await D1Adapter(db).createUser?.(user);
      if (createdUser) {
        return {
          ...createdUser,
          role: user.role || null
        } as CustomAdapterUser;
      }
      return null as unknown as CustomAdapterUser;
    },
    getUserByEmail: async (email: string) => {
      const user = await D1Adapter(db).getUserByEmail?.(email);
      if (user) {
        return {
          ...user,
          role: (user as CustomAdapterUser).role || null
        } as CustomAdapterUser;
      }
      return null as unknown as CustomAdapterUser;
    },
    getUser: async (id: string) => {
      const user = await D1Adapter(db).getUser?.(id);
      if (user) {
        return {
          ...user,
          role: (user as CustomAdapterUser).role || null
        } as CustomAdapterUser;
      }
      return null as unknown as CustomAdapterUser;
    },
    getUserByAccount: async (providerAccountId: Pick<AdapterAccount, "provider" | "providerAccountId">) => {
      const user = await D1Adapter(db).getUserByAccount?.(providerAccountId);
      if (user) {
        return {
          ...user,
          role: (user as CustomAdapterUser).role || null
        } as CustomAdapterUser;
      }
      return null as unknown as CustomAdapterUser;
    },
    updateUser: async (user: CustomAdapterUser) => {
      const updatedUser = await D1Adapter(db).updateUser?.(user);
      if (updatedUser) {
        return {
          ...updatedUser,
          role: user.role || null
        } as CustomAdapterUser;
      }
      return null as unknown as CustomAdapterUser;
    }
  } as unknown as Adapter;
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { env } = await getCloudflareContext({async: true});
  
  // Use Cloudflare env in production, process.env in development
  const getEnvVar = (key: string): string | undefined => {
    if (process.env.NODE_ENV === 'development') {
      return process.env[key];
    }
    // In production, secrets are accessible via env but not typed in the interface
    const value = (env as any)[key];
    return typeof value === 'string' ? value : undefined;
  };
  
  return {
    providers: [
      Credentials({
        name: 'Credentials',
        credentials: {
          email: {},
          password: {},
        },
        async authorize(credentials) {
          let credUser: credUser | null = null
          const res = await validateCredentials(
            credentials.email as string,
            credentials.password as string,
          )
          if (res.success && res.user) {
            credUser = {
              email: res.user.email,
              password: credentials.password as string,
              role: res.user.role as UserRole
            }
          }

          if (credUser) {
            return credUser
          } else {
            return null
          }
        },
      }),
      TestProvider({
        id: 'test-credentials',
        name: 'Test Users',
        type: 'credentials',
      }),
      Resend({
        apiKey: getEnvVar('AUTH_RESEND_KEY'),
        from: 'info@logosophe.com',
        sendVerificationRequest(params) {
          const { identifier: email, url } = params;
          // Custom email sending logic with redirect to /harbor
          const verificationUrl = new URL(url);
          verificationUrl.searchParams.set('callbackUrl', '/harbor');
          
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getEnvVar('AUTH_RESEND_KEY')}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: 'info@logosophe.com',
              to: email,
              subject: `Sign in to ${verificationUrl.host}`,
              html: `
                <body style="background: #f9f9f9;">
                  <table width="100%" border="0" cellspacing="20" cellpadding="0"
                    style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;">
                    <tr>
                      <td align="center"
                        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
                        Sign in to <strong>${verificationUrl.host}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <table border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center" style="border-radius: 5px;" bgcolor="#346df1">
                              <a href="${verificationUrl.toString()}"
                                target="_blank"
                                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #fff; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid #346df1; display: inline-block; font-weight: bold;">
                                Sign in
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center"
                        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
                        If you did not request this email you can safely ignore it.
                      </td>
                    </tr>
                  </table>
                </body>
              `,
              text: `Sign in to ${verificationUrl.host}\n${verificationUrl.toString()}\n\n`,
            }),
          }).then(res => {
            if (!res.ok) {
              throw new Error("Resend error: " + JSON.stringify(res.json()));
            }
          });
        },
      }),
      Google({
        clientId: getEnvVar('AUTH_GOOGLE_ID'),
        clientSecret: getEnvVar('AUTH_GOOGLE_SECRET'),
        authorization: {
          params: {
            prompt: "select_account"
          }
        }
      }),
      Apple({
        clientId: getEnvVar('AUTH_APPLE_ID'),
        clientSecret: getEnvVar('AUTH_APPLE_SECRET'),
        authorization: {
          params: {
            scope: 'name email',
            response_mode: 'form_post'
          }
        }
      }),
      LinkedIn({
        clientId: getEnvVar('AUTH_LINKEDIN_ID'),
        clientSecret: getEnvVar('AUTH_LINKEDIN_SECRET'),
        authorization: {
          params: {
            scope: 'openid profile email'
          }
        }
      }),
      MicrosoftEntraID({
        clientId: getEnvVar('AUTH_MICROSOFT_ENTRA_ID_ID'),
        clientSecret: getEnvVar('AUTH_MICROSOFT_ENTRA_ID_SECRET'),
        issuer: getEnvVar('AUTH_MICROSOFT_ENTRA_ID_ISSUER'),
        authorization: {
          params: {
            scope: 'openid profile email'
          }
        }
      }),
    ],
    adapter: await createCustomAdapter(),
    session: {
      strategy: 'database',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: getEnvVar('AUTH_SECRET'),
    experimental: { enableWebAuthn: true },
    pages: {
      signIn: '/signin',
    },
    debug: false,
    trustHost: true,
    trustedHosts: [
      'www.logosophe.com',
      'local-dev.logosophe.com',
      'localhost:3001',
      'localhost:3000'
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.role = user.role || 'user';
        }
        return token;
      },
      async session({ session }) {
        if (session.user) {
          const db = env.DB;
          if (!db) {
            console.error('Database not available');
            return session;
          }
          
          // Check if this is a test user
          if (session.user.email && session.user.email.endsWith('@logosophe.test')) {
            // For test users, determine role based on user number
            const match = session.user.email.match(/test-user-(\d+)@logosophe\.test/);
            if (match) {
              const userNumber = parseInt(match[1], 10);
              
              // Determine role based on user number range
              if (userNumber >= 301 && userNumber <= 305) {
                // Opted-in users (301-305) should be subscribers
                session.user.role = 'subscriber';
              } else if (userNumber >= 410 && userNumber <= 445) {
                // Tenant users (410-445) should be subscribers
                session.user.role = 'subscriber';
              } else {
                // Other test users (101-105, 201-205) should be users
                session.user.role = 'user';
              }
            } else {
              session.user.role = 'user';
            }
          } else {
            // For non-test users, check database tables
            const credResult = await db.prepare(
              'SELECT Role FROM Credentials WHERE Email = ?'
            ).bind(session.user.email).first();
            
            if (credResult?.Role === 'admin' || credResult?.Role === 'tenant') {
              session.user.role = credResult.Role;
            } else {
                          // Check Subscribers table - ONLY verified subscribers get the role
            const subscriberResult = await db.prepare(
              'SELECT 1 FROM Subscribers WHERE Email = ? AND Active = TRUE AND EmailVerified IS NOT NULL'
            ).bind(session.user.email).first();
            
            if (subscriberResult) {
              session.user.role = 'subscriber';
            } else {
              session.user.role = 'user';
            }
            }
          }
        }
        return session;
      },
      async redirect({ url, baseUrl }) {
        // Ensure we have a valid baseUrl, fallback to environment variable or default
        let fallbackBaseUrl = baseUrl;
        if (!fallbackBaseUrl) {
          try {
            const context = await getCloudflareContext({async: true});
            fallbackBaseUrl = (context.env as any).NEXTAUTH_URL || 'https://local-dev.logosophe.com';
          } catch {
            fallbackBaseUrl = 'https://local-dev.logosophe.com';
          }
        }
        
        // Validate url parameter before processing
        if (!url || typeof url !== 'string') {
          return fallbackBaseUrl;
        }
        
        // Check if there's a redirectTo parameter
        try {
          const urlObj = new URL(url);
          const redirectTo = urlObj.searchParams.get('redirectTo');
          
          if (redirectTo && redirectTo.startsWith('/')) {
            // Redirect to the specified page
            return `${fallbackBaseUrl}${redirectTo}`;
          }
          
          // Handle redirects for different authentication flows
          if (url.startsWith('/')) return `${fallbackBaseUrl}${url}`;
          else if (urlObj.origin === fallbackBaseUrl) return url;
          return fallbackBaseUrl;
        } catch (error) {
          // If URL parsing fails, treat as relative path
          if (url.startsWith('/')) {
            return `${fallbackBaseUrl}${url}`;
          }
          return fallbackBaseUrl;
        }
      }
    },
    jwt: {
      encode: async function (params) {
        if (params.token && params.token.email && params.token.role) {
          const sessionToken = uuid();
          if (!params.token.sub) {
            params.token.sub = params.token.email;
          }
          
          const adapter = await createCustomAdapter();
          if (!adapter) {
            console.error('Adapter not available for JWT encoding');
            return defaultEncode(params);
          }
          
          let userObject = await adapter.getUserByEmail?.(params.token.email);
          if (!userObject) {
            userObject = await adapter.createUser?.({
              id: params.token.sub,
              email: params.token.email,
              emailVerified: null,
              role: params.token.role,
            });
          }
          if (userObject && !userObject.role) {
            userObject.role = params.token.role;
            await adapter.updateUser?.(userObject);
          }
          if (!userObject?.id) throw new Error('User object missing id');
          
          // Create new session
          const createdSession = await adapter.createSession?.({
            sessionToken,
            userId: userObject.id,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          if (!createdSession) {
            throw new Error('Failed to create session');
          }
          return sessionToken;
        }
        return defaultEncode(params);
      },
      decode(params) {
        return defaultDecode(params);
      }
    },
    events: {
      async signIn({ user, account }) {
        const ctx = await getCloudflareContext({async: true});
        const db = ctx.env.DB;
        if (!db) {
          console.error('Database not available');
          return;
        }
        
        if (!user.email) {
          console.error('User email is missing in signIn event');
          return;
        }
        
        const adapter = await createCustomAdapter();
        if (!adapter) {
          console.error('Adapter not available for sign-in event');
          return;
        }
        
        const dbUser = await adapter.getUserByEmail?.(user.email);
        
        // Log the signin using normalized logging
        const normalizedLogging = new NormalizedLogging(db);
        const headersList = await headers();
        
        const authMetadata = createNormalizedMetadata({
          sessionStartTime: new Date().toISOString(),
          provider: account?.provider || 'credentials',
          operationType: 'user_signin'
        });

        await normalizedLogging.logAuthentication({
          userEmail: user.email,
          userId: (dbUser?.id || user.id) as string,
          provider: account?.provider || 'credentials',
          activityType: 'signin',
          accessType: 'auth',
          targetId: user.email,
          targetName: `${user.email} (${account?.provider || 'credentials'})`,
          ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          metadata: authMetadata
        });
        const adminUser = await db.prepare(
          'SELECT 1 FROM Credentials WHERE Email = ?'
        ).bind(user.email).first();
        
        // Only populate CurrentProvider for non-Credentials users
        if (!adminUser) {
          // Update or create preferences with CurrentProvider for non-Credentials users
          const provider = account?.provider || 'credentials';
          const existingPreferences = await db.prepare(
            'SELECT 1 FROM Preferences WHERE Email = ?'
          ).bind(user.email).first();
          
          if (existingPreferences) {
            // Update existing preferences with CurrentProvider
            await db.prepare(`
              UPDATE Preferences 
              SET CurrentProvider = ?, UpdatedAt = CURRENT_TIMESTAMP 
              WHERE Email = ?
            `).bind(provider, user.email).run();
          } else {
            // Create new preferences with CurrentProvider
            await db.prepare(`
              INSERT INTO Preferences (Email, Theme, Language, CurrentProvider, CreatedAt, UpdatedAt) 
              VALUES (?, 'light', 'en', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(user.email, provider).run();
          }
          
          const hasTenantRole = await db.prepare(`
            SELECT 1 FROM TenantUsers WHERE Email = ?
          `).bind(user.email).first();
          if (!hasTenantRole) {
            await db.prepare(`
              INSERT INTO TenantUsers (TenantId, Email, RoleId)
              VALUES (?, ?, ?)
            `).bind('default', user.email, 'user').run();
            const hasUserRole = await db.prepare(`
              SELECT 1 FROM UserRoles WHERE TenantId = ? AND Email = ? AND RoleId = ?
            `).bind('default', user.email, 'user').first();
            if (!hasUserRole) {
              try {
                await db.prepare(`
                  INSERT INTO UserRoles (TenantId, Email, RoleId)
                  VALUES (?, ?, ?)
                `).bind('default', user.email, 'user').run();
              } catch (err) {
                // Silently ignore errors in production
              }
            }
          }
        }
      }
    }
  };
}); 