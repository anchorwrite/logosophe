// POST /api/auth-credentials
// Handles email+password sign-in for admin/tenant users.
// Uses a real API route (not a server action) so BA's Set-Cookie headers
// can be forwarded directly in the Response.

import { NextRequest, NextResponse } from 'next/server';
import { createAuth } from '@/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const callbackUrl = (formData.get('callbackUrl') as string) || '/dashboard';

  const { env } = await getCloudflareContext({ async: true });
  const baseURL =
    (env as any).AUTH_URL ||
    process.env.AUTH_URL ||
    'https://www.logosophe.com';

  if (!email || !password) {
    return NextResponse.redirect(new URL('/en/signin?error=CredentialsSignin', baseURL));
  }

  const baAuth = await createAuth();
  const baResponse = await baAuth.api.signInEmail({
    body: { email, password },
    headers: request.headers,
    asResponse: true,
  });

  if (!baResponse.ok) {
    return NextResponse.redirect(new URL('/en/signin?error=CredentialsSignin', baseURL));
  }

  // Determine redirect based on Credentials role
  const credRow = await env.DB.prepare('SELECT 1 FROM Credentials WHERE Email = ?')
    .bind(email)
    .first();
  const dest = credRow ? callbackUrl : '/en/harbor';

  const redirectResponse = NextResponse.redirect(new URL(dest, baseURL));

  // Forward all Set-Cookie headers from BA's response
  baResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      redirectResponse.headers.append('set-cookie', value);
    }
  });

  return redirectResponse;
}
