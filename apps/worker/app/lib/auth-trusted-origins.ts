/**
 * Build Better Auth trustedOrigins: known hosts in both http/https, plus
 * AUTH_URL / APP_BASE_URL (and their opposite-scheme twins), plus the
 * incoming request Host when present (tunnel / custom domain).
 *
 * Local wrangler + Cloudflare Tunnel sometimes presents Origin/Referer as
 * http://www.logosophe.com even when the browser is on
 * https://local-dev.logosophe.com; trusting both schemes avoids 403
 * on sign-out and other cookie-authenticated POSTs.
 */

const STATIC_TRUSTED_ORIGINS = [
  'https://www.logosophe.com',
  'http://www.logosophe.com',
  'https://local-dev.logosophe.com',
  'http://local-dev.logosophe.com',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://appleid.apple.com',
] as const;

function addOriginAndSchemeTwin(set: Set<string>, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;

  // Custom schemes — keep as-is
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    set.add(trimmed.endsWith('://') ? trimmed : trimmed.replace(/\/+$/, ''));
    return;
  }

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (!url.host) return;
    set.add(url.origin);
    const twinProtocol = url.protocol === 'https:' ? 'http:' : 'https:';
    set.add(`${twinProtocol}//${url.host}`);
  } catch {
    // ignore unparseable values
  }
}

function hostFromRequest(request?: Request | null): string | null {
  if (!request) return null;
  const raw =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    '';
  const host = raw.split(',')[0]?.trim();
  if (!host || host.includes('/') || host.includes(' ')) return null;
  return host;
}

export function buildTrustedOrigins(options?: {
  authUrl?: string | null;
  appBaseUrl?: string | null;
  request?: Request | null;
  extra?: string[];
}): string[] {
  const set = new Set<string>();
  for (const origin of STATIC_TRUSTED_ORIGINS) {
    addOriginAndSchemeTwin(set, origin);
  }
  addOriginAndSchemeTwin(set, options?.authUrl || '');
  addOriginAndSchemeTwin(set, options?.appBaseUrl || '');
  for (const extra of options?.extra || []) {
    addOriginAndSchemeTwin(set, extra);
  }
  const requestHost = hostFromRequest(options?.request);
  if (requestHost) {
    addOriginAndSchemeTwin(set, `https://${requestHost}`);
  }
  return [...set];
}
