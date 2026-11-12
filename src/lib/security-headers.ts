/**
 * Headers added to every response. The Content-Security-Policy is deliberately limited to directives that cannot block
 * the page's own scripts, styles or sign-in; it stops other sites framing Perk (clickjacking), plugins and base-tag tricks.
 * Framing stays allowed for the Lovable editor and previews.
 */
const FRAME_ANCESTORS = ["'self'", 'https://lovable.dev', 'https://*.lovable.dev', 'https://*.lovable.app', 'https://*.lovableproject.com', 'https://*.lovableproject-dev.com', 'https://*.gptengineer.app', 'https://*.gpt-eng.com'].join(' ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `frame-ancestors ${FRAME_ANCESTORS}; base-uri 'self'; object-src 'none'`,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Private account data must never be kept by a browser cache or a shared proxy. */
export const isPrivatePath = (pathname: string) => pathname.startsWith('/_serverFn/') || pathname.startsWith('/api/') || pathname === '/admin' || pathname.startsWith('/account') || pathname.startsWith('/manage') || pathname.startsWith('/send');

export function withSecurityHeaders(response: Response, url: URL): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  if (isPrivatePath(url.pathname) && !headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
