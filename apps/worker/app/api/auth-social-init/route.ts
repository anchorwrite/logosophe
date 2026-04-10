// GET /api/auth-social-init?provider=google&callbackUrl=/en/harbor
// Initiates OAuth via a proper GET handler so BA can set its state cookies.
// Server actions cannot set these cookies — this route solves that.

import { createAuth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const callbackUrl = searchParams.get('callbackUrl') || '/harbor';

  if (!provider) {
    return new Response('Missing provider', { status: 400 });
  }

  const auth = await createAuth();
  // Use asResponse: true to get the full response (including state/PKCE cookies)
  const baResponse = await auth.api.signInSocial({
    body: { provider: provider as any, callbackURL: callbackUrl },
    headers: request.headers,
    asResponse: true,
  });

  // BA returns JSON { url, redirect: true } — we must issue the actual redirect
  // so the browser navigates to the OAuth provider instead of displaying JSON.
  const body = await baResponse.json() as { url?: string };
  if (!body.url) {
    return new Response('Failed to get OAuth URL', { status: 500 });
  }

  const redirectResponse = NextResponse.redirect(body.url);
  // Forward any Set-Cookie headers BA wrote (PKCE state, etc.)
  baResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      redirectResponse.headers.append('set-cookie', value);
    }
  });
  return redirectResponse;
}
