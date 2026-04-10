// GET /api/auth-test-signin?token=...&callbackUrl=...
// Validates a test session token, signs the BA session cookie via HMAC-SHA256,
// and sets it directly in the response before redirecting to harbor.
// Must be a Route Handler (not a Server Component) to set cookies.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createAuth } from '@/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const callbackUrl = searchParams.get('callbackUrl') || '/en/harbor';

  const { env } = await getCloudflareContext({ async: true });

  const baseURL =
    (env as any).AUTH_URL ||
    process.env.AUTH_URL ||
    'https://www.logosophe.com';

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard/test-users?error=no-token', baseURL));
  }

  // Validate token against TestSessions
  const testSession = await env.DB
    .prepare('SELECT TestUserEmail FROM TestSessions WHERE SessionToken = ?')
    .bind(token)
    .first<{ TestUserEmail: string }>();

  if (!testSession) {
    return NextResponse.redirect(new URL('/dashboard/test-users?error=invalid-token', baseURL));
  }

  // Update last accessed timestamp
  await env.DB
    .prepare('UPDATE TestSessions SET LastAccessed = ? WHERE SessionToken = ?')
    .bind(new Date().toISOString(), token)
    .run();

  // Get BA context for cookie name and secret
  const baAuth = await createAuth();
  const ctx = await baAuth.$context;
  const secret = ctx.secret;
  const cookieName = ctx.authCookies.sessionToken.name;
  const cookieAttributes = ctx.authCookies.sessionToken.attributes;

  // Sign the token with HMAC-SHA256 (same as better-call's serializeSignedCookie)
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
  // BA's signCookieValue does: encodeURIComponent(`${value}.${signature}`)
  // Set-Cookie header must contain this encoded value directly — do NOT use
  // NextResponse.cookies.set() which calls encodeURIComponent again (double-encode).
  const cookieValue = encodeURIComponent(`${token}.${signatureB64}`);

  const httpOnly = cookieAttributes.httpOnly ?? true;
  const secure = cookieAttributes.secure ?? true;
  const sameSite = (cookieAttributes.sameSite as string) ?? 'lax';
  const path = cookieAttributes.path ?? '/';
  const maxAge = 30 * 24 * 60 * 60;

  const sameSiteStr = sameSite.charAt(0).toUpperCase() + sameSite.slice(1);
  const cookieParts = [`${cookieName}=${cookieValue}`];
  if (httpOnly) cookieParts.push('HttpOnly');
  if (secure) cookieParts.push('Secure');
  cookieParts.push(`SameSite=${sameSiteStr}`);
  cookieParts.push(`Path=${path}`);
  cookieParts.push(`Max-Age=${maxAge}`);

  const redirectResponse = NextResponse.redirect(new URL(callbackUrl, baseURL));
  redirectResponse.headers.append('set-cookie', cookieParts.join('; '));

  return redirectResponse;
}
