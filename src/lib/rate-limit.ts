/**
 * Small fixed-window counter for expensive or abusable actions (lookups, transfers, AI questions).
 * It lives in server memory, so it is a best-effort brake per server instance, not a global guarantee.
 * The PIN has a stronger, database-backed guard (see docs/security-database-request.md).
 */
export function createRateLimiter(max: number, windowMs: number) {
  const buckets = new Map<string, { n: number; reset: number }>();
  return {
    /** Counts one use. `allowed` is false once the key has used `max` in the current window. */
    hit(key: string, now = Date.now()) {
      if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
      const b = buckets.get(key);
      if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return { allowed: true, retryAfterSeconds: 0 }; }
      if (b.n >= max) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
      b.n += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
