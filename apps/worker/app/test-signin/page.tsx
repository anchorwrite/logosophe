import { redirect } from 'next/navigation';

// Delegates all logic to /api/auth-test-signin which can set cookies
// (Server Components cannot set cookies — only Route Handlers can).
export default async function TestSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>
}) {
  const { token, callbackUrl } = await searchParams;

  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (callbackUrl) params.set('callbackUrl', callbackUrl);

  redirect(`/api/auth-test-signin?${params.toString()}`);
}
