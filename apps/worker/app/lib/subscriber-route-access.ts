// Access check for /api/harbor/subscribers/[email]/* routes.
//
// These routes read and write a subscriber's own data, and the SQL scopes
// every query to the email in the URL. That email comes from the caller, so
// each handler must first confirm it belongs to the signed-in user.

import { auth } from '@/auth';

/** Normalise an email from a URL segment for comparison (decodes %40 etc.). */
function normaliseEmail(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed escape sequence: compare the raw value, which won't match.
  }
  return decoded.trim().toLowerCase();
}

/**
 * Returns an error Response (401 or 403) unless the signed-in user owns
 * `email`, or null when the request may proceed.
 *
 *   const denied = await requireSubscriberSelf(email);
 *   if (denied) return denied;
 */
export async function requireSubscriberSelf(email: string): Promise<Response | null> {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (normaliseEmail(session.user.email) !== normaliseEmail(email)) {
    return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return null;
}
