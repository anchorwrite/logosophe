import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createAuth } from '@/auth';

// Server component: validates the test session token, sets the BA session cookie,
// and redirects to harbor. This replaces the old client-side signIn('test-credentials') flow.

export default async function TestSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>
}) {
  const { token, callbackUrl } = await searchParams;

  if (!token) {
    redirect('/dashboard/test-users?error=no-token');
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  // Validate token against TestSessions
  const testSession = await db
    .prepare('SELECT TestUserEmail FROM TestSessions WHERE SessionToken = ?')
    .bind(token)
    .first<{ TestUserEmail: string }>();

  if (!testSession) {
    redirect('/dashboard/test-users?error=invalid-token');
  }

  // Update last accessed timestamp
  await db
    .prepare('UPDATE TestSessions SET LastAccessed = ? WHERE SessionToken = ?')
    .bind(new Date().toISOString(), token)
    .run();

  // Get BA context to determine the exact cookie name and secret for signing
  const baAuth = await createAuth();
  const ctx = await baAuth.$context;
  const secret = ctx.secret;
  const cookieName = ctx.authCookies.sessionToken.name;
  const cookieAttributes = ctx.authCookies.sessionToken.attributes;

  // Sign the token with HMAC-SHA256, same algorithm as better-call's serializeSignedCookie
  const secretBuf = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  const signedValue = encodeURIComponent(`${token}.${signatureB64}`);

  // Set the BA session cookie
  const cookieStore = await cookies();
  cookieStore.set(cookieName, signedValue, {
    httpOnly: cookieAttributes.httpOnly ?? true,
    sameSite: (cookieAttributes.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
    secure: cookieAttributes.secure ?? true,
    path: cookieAttributes.path ?? '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  redirect(callbackUrl || '/en/harbor');
}
