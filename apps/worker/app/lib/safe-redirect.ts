/**
 * Only same-site paths may be used as post-sign-in redirect targets. Absolute URLs,
 * protocol-relative URLs ("//evil.example") and backslash tricks ("/\\evil.example")
 * would otherwise turn sign-in links into open redirects.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/en/harbor'): string {
  if (!target || typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(target)) return fallback;
  return target;
}
