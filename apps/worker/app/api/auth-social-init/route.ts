// GET /api/auth-social-init?provider=google&callbackUrl=/en/harbor
// Initiates OAuth via a proper GET handler so BA can set its state cookies.
// Server actions cannot set these cookies — this route solves that.

import { createAuth } from '@/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const callbackUrl = searchParams.get('callbackUrl') || '/harbor';

  if (!provider) {
    return new Response('Missing provider', { status: 400 });
  }

  const auth = await createAuth();
  const response = await auth.api.signInSocial({
    body: { provider: provider as any, callbackURL: callbackUrl },
    headers: request.headers,
    asResponse: true,
  });

  return response;
}
