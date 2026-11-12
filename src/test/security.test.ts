import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';
import { createAttemptLimiter } from '@/lib/employee-panel';
import { SECURITY_HEADERS, isPrivatePath, withSecurityHeaders } from '@/lib/security-headers';
import { verifyPin, pinHash } from '@/lib/auth.server';

describe('rate limiter', () => {
  it('allows up to the maximum, then blocks until the window ends', () => {
    const l = createRateLimiter(3, 1000);
    expect([1, 2, 3].map(() => l.hit('a', 0).allowed)).toEqual([true, true, true]);
    const blocked = l.hit('a', 500);
    expect(blocked.allowed).toBe(false); expect(blocked.retryAfterSeconds).toBe(1);
    expect(l.hit('b', 500).allowed).toBe(true);
    expect(l.hit('a', 1001).allowed).toBe(true);
  });
});

describe('pin attempt limiter', () => {
  it('locks after five wrong guesses and a success clears it', () => {
    const l = createAttemptLimiter({ max: 5 });
    for (let i = 0; i < 5; i++) l.fail('u', 0);
    expect(l.check('u', 1).allowed).toBe(false);
    expect(l.check('u', 16 * 60_000).allowed).toBe(true);
    l.fail('v', 0); l.succeed('v'); expect(l.check('v', 1).allowed).toBe(true);
  });
});

describe('security headers', () => {
  it('adds the headers, keeps the body and marks private paths uncacheable', async () => {
    const r = withSecurityHeaders(new Response('hello', { status: 200, headers: { 'x-keep': '1' } }), new URL('https://perk.test/_serverFn/abc'));
    expect(await r.text()).toBe('hello');
    for (const k of Object.keys(SECURITY_HEADERS)) expect(r.headers.get(k)).toBe(SECURITY_HEADERS[k]);
    expect(r.headers.get('x-keep')).toBe('1');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(isPrivatePath('/')).toBe(false); expect(isPrivatePath('/admin')).toBe(true);
  });
  it('only restricts framing, never the page\'s own scripts or styles', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy']!;
    expect(csp).toContain('frame-ancestors'); expect(csp).not.toMatch(/script-src|default-src|style-src|connect-src/);
  });
});

describe('PIN hashing', () => {
  it('hashes with the current format, accepts the right PIN only, and recognises old hashes for upgrade', async () => {
    process.env['SESSION_SECRET'] = 'test-secret-with-enough-length';
    const h = await pinHash('user-1', '48273');
    expect(h.startsWith('v2$')).toBe(true);
    expect((await verifyPin('user-1', '48273', h)).ok).toBe(true);
    expect((await verifyPin('user-1', '48274', h)).ok).toBe(false);
    expect((await verifyPin('user-2', '48273', h)).ok).toBe(false);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('test-secret-with-enough-length:user-1:48273'));
    const legacy = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyPin('user-1', '48273', legacy)).toEqual({ ok: true, upgrade: true });
    expect((await verifyPin('user-1', '00000', legacy)).ok).toBe(false);
  });
  it('refuses to hash without a real server secret', async () => {
    const keep = process.env['SESSION_SECRET']; delete process.env['SESSION_SECRET'];
    await expect(pinHash('u', '48273')).rejects.toThrow(); process.env['SESSION_SECRET'] = keep;
  });
});
