import { betterAuth } from 'better-auth';
import { magicLink, admin } from 'better-auth/plugins';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers as nextHeaders } from 'next/headers';
import { NormalizedLogging, createNormalizedMetadata } from '@/lib/normalized-logging';
import bcrypt from 'bcryptjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'tenant' | 'subscriber' | 'user';

// ─── Resend magic-link sender factory (needs env-resolved key) ───────────────

function makeSendMagicLink(resendKey: string) {
  return async function sendMagicLink({
    email,
    url,
  }: {
    email: string;
    url: string;
    token: string;
  }) {
    const verificationUrl = new URL(url);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
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
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
  };
}

// ─── Role computation (same logic as previous session callback) ───────────────

export async function computeUserRole(
  email: string,
  db: D1Database
): Promise<UserRole> {
  const credResult = await db
    .prepare('SELECT Role FROM Credentials WHERE Email = ?')
    .bind(email)
    .first<{ Role: string }>();
  if (credResult?.Role === 'admin' || credResult?.Role === 'tenant') {
    return credResult.Role as 'admin' | 'tenant';
  }

  const subscriberResult = await db
    .prepare(
      'SELECT 1 FROM Subscribers WHERE Email = ? AND Active = TRUE AND EmailVerified IS NOT NULL'
    )
    .bind(email)
    .first();
  if (subscriberResult) return 'subscriber';

  return 'user';
}

// ─── Compute role for test users from email number range ──────────────────────

function computeTestUserRole(email: string): UserRole {
  const match = email.match(/test-user-(\d+)@logosophe\.test/);
  if (!match) return 'user';
  const n = parseInt(match[1], 10);
  if ((n >= 301 && n <= 305) || (n >= 410 && n <= 445)) return 'subscriber';
  return 'user';
}

// ─── Better Auth instance (request-scoped — D1 not available at module level) ─

export async function createAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const getEnvVar = (key: string): string => {
    const v = (env as unknown as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
    if (typeof process !== 'undefined' && process.env[key]) {
      return process.env[key] as string;
    }
    return '';
  };

  return betterAuth({
    database: db,
    secret: getEnvVar('AUTH_SECRET'),
    baseURL: getEnvVar('AUTH_URL') || 'https://www.logosophe.com',
    trustedOrigins: [
      'https://www.logosophe.com',
      'https://local-dev.logosophe.com',
      'http://localhost:3001',
      'http://localhost:3000',
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,       // refresh if older than 1 day
    },
    socialProviders: {
      google: {
        clientId: getEnvVar('AUTH_GOOGLE_ID'),
        clientSecret: getEnvVar('AUTH_GOOGLE_SECRET'),
        prompt: 'select_account',
      },
      apple: {
        clientId: getEnvVar('AUTH_APPLE_ID'),
        clientSecret: getEnvVar('AUTH_APPLE_SECRET'),
      },
      linkedin: {
        clientId: getEnvVar('AUTH_LINKEDIN_ID'),
        clientSecret: getEnvVar('AUTH_LINKEDIN_SECRET'),
      },
      microsoft: {
        clientId: getEnvVar('AUTH_MICROSOFT_ENTRA_ID_ID'),
        clientSecret: getEnvVar('AUTH_MICROSOFT_ENTRA_ID_SECRET'),
        tenantId: 'common',
      },
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: async (password) => bcrypt.hash(password, 10),
        verify: async ({ hash, password }) => bcrypt.compare(password, hash),
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: makeSendMagicLink(getEnvVar('AUTH_RESEND_KEY')),
        expiresIn: 60 * 60 * 24, // 24 hours
      }),
      admin({
        adminRoles: ['admin'],
      }),
    ],
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'apple', 'linkedin', 'microsoft'],
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            try {
              const { env: hookEnv } = await getCloudflareContext({ async: true });
              const hookDb = hookEnv.DB;

              // 1. Look up user email from BA user table
              const baUser = await hookDb
                .prepare('SELECT email FROM "user" WHERE id = ?')
                .bind(session.userId)
                .first<{ email: string }>();
              if (!baUser?.email) return;

              const email = baUser.email;

              // 2. Compute and persist role
              let role: UserRole;
              if (email.endsWith('@logosophe.test')) {
                role = computeTestUserRole(email);
              } else {
                role = await computeUserRole(email, hookDb);
              }
              await hookDb
                .prepare('UPDATE "user" SET role = ?, updatedAt = ? WHERE id = ?')
                .bind(role, new Date().toISOString(), session.userId)
                .run();

              // 3. Skip Preferences + TenantUsers for admin/tenant users
              const isCredentialsUser = await hookDb
                .prepare('SELECT 1 FROM Credentials WHERE Email = ?')
                .bind(email)
                .first();
              if (isCredentialsUser) return;

              // 4. Determine provider
              const accountRow = await hookDb
                .prepare(
                  'SELECT providerId FROM "account" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1'
                )
                .bind(session.userId)
                .first<{ providerId: string }>();
              const provider = accountRow?.providerId || 'credential';

              // 5. Upsert Preferences (CurrentProvider)
              const existingPrefs = await hookDb
                .prepare('SELECT 1 FROM Preferences WHERE Email = ?')
                .bind(email)
                .first();
              if (existingPrefs) {
                await hookDb
                  .prepare(
                    'UPDATE Preferences SET CurrentProvider = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Email = ?'
                  )
                  .bind(provider, email)
                  .run();
              } else {
                await hookDb
                  .prepare(
                    "INSERT INTO Preferences (Email, Theme, Language, CurrentProvider, CreatedAt, UpdatedAt) VALUES (?, 'light', 'en', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                  )
                  .bind(email, provider)
                  .run();
              }

              // 6. Auto-provision TenantUsers + UserRoles for 'default' tenant
              const hasTenantRow = await hookDb
                .prepare('SELECT 1 FROM TenantUsers WHERE Email = ?')
                .bind(email)
                .first();
              if (!hasTenantRow) {
                await hookDb
                  .prepare(
                    "INSERT INTO TenantUsers (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
                  )
                  .bind(email)
                  .run();
                const hasUserRole = await hookDb
                  .prepare(
                    "SELECT 1 FROM UserRoles WHERE TenantId = 'default' AND Email = ? AND RoleId = 'user'"
                  )
                  .bind(email)
                  .first();
                if (!hasUserRole) {
                  try {
                    await hookDb
                      .prepare(
                        "INSERT INTO UserRoles (TenantId, Email, RoleId) VALUES ('default', ?, 'user')"
                      )
                      .bind(email)
                      .run();
                  } catch {
                    // Ignore FK constraint errors silently
                  }
                }
              }

              // 7. Log authentication event
              const normalizedLogging = new NormalizedLogging(hookDb);
              const authMetadata = createNormalizedMetadata({
                sessionStartTime: new Date().toISOString(),
                provider,
                operationType: 'user_signin',
              });
              await normalizedLogging.logAuthentication({
                userEmail: email,
                userId: session.userId,
                provider,
                activityType: 'signin',
                accessType: 'auth',
                targetId: email,
                targetName: `${email} (${provider})`,
                ipAddress: (session as any).ipAddress || 'unknown',
                userAgent: (session as any).userAgent || 'unknown',
                metadata: authMetadata,
              });
            } catch (err) {
              console.error('session.create.after hook error:', err);
            }
          },
        },
      },
    },
  });
}

// ─── Thin auth() helper ── preserves the ~188 import sites calling auth() ────

export async function auth() {
  const instance = await createAuth();
  const hdrs = await nextHeaders();
  const session = await instance.api.getSession({ headers: hdrs });
  if (!session) return null;

  // Re-run computeUserRole for server-side freshness
  const { env } = await getCloudflareContext({ async: true });
  const email = session.user.email;
  const role = email.endsWith('@logosophe.test')
    ? computeTestUserRole(email)
    : await computeUserRole(email, env.DB);

  return {
    ...session,
    user: {
      ...session.user,
      role,
    },
    expires: new Date(session.session.expiresAt).toISOString(),
  };
}

// ─── Shared session type ──────────────────────────────────────────────────────
// Use instead of importing Session from 'next-auth' in server components/routes.
export type AuthSession = Awaited<ReturnType<typeof auth>>;
